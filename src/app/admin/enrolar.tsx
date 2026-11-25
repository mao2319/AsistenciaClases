"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"
import { useCamara, VistaCamara } from "@/components/camara"
import { Aviso, Boton, cx } from "@/components/ui"
import type { Estudiante } from "@/lib/datos"
import { aVector, cargarModelos, detectarRostros, distancia, type Caja } from "@/lib/rostros"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

const MUESTRAS = 5
const TAMANO_MINIMO = 120

/**
 * Enrolamiento: captura 5 muestras del rostro del estudiante (una sola persona en cuadro)
 * y guarda sus descriptores. Si ya estaba enrolado, reemplaza las muestras anteriores.
 */
export function Enrolar({
  estudiante,
  onCerrar,
  onGuardado,
}: {
  estudiante: Estudiante
  onCerrar: () => void
  onGuardado: () => Promise<void>
}) {
  const camara = useCamara(true)
  const [capturando, setCapturando] = useState(false)
  const [muestras, setMuestras] = useState<number[][]>([])
  const [cajas, setCajas] = useState<Caja[]>([])
  const [pista, setPista] = useState("Cargando el modelo de reconocimiento…")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const muestrasRef = useRef<number[][]>([])
  const dialogo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarModelos()
      .then(() => setPista("Pide al estudiante que mire a la cámara y pulsa “Capturar”."))
      .catch(() => setError("No se pudo cargar el modelo de reconocimiento."))
    dialogo.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onCerrar])

  useEffect(() => {
    if (!capturando || camara.estado !== "lista") return
    let vivo = true
    let t: ReturnType<typeof setTimeout>
    const ciclo = async () => {
      const video = camara.videoRef.current
      if (!vivo || !video) return
      try {
        const rostros = await detectarRostros(video)
        if (!vivo) return
        setCajas(rostros.map((r) => r.caja))
        if (rostros.length === 0) setPista("No se detecta un rostro. Acércate y mira de frente.")
        else if (rostros.length > 1) setPista("Hay más de una persona. Debe quedar solo el estudiante.")
        else if (rostros[0].caja.width < TAMANO_MINIMO) setPista("Acércate un poco más a la cámara.")
        else {
          const d = rostros[0].descriptor
          const anterior = muestrasRef.current.at(-1)
          // Exige que cada muestra sea del mismo rostro que la anterior
          if (anterior && distancia(anterior, d) > 0.55) {
            setPista("El rostro cambió. Mantén a la misma persona frente a la cámara.")
          } else {
            muestrasRef.current = [...muestrasRef.current, d]
            setMuestras(muestrasRef.current)
            setPista("Muy bien. Gira levemente la cabeza entre capturas.")
            if (muestrasRef.current.length >= MUESTRAS) {
              setCapturando(false)
              setPista("Listo. Guarda las muestras para terminar.")
              return
            }
          }
        }
      } catch {
        /* sigue intentando */
      }
      t = setTimeout(ciclo, 700)
    }
    ciclo()
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [capturando, camara.estado, camara.videoRef])

  function reiniciar() {
    muestrasRef.current = []
    setMuestras([])
    setError(null)
    setCapturando(true)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    const sb = supabase()
    // Re-enrolar: se reemplazan las muestras anteriores del estudiante
    const borrado = await sb.from("rostro").delete().eq("estudiante_id", estudiante.id)
    if (borrado.error) {
      setGuardando(false)
      return setError(mensajeError(borrado.error))
    }
    const { error } = await sb
      .from("rostro")
      .insert(muestras.map((m) => ({ estudiante_id: estudiante.id, descriptor: aVector(m) })))
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    await onGuardado()
  }

  const completo = muestras.length >= MUESTRAS

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="enrolar-titulo">
      <button className="absolute inset-0 bg-zinc-950/40" aria-label="Cerrar" onClick={onCerrar} />
      <div
        ref={dialogo}
        tabIndex={-1}
        className="relative w-full max-w-2xl animate-entrar rounded-2xl bg-white p-5 shadow-2xl outline-none sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="enrolar-titulo" className="text-lg font-semibold text-zinc-950">
              Enrolar rostro
            </h2>
            <p className="text-sm text-zinc-500">
              {estudiante.nombres} {estudiante.apellidos} · {estudiante.documento}
            </p>
          </div>
          <button onClick={onCerrar} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100" aria-label="Cerrar">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <VistaCamara
          videoRef={camara.videoRef}
          estado={camara.estado}
          error={camara.error}
          dimensiones={camara.dimensiones}
          cajas={cajas}
          onReintentar={camara.reintentar}
        />

        <div className="mt-4 flex items-center gap-3">
          <div className="flex gap-1.5" aria-label={`${muestras.length} de ${MUESTRAS} muestras`}>
            {Array.from({ length: MUESTRAS }).map((_, i) => (
              <span
                key={i}
                className={cx(
                  "grid size-6 place-items-center rounded-full text-[11px] font-medium transition-colors",
                  i < muestras.length ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-400",
                )}
              >
                {i < muestras.length ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
            ))}
          </div>
          <p className="text-sm text-zinc-600" aria-live="polite">
            {pista}
          </p>
        </div>

        {error && (
          <Aviso tono="peligro" className="mt-4">
            {error}
          </Aviso>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          {completo ? (
            <>
              <Boton variante="secundario" onClick={reiniciar}>
                Repetir
              </Boton>
              <Boton onClick={guardar} cargando={guardando}>
                Guardar {MUESTRAS} muestras
              </Boton>
            </>
          ) : (
            <Boton onClick={reiniciar} disabled={camara.estado !== "lista" || capturando} cargando={capturando}>
              {capturando ? "Capturando…" : muestras.length ? "Reiniciar captura" : "Capturar"}
            </Boton>
          )}
        </div>
      </div>
    </div>
  )
}
