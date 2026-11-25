/**
 * Reconocimiento facial en el navegador con @vladmandic/face-api.
 * - Detecta rostros en el video de la cámara.
 * - Calcula un descriptor de 128 números por rostro.
 * La comparación contra los rostros enrolados la hace Postgres (pgvector),
 * así los descriptores de los estudiantes nunca se descargan al navegador.
 */
type FaceApi = typeof import("@vladmandic/face-api")

let carga: Promise<FaceApi> | null = null

export function cargarModelos(): Promise<FaceApi> {
  if (!carga) {
    carga = (async () => {
      const faceapi = await import("@vladmandic/face-api")
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready()
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ])
      return faceapi
    })().catch((e) => {
      carga = null
      throw e
    })
  }
  return carga
}

export type Caja = { x: number; y: number; width: number; height: number }
export type Deteccion = { descriptor: number[]; caja: Caja; puntaje: number }

export async function detectarRostros(video: HTMLVideoElement): Promise<Deteccion[]> {
  const faceapi = await cargarModelos()
  if (video.readyState < 2 || video.videoWidth === 0) return []
  const resultados = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()
  return resultados.map((r) => ({
    descriptor: Array.from(r.descriptor),
    caja: { x: r.detection.box.x, y: r.detection.box.y, width: r.detection.box.width, height: r.detection.box.height },
    puntaje: r.detection.score,
  }))
}

/** Distancia euclidiana entre dos descriptores (menor = más parecidos). */
export function distancia(a: number[], b: number[]): number {
  let suma = 0
  for (let i = 0; i < a.length; i++) suma += (a[i] - b[i]) ** 2
  return Math.sqrt(suma)
}

/** Formato de texto que entiende pgvector: "[0.1,0.2,...]" */
export function aVector(descriptor: number[]): string {
  return `[${descriptor.map((n) => n.toFixed(6)).join(",")}]`
}
