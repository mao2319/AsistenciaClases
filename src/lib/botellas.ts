/**
 * ESCÁNER DE BOTELLAS — clasificación del daño con aprendizaje por transferencia.
 *
 * 1. MobileNet v2 (pre-entrenada en ImageNet, servida desde /models/mobilenet_v2) convierte
 *    cada foto en un vector de 1280 características.
 * 2. Sobre esos vectores se entrena en el navegador una capa softmax con 3 clases:
 *    Sin daño · Un poco dañada · Muy dañada.
 * 3. El modelo resultante (pesos + métricas) es un JSON pequeño que se publica en
 *    Supabase Storage y lo usa la página pública del escáner.
 */
import type * as TF from "@tensorflow/tfjs"

type Tf = typeof TF

export const CLASES = [
  { id: "sin_dano", etiqueta: "Sin daño", tono: "exito" },
  { id: "poco_danada", etiqueta: "Un poco dañada", tono: "aviso" },
  { id: "muy_danada", etiqueta: "Muy dañada", tono: "peligro" },
] as const

export type ClaseId = (typeof CLASES)[number]["id"]

export type Metricas = {
  exactitud: number // validación (0–1)
  matriz: number[][] // [real][predicha]
  precision: number[]
  sensibilidad: number[]
  entrenamiento: number
  validacion: number
}

export type ModeloBotellas = {
  version: 1
  clases: ClaseId[]
  pesos: number[][] // [1280][3]
  sesgo: number[] // [3]
  imagenes: Record<ClaseId, number>
  metricas: Metricas
  creado_en: string
}

