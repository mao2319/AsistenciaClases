"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FolderOpen, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"
import { Aviso, Boton, Panel, cx } from "@/components/ui"
import { CLASES, caracteristicas, cargarExtractor, entrenar, marcarEspejo, type ClaseId, type ModeloBotellas, type Muestra } from "@/lib/botellas"

type Fotos = Record<ClaseId, File[]>
const vacio = (): Fotos => ({ sin_dano: [], poco_danada: [], muy_danada: [] })
const MINIMO_POR_CLASE = 5
const META = 250

const tonoClase: Record<string, string> = {
  exito: "bg-exito-suave text-exito",
  aviso: "bg-aviso-suave text-aviso",
  peligro: "bg-peligro-suave text-peligro",
}

/**
 * Entrenamiento del escáner. Las fotos de referencia se leen en la memoria del navegador:
 * no se suben ni se guardan. El modelo resultante (solo números) se usa de inmediato.
 */
export function Entrenamiento({ onModelo }: { onModelo: (m: ModeloBotellas) => void }) {
  const [fotos, setFotos] = useState<Fotos>(vacio)
  const [fase, setFase] = useState<"listo" | "extrayendo" | "entrenando" | "terminado">("listo")
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, exactitud: 0 })
  const [modelo, setModelo] = useState<ModeloBotellas | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = CLASES.reduce((s, c) => s + fotos[c.id].length, 0)
  const ocupado = fase === "extrayendo" || fase === "entrenando"
  const puedeEntrenar = CLASES.every((c) => fotos[c.id].length >= MINIMO_POR_CLASE) && !ocupado

  function agregar(clase: ClaseId, lista: FileList | null) {
    const imagenes = Array.from(lista ?? []).filter((f) => f.type.startsWith("image/"))
    setFotos((f) => ({ ...f, [clase]: [...f[clase], ...imagenes] }))
  }

  async function iniciar() {
    setError(null)
    setModelo(null)
    try {
      setFase("extrayendo")
      setProgreso({ actual: 0, total, exactitud: 0 })
      await cargarExtractor()
      const muestras: Muestra[] = []
      let grupo = 0
      for (let c = 0; c < CLASES.length; c++) {
        for (const archivo of fotos[CLASES[c].id]) {
          try {
            muestras.push({ x: await caracteristicas(archivo), clase: c, grupo })
            muestras.push({ x: marcarEspejo(await caracteristicas(archivo, true)), clase: c, grupo })
          } catch {
            // imagen ilegible: se omite
          }
          grupo++
          setProgreso((p) => ({ ...p, actual: grupo }))
        }
      }
      setFase("entrenando")
      const conteo = { sin_dano: fotos.sin_dano.length, poco_danada: fotos.poco_danada.length, muy_danada: fotos.muy_danada.length }
      const m = await entrenar(muestras, conteo, (epoca, totalEpocas, exactitud) => setProgreso({ actual: epoca, total: totalEpocas, exactitud }))
      setModelo(m)
      setFase("terminado")
      onModelo(m)
    } catch (e) {
      setFase("listo")
      setError(e instanceof Error ? `No se pudo entrenar: ${e.message}` : "No se pudo entrenar el modelo.")
    }
  }

  function descargar() {
    if (!modelo) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(modelo)], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `modelo_botellas_${modelo.creado_en.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-3">
        {CLASES.map((c) => (
          <ZonaClase
            key={c.id}
            etiqueta={c.etiqueta}
            tono={c.tono}
            fotos={fotos[c.id]}
            deshabilitado={ocupado}
            onAgregar={(l) => agregar(c.id, l)}
            onVaciar={() => setFotos((f) => ({ ...f, [c.id]: [] }))}
          />
        ))}
      </div>

      <Panel>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="tabular text-sm text-zinc-700">
              <span className="text-2xl font-semibold tracking-tight text-zinc-950">{total}</span> / {META} imágenes cargadas
            </p>
            <p className="text-[13px] text-zinc-500">
              Mínimo {MINIMO_POR_CLASE} por categoría. Cada foto también se usa espejada; el 20 % se reserva para validar.
            </p>
          </div>
          <Boton tam="lg" onClick={iniciar} disabled={!puedeEntrenar} cargando={ocupado}>
            {fase === "extrayendo" ? "Analizando fotos…" : fase === "entrenando" ? "Entrenando…" : "Entrenar modelo"}
          </Boton>
        </div>
        {ocupado && (
          <div className="space-y-2 px-5 pb-5">
            <div className="flex justify-between text-[13px] text-zinc-600">
              <span className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {fase === "extrayendo" ? "Extrayendo características de las fotos" : "Entrenando la red (épocas)"}
              </span>
              <span className="tabular">
                {progreso.actual} / {progreso.total}
                {fase === "entrenando" && ` · exactitud ${Math.round(progreso.exactitud * 100)} %`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-acento transition-[width]"
                style={{ width: `${progreso.total ? (progreso.actual / progreso.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </Panel>

      {modelo && <Resultados modelo={modelo} onDescargar={descargar} />}
    </div>
  )
}

