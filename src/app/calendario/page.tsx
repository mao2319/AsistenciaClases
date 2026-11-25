"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CalendarX2, ChevronDown, ChevronLeft, ChevronRight, ScanFace } from "lucide-react"
import { useSesion } from "@/components/sesion"
import {
  Aviso,
  Boton,
  BotonEnlace,
  Campo,
  Encabezado,
  Entrada,
  FilasEsqueleto,
  Panel,
  Selector,
  TituloPanel,
  Vacio,
  cx,
} from "@/components/ui"
import {
  listarDocentes,
  listarGrupos,
  nombreDocente,
  sesionesPorFecha,
  totalPorGrupo,
  type AsistenciaDetalle,
  type Docente,
  type Grupo,
  type SesionDetalle,
} from "@/lib/datos"
import { esFechaValida, fechaLarga, hhmm, horaDe, hoy, sumarDias } from "@/lib/fechas"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

export default function CalendarioPage() {
  const { perfil } = useSesion()
  const [fecha, setFecha] = useState(hoy())
  const [sesiones, setSesiones] = useState<SesionDetalle[] | null>(null)
  const [asistencia, setAsistencia] = useState<AsistenciaDetalle[]>([])
  const [totales, setTotales] = useState<Record<number, number>>({})
  const [abierta, setAbierta] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])

  const cargar = useCallback(async (f: string) => {
    if (!esFechaValida(f)) return
    setSesiones(null)
    try {
      const sb = supabase()
      const [s, a, t] = await Promise.all([
        sesionesPorFecha(f),
        sb.from("asistencia_detalle").select("*").eq("fecha", f).order("registrada_en"),
        totalPorGrupo(),
      ])
      if (a.error) throw a.error
      setSesiones(s)
      setAsistencia(a.data)
      setTotales(t)
      setError(null)
    } catch (e) {
      setError(mensajeError(e as { message?: string }))
      setSesiones([])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => cargar(fecha), 0)
    return () => clearTimeout(t)
  }, [fecha, cargar])

  useEffect(() => {
    if (!perfil?.rol) return
    Promise.all([listarDocentes(true), listarGrupos()])
      .then(([d, g]) => {
        setDocentes(d)
        setGrupos(g)
      })
      .catch((e) => setError(mensajeError(e)))
  }, [perfil])

  return (
    <>
      <Encabezado
        titulo="Calendario de clases"
        descripcion="Programa sesiones por fecha, hora y grupo, y consulta la asistencia registrada en cada día."
      />

      {error && (
        <Aviso tono="peligro" className="mb-6">
          {error}
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <div className="flex flex-col gap-3 px-5 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950 first-letter:uppercase">
                {esFechaValida(fecha) ? fechaLarga(fecha) : "Fecha inválida"}
              </h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">
                {sesiones ? `${sesiones.length} sesiones · ${asistencia.length} asistencias registradas` : "Cargando…"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Boton variante="fantasma" tam="sm" aria-label="Día anterior" onClick={() => setFecha(sumarDias(fecha, -1))}>
                <ChevronLeft className="size-4" aria-hidden />
              </Boton>
              <Boton variante="secundario" tam="sm" onClick={() => setFecha(hoy())}>
                Hoy
              </Boton>
              <Boton variante="fantasma" tam="sm" aria-label="Día siguiente" onClick={() => setFecha(sumarDias(fecha, 1))}>
                <ChevronRight className="size-4" aria-hidden />
              </Boton>
              <Entrada
                type="date"
                aria-label="Ir a la fecha"
                value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                className="h-8 w-40"
              />
            </div>
          </div>

          {sesiones === null ? (
            <FilasEsqueleto filas={4} />
          ) : sesiones.length === 0 ? (
            <Vacio icono={<CalendarX2 className="size-5" aria-hidden />} titulo="No hay sesiones este día">
              Usa el formulario “Programar clase” para crear una.
            </Vacio>
          ) : (
            <ul className="pb-2">
              {sesiones.map((s) => {
                const lista = asistencia.filter((a) => a.sesion_id === s.id)
                const expandida = abierta === s.id
                const puedeTomar = perfil?.rol !== "docente" || perfil.docenteId === s.docente_id
                return (
                  <li key={s.id} className="[&+&]:shadow-[0_-1px_0_rgb(0_0_0/0.05)]">
                    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                      <button
                        onClick={() => setAbierta(expandida ? null : s.id)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        aria-expanded={expandida}
                      >
                        <span className="tabular w-24 shrink-0 font-mono text-sm text-zinc-500">
                          {hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-zinc-950">{s.asignatura}</span>
                          <span className="block truncate text-[13px] text-zinc-500">
                            {s.grupo?.nombre} · {nombreDocente(s.docente)}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-[13px] text-zinc-600">
                          <span className="font-medium text-zinc-950">{lista.length}</span> / {totales[s.grupo_id] ?? 0}
                        </span>
                        <ChevronDown
                          className={cx("size-4 shrink-0 text-zinc-400 transition-transform", expandida && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                      {puedeTomar && (
                        <BotonEnlace href={`/asistencia?sesion=${s.id}`} variante="secundario" tam="sm">
                          <ScanFace className="size-3.5" aria-hidden /> Tomar asistencia
                        </BotonEnlace>
                      )}
                    </div>
                    {expandida && (
                      <div className="animate-entrar px-5 pb-4 sm:pl-[8.5rem]">
                        {lista.length === 0 ? (
                          <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-[13px] text-zinc-500">
                            Aún no hay asistencia registrada en esta sesión.
                          </p>
                        ) : (
                          <ul className="divide-y divide-zinc-100 rounded-lg bg-zinc-50 px-3">
                            {lista.map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                                <span className="truncate text-zinc-800">{a.estudiante}</span>
                                <span className="tabular shrink-0 font-mono text-zinc-500">
                                  {horaDe(a.registrada_en)} {a.metodo === "MANUAL" && "· manual"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <ProgramarClase
          docentes={docentes}
          grupos={grupos}
          fechaInicial={fecha}
          docenteFijo={perfil?.rol === "docente" ? perfil.docenteId : null}
          onCreada={(f) => {
            if (f === fecha) cargar(f)
            else setFecha(f)
          }}
        />
      </div>
    </>
  )
}

function ProgramarClase({
  docentes,
  grupos,
  fechaInicial,
  docenteFijo,
  onCreada,
}: {
  docentes: Docente[]
  grupos: Grupo[]
  fechaInicial: string
  docenteFijo: number | null
  onCreada: (fecha: string) => void
}) {
  const [docenteId, setDocenteId] = useState("")
  const [grupoId, setGrupoId] = useState("")
  const [asignatura, setAsignatura] = useState("")
  const [fecha, setFecha] = useState(fechaInicial)
  const [inicio, setInicio] = useState("07:00")
  const [fin, setFin] = useState("09:00")
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<{ id: number; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const docenteElegido = docenteFijo ? String(docenteFijo) : docenteId

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCreada(null)
    const errs: Record<string, string> = {}
    if (!docenteElegido) errs.docente = "Elige el docente."
    if (!grupoId) errs.grupo = "Elige el grupo."
    if (!asignatura.trim()) errs.asignatura = "Escribe la asignatura."
    if (!esFechaValida(fecha)) errs.fecha = "Fecha inválida."
    if (!inicio || !fin) errs.horas = "Indica la hora de inicio y de fin."
    else if (fin <= inicio) errs.horas = "La hora de fin debe ser posterior a la de inicio."
    setErrores(errs)
    if (Object.keys(errs).length) return

    setEnviando(true)
    const { data, error } = await supabase()
      .from("sesion")
      .insert({
        docente_id: Number(docenteElegido),
        grupo_id: Number(grupoId),
        asignatura: asignatura.trim(),
        fecha,
        hora_inicio: inicio,
        hora_fin: fin,
      })
      .select("id")
      .single()
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    const grupo = grupos.find((g) => g.id === Number(grupoId))?.nombre
    setCreada({ id: data.id, texto: `${asignatura.trim()} · ${grupo} · ${inicio}–${fin}` })
    setAsignatura("")
    onCreada(fecha)
  }

  return (
    <Panel className="self-start">
      <TituloPanel titulo="Programar clase" descripcion="Crea una sesión para un docente y un grupo." />
      <form onSubmit={enviar} noValidate className="space-y-4 px-5 pb-5">
        <Campo etiqueta="Docente" htmlFor="p-docente" error={errores.docente}>
          <Selector
            id="p-docente"
            value={docenteElegido}
            onChange={(e) => setDocenteId(e.target.value)}
            disabled={Boolean(docenteFijo)}
            aria-invalid={Boolean(errores.docente)}
          >
            <option value="">Selecciona…</option>
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombres} {d.apellidos}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Grupo" htmlFor="p-grupo" error={errores.grupo}>
          <Selector id="p-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} aria-invalid={Boolean(errores.grupo)}>
            <option value="">Selecciona…</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Asignatura" htmlFor="p-asig" error={errores.asignatura}>
          <Entrada
            id="p-asig"
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value)}
            placeholder="Ej.: Meteorología"
            aria-invalid={Boolean(errores.asignatura)}
          />
        </Campo>
        <Campo etiqueta="Fecha" htmlFor="p-fecha" error={errores.fecha}>
          <Entrada id="p-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-invalid={Boolean(errores.fecha)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Inicio" htmlFor="p-ini">
            <Entrada id="p-ini" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} aria-invalid={Boolean(errores.horas)} />
          </Campo>
          <Campo etiqueta="Fin" htmlFor="p-fin">
            <Entrada id="p-fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} aria-invalid={Boolean(errores.horas)} />
          </Campo>
        </div>
        {errores.horas && <p className="-mt-2 text-[13px] text-peligro">{errores.horas}</p>}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        {creada && (
          <Aviso tono="exito" titulo="Sesión programada">
            <p>{creada.texto}</p>
            <a href={`/asistencia?sesion=${creada.id}`} className="mt-1 inline-block font-medium underline underline-offset-2">
              Tomar asistencia ahora
            </a>
          </Aviso>
        )}
        <Boton type="submit" className="w-full" cargando={enviando}>
          Programar clase
        </Boton>
      </form>
    </Panel>
  )
}