const NODO_CARACTERISTICAS = "module_apply_default/MobilenetV2/Logits/AvgPool"
const LADO = 224
export const URL_MODELO = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/modelos/botellas.json`

let carga: Promise<{ tf: Tf; red: TF.GraphModel }> | null = null

/** Carga TensorFlow.js y MobileNet v2 (~14 MB, una sola vez). */
export function cargarExtractor() {
  if (!carga) {
    carga = (async () => {
      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      const red = await tf.loadGraphModel("/models/mobilenet_v2/model.json")
      tf.tidy(() => {
        red.execute(tf.zeros([1, LADO, LADO, 3]), NODO_CARACTERISTICAS)
      })
      return { tf, red }
    })().catch((e) => {
      carga = null
      throw e
    })
  }
  return carga
}

/** Recorta la imagen al cuadrado central de 224×224 (opcionalmente espejada). */
async function aCanvas(archivo: Blob, espejo = false): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(archivo)
  const lado = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = LADO
  canvas.height = LADO
  const ctx = canvas.getContext("2d")!
  if (espejo) {
    ctx.translate(LADO, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, LADO, LADO)
  bitmap.close()
  return canvas
}

/** Vector de características normalizado (longitud 1) de una foto. */
export async function caracteristicas(archivo: Blob, espejo = false): Promise<number[]> {
  const { tf, red } = await cargarExtractor()
  const canvas = await aCanvas(archivo, espejo)
  const salida = tf.tidy(() => {
    const entrada = tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0)
    const v = (red.execute(entrada, NODO_CARACTERISTICAS) as TF.Tensor).reshape([-1])
    return v.div(v.norm().add(1e-8))
  })
  const datos = Array.from(await salida.data())
  salida.dispose()
  return datos
}

/** Probabilidad de cada clase para un vector de características. */
export function predecir(modelo: ModeloBotellas, x: number[]): number[] {
  const k = modelo.sesgo.length
  const logits = modelo.sesgo.slice()
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]
    if (xi === 0) continue
    const fila = modelo.pesos[i]
    for (let j = 0; j < k; j++) logits[j] += xi * fila[j]
  }
  const max = Math.max(...logits)
  const exp = logits.map((l) => Math.exp(l - max))
  const suma = exp.reduce((a, b) => a + b, 0)
  return exp.map((e) => e / suma)
}

export type Muestra = { x: number[]; clase: number; grupo: number }

/** Mezcla determinística (misma partición en cada entrenamiento). */
function mezclar<T>(arr: T[], semilla = 42): T[] {
  const a = arr.slice()
  let s = semilla
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Entrena la capa softmax. `muestras` incluye las fotos originales y sus versiones espejadas;
 * `grupo` identifica la foto de origen para que una foto y su espejo queden en el mismo lado
 * de la partición (80 % entrenamiento, 20 % validación, estratificado por clase).
 */
export async function entrenar(
  muestras: Muestra[],
  conteo: Record<ClaseId, number>,
  alAvanzar: (epoca: number, total: number, exactitud: number) => void,
): Promise<ModeloBotellas> {
  const { tf } = await cargarExtractor()
  const k = CLASES.length

  // Partición estratificada por foto de origen
  const validacionGrupos = new Set<number>()
  for (let c = 0; c < k; c++) {
    const grupos = mezclar([...new Set(muestras.filter((m) => m.clase === c).map((m) => m.grupo))])
    const nVal = grupos.length >= 5 ? Math.max(1, Math.round(grupos.length * 0.2)) : 0
    grupos.slice(0, nVal).forEach((g) => validacionGrupos.add(g))
  }
  const entreno = muestras.filter((m) => !validacionGrupos.has(m.grupo))
  const valida = muestras.filter((m) => validacionGrupos.has(m.grupo))

  // Pesos por clase para compensar clases desbalanceadas
  const porClase = Array.from({ length: k }, (_, c) => entreno.filter((m) => m.clase === c).length)
  const pesoClase: Record<number, number> = {}
  porClase.forEach((n, c) => (pesoClase[c] = n ? entreno.length / (k * n) : 1))

  const modelo = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [entreno[0].x.length],
        units: k,
        activation: "softmax",
        kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }),
      }),
    ],
  })
  modelo.compile({ optimizer: tf.train.adam(0.01), loss: "categoricalCrossentropy", metrics: ["accuracy"] })

  const xs = tf.tensor2d(entreno.map((m) => m.x))
  const ys = tf.oneHot(tf.tensor1d(entreno.map((m) => m.clase), "int32"), k)
  const EPOCAS = 80
  await modelo.fit(xs, ys, {
    epochs: EPOCAS,
    batchSize: 32,
    shuffle: true,
    classWeight: pesoClase,
    callbacks: {
      onEpochEnd: async (epoca, logs) => {
        alAvanzar(epoca + 1, EPOCAS, Number(logs?.acc ?? logs?.accuracy ?? 0))
        await tf.nextFrame()
      },
    },
  })
  xs.dispose()
  ys.dispose()

  const [kernel, bias] = modelo.layers[0].getWeights()
  const pesos = (await kernel.array()) as number[][]
  const sesgo = Array.from(await bias.data())
  modelo.dispose()

  const borrador: ModeloBotellas = {
    version: 1,
    clases: CLASES.map((c) => c.id),
    pesos,
    sesgo,
    imagenes: conteo,
    metricas: { exactitud: 0, matriz: [], precision: [], sensibilidad: [], entrenamiento: 0, validacion: 0 },
    creado_en: new Date().toISOString(),
  }

  // Métricas sobre las fotos originales (sin espejo) de validación; si no hay, sobre entrenamiento
  const evaluar = (valida.length ? valida : entreno).filter((m) => m.grupo >= 0 && !esEspejo(m))
  const matriz = Array.from({ length: k }, () => Array(k).fill(0))
  for (const m of evaluar) {
    const p = predecir(borrador, m.x)
    matriz[m.clase][p.indexOf(Math.max(...p))]++
  }
  const aciertos = matriz.reduce((s, fila, i) => s + fila[i], 0)
  const precision = matriz.map((_, j) => {
    const col = matriz.reduce((s, fila) => s + fila[j], 0)
    return col ? matriz[j][j] / col : 0
  })
  const sensibilidad = matriz.map((fila, i) => {
    const t = fila.reduce((a, b) => a + b, 0)
    return t ? fila[i] / t : 0
  })
  borrador.metricas = {
    exactitud: evaluar.length ? aciertos / evaluar.length : 0,
    matriz,
    precision,
    sensibilidad,
    entrenamiento: new Set(entreno.map((m) => m.grupo)).size,
    validacion: new Set(valida.map((m) => m.grupo)).size,
  }
  return borrador
}

// Las muestras espejadas se marcan con x.espejo = true (propiedad no enumerable)
const ESPEJO = new WeakSet<number[]>()
export function marcarEspejo(x: number[]) {
  ESPEJO.add(x)
  return x
}
function esEspejo(m: Muestra) {
  return ESPEJO.has(m.x)
}

export async function descargarModelo(): Promise<ModeloBotellas | null> {
  const r = await fetch(`${URL_MODELO}?t=${Date.now()}`, { cache: "no-store" })
  if (!r.ok) return null
  const m = (await r.json().catch(() => null)) as ModeloBotellas | null
  return m?.version === 1 ? m : null
}