function ZonaClase({
  etiqueta,
  tono,
  fotos,
  deshabilitado,
  onAgregar,
  onVaciar,
}: {
  etiqueta: string
  tono: string
  fotos: File[]
  deshabilitado: boolean
  onAgregar: (l: FileList | null) => void
  onVaciar: () => void
}) {
  const archivos = useRef<HTMLInputElement>(null)
  const carpeta = useRef<HTMLInputElement>(null)
  const [miniaturas, setMiniaturas] = useState<string[]>([])

  useEffect(() => {
    const urls = fotos.slice(0, 8).map((f) => URL.createObjectURL(f))
    const t = setTimeout(() => setMiniaturas(urls), 0)
    return () => {
      clearTimeout(t)
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [fotos])

  return (
    <Panel>
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <span className={cx("rounded-md px-2 py-1 text-sm font-semibold", tonoClase[tono])}>{etiqueta}</span>
        <span className="tabular text-sm text-zinc-500">{fotos.length} fotos</span>
      </div>
      <div className="px-5 pb-4">
        {miniaturas.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {miniaturas.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="aspect-square w-full rounded-md bg-zinc-100 object-cover" />
            ))}
          </div>
        ) : (
          <div className="grid h-24 place-items-center rounded-lg bg-zinc-50 text-zinc-400">
            <UploadCloud className="size-5" aria-hidden />
          </div>
        )}
        {fotos.length > 8 && <p className="mt-1.5 text-xs text-zinc-500">y {fotos.length - 8} más</p>}
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <Boton variante="secundario" tam="sm" onClick={() => archivos.current?.click()} disabled={deshabilitado}>
          <ImagePlus className="size-3.5" aria-hidden /> Fotos
        </Boton>
        <Boton variante="secundario" tam="sm" onClick={() => carpeta.current?.click()} disabled={deshabilitado}>
          <FolderOpen className="size-3.5" aria-hidden /> Carpeta
        </Boton>
        {fotos.length > 0 && (
          <Boton variante="fantasma" tam="sm" onClick={onVaciar} disabled={deshabilitado} aria-label={`Quitar las fotos de ${etiqueta}`}>
            <Trash2 className="size-3.5" aria-hidden />
          </Boton>
        )}
        <input
          ref={archivos}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onAgregar(e.target.files)
            e.target.value = ""
          }}
        />
        <input
          ref={(el) => {
            carpeta.current = el
            el?.setAttribute("webkitdirectory", "")
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onAgregar(e.target.files)
            e.target.value = ""
          }}
        />
      </div>
    </Panel>
  )
}

function Resultados({ modelo, onDescargar }: { modelo: ModeloBotellas; onDescargar: () => void }) {
  const m = modelo.metricas
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div>
          <h3 className="text-[15px] font-semibold text-zinc-950">Resultado del entrenamiento</h3>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {m.entrenamiento} fotos para entrenar · {m.validacion} para validar. El escáner ya usa este modelo.
          </p>
        </div>
        <Boton variante="secundario" tam="sm" onClick={onDescargar}>
          <Download className="size-3.5" aria-hidden /> Descargar modelo
        </Boton>
      </div>
      <div className="grid gap-6 px-5 pb-5 lg:grid-cols-[200px_1fr]">
        <div>
          <p className="text-[13px] text-zinc-500">Exactitud en validación</p>
          <p className="tabular text-4xl font-semibold tracking-tight text-zinc-950">{Math.round(m.exactitud * 100)} %</p>
          {m.validacion === 0 && <p className="mt-1 text-xs text-aviso">Pocas fotos: se midió sobre el entrenamiento.</p>}
        </div>
        <div className="overflow-x-auto">
          <p className="mb-2 text-[13px] text-zinc-500">Matriz de confusión (filas: real · columnas: predicho)</p>
          <table className="tabular text-sm">
            <thead>
              <tr>
                <th />
                {CLASES.map((c) => (
                  <th key={c.id} className="px-3 py-1.5 text-xs font-medium text-zinc-500">
                    {c.etiqueta}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-xs font-medium text-zinc-500">Sensibilidad</th>
              </tr>
            </thead>
            <tbody>
              {CLASES.map((c, i) => (
                <tr key={c.id}>
                  <th className="whitespace-nowrap py-1.5 pr-3 text-left text-xs font-medium text-zinc-600">{c.etiqueta}</th>
                  {CLASES.map((_, j) => (
                    <td
                      key={j}
                      className={cx(
                        "px-3 py-1.5 text-center",
                        i === j ? "bg-exito-suave font-semibold text-exito" : m.matriz[i][j] ? "bg-peligro-suave text-peligro" : "text-zinc-400",
                      )}
                    >
                      {m.matriz[i][j]}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center text-zinc-700">{Math.round(m.sensibilidad[i] * 100)} %</td>
                </tr>
              ))}
              <tr>
                <th className="py-1.5 pr-3 text-left text-xs font-medium text-zinc-600">Precisión</th>
                {CLASES.map((_, j) => (
                  <td key={j} className="px-3 py-1.5 text-center text-zinc-700">
                    {Math.round(m.precision[j] * 100)} %
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  )
}
