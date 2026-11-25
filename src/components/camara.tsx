"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { CameraOff, Loader2 } from "lucide-react"
import type { Caja } from "@/lib/rostros"

type EstadoCamara = "apagada" | "iniciando" | "lista" | "error"

function mensajeCamara(e: unknown): string {
  const nombre = e instanceof DOMException ? e.name : ""
  if (typeof window !== "undefined" && !window.isSecureContext) return "La cámara solo funciona con HTTPS o en localhost."
  if (nombre === "NotAllowedError") return "Permiso de cámara denegado. Habilítalo desde el candado en la barra de direcciones y vuelve a intentar."
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No se encontró ninguna cámara en este equipo."
  if (nombre === "NotReadableError") return "Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar."
  return "No fue posible iniciar la cámara."
}

/** Enciende la cámara mientras `activa` sea true y la apaga al desmontar. */
export function useCamara(activa: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<EstadoCamara>("apagada")
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [dimensiones, setDimensiones] = useState({ ancho: 1280, alto: 720 })

  useEffect(() => {
    if (!activa) return
    let cancelado = false
    let stream: MediaStream | null = null

    const iniciar = async () => {
      await Promise.resolve()
      if (cancelado) return
      setEstado("iniciando")
      setError(null)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("", "NotFoundError")
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
          setDimensiones({ ancho: video.videoWidth || 1280, alto: video.videoHeight || 720 })
        }
        setEstado("lista")
      } catch (e) {
        if (cancelado) return
        setEstado("error")
        setError(mensajeCamara(e))
      }
    }
    iniciar()

    return () => {
      cancelado = true
      stream?.getTracks().forEach((t) => t.stop())
      setEstado("apagada")
    }
  }, [activa, intento])

  return { videoRef, estado, error, dimensiones, reintentar: () => setIntento((n) => n + 1) }
}

/** Marco de video espejado con recuadros sobre los rostros detectados. */
export function VistaCamara({
  videoRef,
  estado,
  error,
  dimensiones,
  cajas = [],
  onReintentar,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  estado: EstadoCamara
  error: string | null
  dimensiones: { ancho: number; alto: number }
  cajas?: Caja[]
  onReintentar?: () => void
  children?: ReactNode
}) {
  const { ancho, alto } = dimensiones

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      {estado === "lista" && cajas.length > 0 && (
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          aria-hidden
        >
          {cajas.map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width={c.width}
              height={c.height}
              rx={16}
              fill="none"
              stroke="white"
              strokeOpacity={0.9}
              strokeWidth={4}
            />
          ))}
        </svg>
      )}
      {estado === "iniciando" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-300">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Encendiendo cámara…
          </span>
        </div>
      )}
      {estado === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-sm space-y-3">
            <CameraOff className="mx-auto size-8 text-zinc-400" aria-hidden />
            <p className="text-sm text-zinc-200">{error}</p>
            {onReintentar && (
              <button
                onClick={onReintentar}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
