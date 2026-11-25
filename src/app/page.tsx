"use client"

import { useEffect, useState } from "react"
import { ArrowRight, CalendarPlus, CalendarX2 } from "lucide-react"
import { useSesion } from "@/components/sesion"
import { Aviso, BotonEnlace, Encabezado, FilasEsqueleto, Panel, TituloPanel, Vacio } from "@/components/ui"
import { conteoPorSesion, nombreDocente, sesionesPorFecha, totalPorGrupo, type SesionDetalle } from "@/lib/datos"
import { fechaLarga, hhmm, hoy } from "@/lib/fechas"
import { mensajeError } from "@/lib/supabase/cliente"

export default function InicioPage() {
  const { perfil, cargando: cargandoPerfil } = useSesion()
  const [sesiones, setSesiones] = useState<SesionDetalle[] | null>(null)
  const [conteo, setConteo] = useState<Record<number, number>>({})
  const [totales, setTotales] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [denegado, setDenegado] = useState(false)
  const fecha = hoy()

  useEffect(() => {
    const t = setTimeout(() => setDenegado(new URLSearchParams(window.location.search).get("denegado") === "admin"), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (cargandoPerfil || !perfil?.rol) return
    let vivo = true
    ;(async () => {
      try {
        const docenteId = perfil.rol === "docente" ? perfil.docenteId : null
        const lista = await sesionesPorFecha(fecha, docenteId)
        const [c, t] = await Promise.all([conteoPorSesion(lista.map((s) => s.id)), totalPorGrupo()])
        if (!vivo) return
        setSesiones(lista)
        setConteo(c)
        setTotales(t)
      } catch (e) {
        if (vivo) setError(mensajeError(e as { message?: string }))
      }
    })()
    return () => {
      vivo = false
    }
  }, [perfil, cargandoPerfil, fecha])

  const saludo = perfil ? `Hola, ${perfil.nombre.split(" ")[0]}` : "Inicio"

  return (
    <>
      <Encabezado
        titulo={saludo}
        descripcion={<span className="first-letter:uppercase">{fechaLarga(fecha)}</span>}
        acciones={
          <BotonEnlace href="/calendario" variante="secundario">
            <CalendarPlus className="size-4" aria-hidden /> Programar clase
          </BotonEnlace>
        }
      />

      {denegado && (
        <Aviso tono="aviso" titulo="Acceso restringido" className="mb-6">
          El módulo de administración requiere una cuenta de administrador.
        </Aviso>
      )}

      <Panel>
        <TituloPanel
          titulo="Clases de hoy"
          descripcion={perfil?.rol === "docente" ? "Tus sesiones programadas para hoy" : "Todas las sesiones programadas para hoy"}
        />
        {error ? (
          <div className="px-5 pb-5">
            <Aviso tono="peligro">{error}</Aviso>
          </div>
        ) : sesiones === null ? (
          <FilasEsqueleto filas={3} />
        ) : sesiones.length === 0 ? (
          <Vacio icono={<CalendarX2 className="size-5" aria-hidden />} titulo="No hay clases programadas para hoy">
            Programa una sesión en el calendario para poder tomar asistencia.
          </Vacio>
        ) : (
          <ul className="pb-2">
            {sesiones.map((s) => {
              const presentes = conteo[s.id] ?? 0
              const total = totales[s.grupo_id] ?? 0
              const pct = total ? Math.round((presentes / total) * 100) : 0
              return (
                <li key={s.id} className="[&+&]:shadow-[0_-1px_0_rgb(0_0_0/0.05)]">
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="tabular w-28 shrink-0 font-mono text-sm text-zinc-500">
                      {hhmm(s.hora_inicio)} – {hhmm(s.hora_fin)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-950">{s.asignatura}</p>
                      <p className="truncate text-[13px] text-zinc-500">
                        {s.grupo?.nombre} · {nombreDocente(s.docente)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:w-64 sm:justify-end">
                      <div className="w-24">
                        <p className="tabular text-right text-[13px] text-zinc-600">
                          <span className="font-medium text-zinc-950">{presentes}</span> / {total}
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <BotonEnlace href={`/asistencia?sesion=${s.id}`} tam="sm">
                        Tomar asistencia <ArrowRight className="size-3.5" aria-hidden />
                      </BotonEnlace>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
