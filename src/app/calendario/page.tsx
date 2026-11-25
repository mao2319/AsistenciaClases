"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  CalendarPlus,
  CalendarX2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ScanFace,
  Trash2,
} from "lucide-react"
import { useSesion } from "@/components/sesion"
import {
  Aviso,
  Boton,
  BotonEnlace,
  Campo,
  ConfirmarEliminar,
  Encabezado,
  Entrada,
  Esqueleto,
  Panel,
  Pestanas,
  Selector,
  Vacio,
  cx,
} from "@/components/ui"
import {
  conteoPorSesion,
  listarDocentes,
  listarGrupos,
  nombreDocente,
  sesionesEnRango,
  totalPorGrupo,
  type AsistenciaDetalle,
  type Docente,
  type Grupo,
  type SesionDetalle,
} from "@/lib/datos"
import {
  diaCorto,
  esFechaValida,
  fechaLarga,
  hhmm,
  horaDe,
  horaDecimal,
  hoy,
  inicioMes,
  inicioSemana,
  mesAnio,
  numeroDia,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

type Vista = "mes" | "semana"
type ModoPanel = { modo: "dia" } | { modo: "programar"; fecha: string; inicio: string; fin: string }

/* Colores suaves por grupo: solo relleno, sin bordes. */
const COLORES_GRUPO = [
  { chip: "bg-[oklch(0.95_0.03_263)] text-[oklch(0.38_0.15_263)]", punto: "bg-[oklch(0.58_0.17_263)]" },
  { chip: "bg-[oklch(0.95_0.04_175)] text-[oklch(0.37_0.08_175)]", punto: "bg-[oklch(0.6_0.11_175)]" },
  { chip: "bg-[oklch(0.95_0.035_300)] text-[oklch(0.4_0.15_300)]", punto: "bg-[oklch(0.6_0.16_300)]" },
  { chip: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.42_0.1_60)]", punto: "bg-[oklch(0.72_0.14_70)]" },
  { chip: "bg-[oklch(0.95_0.03_15)] text-[oklch(0.45_0.15_20)]", punto: "bg-[oklch(0.62_0.17_20)]" },
  { chip: "bg-[oklch(0.95_0.01_250)] text-[oklch(0.35_0.03_250)]", punto: "bg-[oklch(0.55_0.03_250)]" },
]
const colorGrupo = (id: number) => COLORES_GRUPO[(id - 1 + COLORES_GRUPO.length) % COLORES_GRUPO.length]

const HORA_INICIO = 6
const HORA_FIN = 21
const ALTO_HORA = 52 // px
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]

const pad = (n: number) => String(n).padStart(2, "0")

export default function CalendarioPage() {
  const { perfil } = useSesion()
  const hoyStr = hoy()
  const [vista, setVista] = useState<Vista>("mes")
  const [ancla, setAncla] = useState(hoyStr)
  const [seleccion, setSeleccion] = useState(hoyStr)
  const [panel, setPanel] = useState<ModoPanel>({ modo: "dia" })
  const [sesiones, setSesiones] = useState<SesionDetalle[] | null>(null)
  const [asistencia, setAsistencia] = useState<AsistenciaDetalle[]>([])
  const [conteo, setConteo] = useState<Record<number, number>>({})
  const [totales, setTotales] = useState<Record<number, number>>({})
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tono: "exito" | "peligro"; texto: string; sesionId?: number } | null>(null)

  // Días visibles según la vista
  const dias = useMemo(() => {
    const inicio = vista === "mes" ? inicioSemana(inicioMes(ancla)) : inicioSemana(ancla)
    const n = vista === "mes" ? 42 : 7
    return Array.from({ length: n }, (_, i) => sumarDias(inicio, i))
  }, [vista, ancla])
  const desde = dias[0]
  const hasta = dias[dias.length - 1]

  const cargar = useCallback(async () => {
    try {
      const sb = supabase()
      const [s, a, t] = await Promise.all([
        sesionesEnRango(desde, hasta),
        sb.from("asistencia_detalle").select("*").gte("fecha", desde).lte("fecha", hasta).order("registrada_en"),
        totalPorGrupo(),
      ])
      if (a.error) throw a.error
      const c = await conteoPorSesion(s.map((x) => x.id))
      setSesiones(s)
      setAsistencia(a.data)
      setTotales(t)
      setConteo(c)
      setError(null)
    } catch (e) {
      setError(mensajeError(e as { message?: string }))
      setSesiones([])
    }
  }, [desde, hasta])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [cargar])

  useEffect(() => {
    if (!perfil?.rol) return
    Promise.all([listarDocentes(true), listarGrupos()])
      .then(([d, g]) => {
        setDocentes(d)
        setGrupos(g)
      })
      .catch((e) => setError(mensajeError(e)))
  }, [perfil])

  const porDia = useMemo(() => {
    const m: Record<string, SesionDetalle[]> = {}
    for (const s of sesiones ?? []) (m[s.fecha] ??= []).push(s)
    return m
  }, [sesiones])

  function mover(paso: number) {
    const nueva = vista === "mes" ? sumarMeses(ancla, paso) : sumarDias(ancla, paso * 7)
    setAncla(nueva)
    setSesiones(null)
  }

  function irHoy() {
    setAncla(hoyStr)
    setSeleccion(hoyStr)
    setPanel({ modo: "dia" })
  }

  function elegirDia(f: string) {
    setSeleccion(f)
    setPanel({ modo: "dia" })
    setAviso(null)
  }

  function programar(f: string, hora = 7) {
    const inicio = Math.min(Math.max(hora, HORA_INICIO), HORA_FIN - 1)
    setSeleccion(f)
    setAviso(null)
    setPanel({ modo: "programar", fecha: f, inicio: `${pad(inicio)}:00`, fin: `${pad(Math.min(inicio + 2, 23))}:00` })
  }

  const titulo =
    vista === "mes"
      ? mesAnio(ancla)
      : `${numeroDia(dias[0])} ${mesAnio(dias[0]).split(" ")[0].slice(0, 3)} – ${numeroDia(dias[6])} ${mesAnio(dias[6])}`

  return (
    <>
      <Encabezado
        titulo="Calendario de clases"
        descripcion="Haz clic en un día u hora para programar una clase. Consulta las sesiones y la asistencia de cada fecha."
        acciones={
          <Boton onClick={() => programar(seleccion)}>
            <CalendarPlus className="size-4" aria-hidden /> Programar clase
          </Boton>
        }
      />

      {error && (
        <Aviso tono="peligro" className="mb-6">
          {error}
        </Aviso>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------ Calendario */}
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Boton variante="fantasma" tam="sm" aria-label="Anterior" onClick={() => mover(-1)}>
                  <ChevronLeft className="size-4" aria-hidden />
                </Boton>
                <Boton variante="fantasma" tam="sm" aria-label="Siguiente" onClick={() => mover(1)}>
                  <ChevronRight className="size-4" aria-hidden />
                </Boton>
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950 first-letter:uppercase">{titulo}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tam="sm" onClick={irHoy}>
                Hoy
              </Boton>
              <Pestanas
                valor={vista}
                onCambio={(v) => {
                  setVista(v)
                  setAncla(seleccion)
                  setSesiones(null)
                }}
                opciones={[
                  { valor: "mes", etiqueta: "Mes" },
                  { valor: "semana", etiqueta: "Semana" },
                ]}
              />
            </div>
          </div>

          {grupos.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs text-zinc-500 sm:px-5">
              {grupos.map((g) => (
                <span key={g.id} className="inline-flex items-center gap-1.5">
                  <span className={cx("size-2 rounded-full", colorGrupo(g.id).punto)} aria-hidden />
                  {g.nombre}
                </span>
              ))}
            </div>
          )}

          {vista === "mes" ? (
            <VistaMes
              dias={dias}
              mes={ancla.slice(0, 7)}
              hoy={hoyStr}
              seleccion={seleccion}
              porDia={porDia}
              cargando={sesiones === null}
              onDia={elegirDia}
              onProgramar={programar}
            />
          ) : (
            <VistaSemana
              dias={dias}
              hoy={hoyStr}
              seleccion={seleccion}
              porDia={porDia}
              onDia={elegirDia}
              onProgramar={programar}
            />
          )}
        </Panel>

        {/* ---------------------------------------------------- Panel lateral */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {aviso && (
            <Aviso tono={aviso.tono}>
              <p>{aviso.texto}</p>
              {aviso.sesionId && (
                <a href={`/asistencia?sesion=${aviso.sesionId}`} className="mt-1 inline-block font-medium underline underline-offset-2">
                  Tomar asistencia ahora
                </a>
              )}
            </Aviso>
          )}
          {panel.modo === "programar" ? (
            <ProgramarClase
              key={`${panel.fecha}-${panel.inicio}`}
              docentes={docentes}
              grupos={grupos}
              fechaInicial={panel.fecha}
              inicioInicial={panel.inicio}
              finInicial={panel.fin}
              docenteFijo={perfil?.rol === "docente" ? perfil.docenteId : null}
              onCancelar={() => setPanel({ modo: "dia" })}
              onCreada={async (s) => {
                setSeleccion(s.fecha)
                setAncla(s.fecha)
                setPanel({ modo: "dia" })
                setAviso({ tono: "exito", texto: `Clase programada: ${s.texto}`, sesionId: s.id })
                await cargar()
              }}
            />
          ) : (
            <DetalleDia
              fecha={seleccion}
              sesiones={porDia[seleccion] ?? []}
              cargando={sesiones === null}
              asistencia={asistencia}
              conteo={conteo}
              totales={totales}
              perfil={perfil}
              onProgramar={() => programar(seleccion)}
              onEliminada={async (texto) => {
                setAviso({ tono: "exito", texto })
                await cargar()
              }}
              onError={(texto) => setAviso({ tono: "peligro", texto })}
            />
          )}
        </div>
      </div>
    </>
  )
}

/* ================================================================ Vista mes */
function VistaMes({
  dias,
  mes,
  hoy,
  seleccion,
  porDia,
  cargando,
  onDia,
  onProgramar,
}: {
  dias: string[]
  mes: string
  hoy: string
  seleccion: string
  porDia: Record<string, SesionDetalle[]>
  cargando: boolean
  onDia: (f: string) => void
  onProgramar: (f: string) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-7 bg-zinc-50 text-center text-xs font-medium text-zinc-500">
        {DIAS.map((d) => (
          <div key={d} className="py-2 capitalize">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-100">
        {dias.map((f) => {
          const delMes = f.startsWith(mes)
          const lista = porDia[f] ?? []
          const esHoy = f === hoy
          const elegido = f === seleccion
          return (
            <div
              key={f}
              role="button"
              tabIndex={0}
              aria-label={`${fechaLarga(f)}, ${lista.length} clases`}
              aria-pressed={elegido}
              onClick={() => onDia(f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onDia(f)
                }
              }}
              className={cx(
                "group relative flex min-h-16 cursor-pointer flex-col gap-1 p-1.5 text-left outline-none transition-colors sm:min-h-28 sm:p-2",
                elegido ? "bg-acento-suave/60" : delMes ? "bg-white hover:bg-zinc-50" : "bg-zinc-50/80 hover:bg-zinc-100/70",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-zinc-900",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    "tabular grid size-6 place-items-center rounded-full text-xs font-medium sm:size-7 sm:text-[13px]",
                    esHoy ? "bg-zinc-950 text-white" : delMes ? "text-zinc-900" : "text-zinc-400",
                  )}
                >
                  {numeroDia(f)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onProgramar(f)
                  }}
                  className={cx(
                    "hidden size-6 place-items-center rounded-md text-zinc-500 hover:bg-white hover:text-zinc-900 hover:shadow-sm sm:grid",
                    elegido ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                  aria-label={`Programar clase el ${fechaLarga(f)}`}
                  title="Programar clase"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              {cargando ? (
                delMes && <Esqueleto className="hidden h-4 w-full sm:block" />
              ) : (
                <>
                  {/* Escritorio: etiquetas con hora y asignatura */}
                  <div className="hidden space-y-1 sm:block">
                    {lista.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className={cx("truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", colorGrupo(s.grupo_id).chip)}
                        title={`${hhmm(s.hora_inicio)}–${hhmm(s.hora_fin)} ${s.asignatura} · ${s.grupo?.nombre}`}
                      >
                        <span className="tabular opacity-75">{hhmm(s.hora_inicio)}</span> {s.asignatura}
                      </div>
                    ))}
                    {lista.length > 3 && <p className="px-1.5 text-[11px] text-zinc-500">+{lista.length - 3} más</p>}
                  </div>
                  {/* Celular: puntos */}
                  {lista.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {lista.slice(0, 4).map((s) => (
                        <span key={s.id} className={cx("size-1.5 rounded-full", colorGrupo(s.grupo_id).punto)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================= Vista semana */
function VistaSemana({
  dias,
  hoy,
  seleccion,
  porDia,
  onDia,
  onProgramar,
}: {
  dias: string[]
  hoy: string
  seleccion: string
  porDia: Record<string, SesionDetalle[]>
  onDia: (f: string) => void
  onProgramar: (f: string, hora: number) => void
}) {
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i)
  const alto = horas.length * ALTO_HORA

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Encabezado de días */}
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] bg-zinc-50">
          <div />
          {dias.map((f) => (
            <button
              key={f}
              onClick={() => onDia(f)}
              className={cx("flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-zinc-100", f === seleccion && "bg-acento-suave/60")}
            >
              <span className="text-xs capitalize text-zinc-500">{diaCorto(f)}</span>
              <span
                className={cx(
                  "tabular grid size-7 place-items-center rounded-full text-sm font-semibold",
                  f === hoy ? "bg-zinc-950 text-white" : "text-zinc-900",
                )}
              >
                {numeroDia(f)}
              </span>
            </button>
          ))}
        </div>

        {/* Rejilla de horas */}
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]" style={{ height: alto }}>
          <div className="relative">
            {horas.map((h, i) => (
              <span key={h} className="tabular absolute right-2 -translate-y-2 text-[11px] text-zinc-400" style={{ top: i * ALTO_HORA }}>
                {i === 0 ? "" : `${pad(h)}:00`}
              </span>
            ))}
          </div>
          {dias.map((f) => (
            <div
              key={f}
              className={cx("relative cursor-copy shadow-[-1px_0_0_rgb(0_0_0/0.05)]", f === hoy && "bg-zinc-50/60")}
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ALTO_HORA - 1}px, rgb(0 0 0 / 0.05) ${ALTO_HORA - 1}px, rgb(0 0 0 / 0.05) ${ALTO_HORA}px)`,
              }}
              onClick={(e) => {
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                onProgramar(f, HORA_INICIO + Math.floor(y / ALTO_HORA))
              }}
              title="Haz clic para programar una clase a esta hora"
            >
              {(porDia[f] ?? []).map((s) => {
                const ini = Math.max(horaDecimal(s.hora_inicio), HORA_INICIO)
                const fin = Math.min(horaDecimal(s.hora_fin), HORA_FIN)
                if (fin <= HORA_INICIO || ini >= HORA_FIN) return null
                return (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDia(f)
                    }}
                    className={cx(
                      "absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-4 shadow-sm transition-transform hover:-translate-y-px",
                      colorGrupo(s.grupo_id).chip,
                    )}
                    style={{ top: (ini - HORA_INICIO) * ALTO_HORA + 1, height: Math.max((fin - ini) * ALTO_HORA - 2, 22) }}
                  >
                    <span className="block truncate font-semibold">{s.asignatura}</span>
                    <span className="tabular block truncate opacity-80">
                      {hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)} · {s.grupo?.nombre}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================= Detalle día */
function DetalleDia({
  fecha,
  sesiones,
  cargando,
  asistencia,
  conteo,
  totales,
  perfil,
  onProgramar,
  onEliminada,
  onError,
}: {
  fecha: string
  sesiones: SesionDetalle[]
  cargando: boolean
  asistencia: AsistenciaDetalle[]
  conteo: Record<number, number>
  totales: Record<number, number>
  perfil: ReturnType<typeof useSesion>["perfil"]
  onProgramar: () => void
  onEliminada: (texto: string) => Promise<void>
  onError: (texto: string) => void
}) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const [porEliminar, setPorEliminar] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function eliminar(s: SesionDetalle) {
    setEliminando(true)
    const { data, error } = await supabase().from("sesion").delete().eq("id", s.id).select("id")
    setEliminando(false)
    setPorEliminar(null)
    if (error) return onError(mensajeError(error))
    if (!data?.length) return onError("No tienes permiso para eliminar esta sesión.")
    await onEliminada(`Clase eliminada: ${s.asignatura} · ${s.grupo?.nombre} · ${hhmm(s.hora_inicio)}.`)
  }

  const presentesDia = asistencia.filter((a) => a.fecha === fecha).length

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-950 first-letter:uppercase">
            {esFechaValida(fecha) ? fechaLarga(fecha) : "Fecha inválida"}
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {cargando ? "Cargando…" : `${sesiones.length} ${sesiones.length === 1 ? "clase" : "clases"} · ${presentesDia} asistencias registradas`}
          </p>
        </div>
        <Boton variante="secundario" tam="sm" onClick={onProgramar}>
          <Plus className="size-3.5" aria-hidden /> Clase
        </Boton>
      </div>

      {cargando ? (
        <div className="space-y-2 px-5 pb-5">
          <Esqueleto className="h-16 w-full" />
          <Esqueleto className="h-16 w-full" />
        </div>
      ) : sesiones.length === 0 ? (
        <Vacio icono={<CalendarX2 className="size-5" aria-hidden />} titulo="No hay clases este día">
          <button onClick={onProgramar} className="font-medium text-acento underline-offset-2 hover:underline">
            Programar una clase
          </button>
        </Vacio>
      ) : (
        <ul className="space-y-2 px-3 pb-3">
          {sesiones.map((s) => {
            const lista = asistencia.filter((a) => a.sesion_id === s.id)
            const presentes = conteo[s.id] ?? lista.length
            const total = totales[s.grupo_id] ?? 0
            const puedeOperar = perfil?.rol !== "docente" || perfil.docenteId === s.docente_id
            const expandida = abierta === s.id
            return (
              <li key={s.id} className="rounded-lg bg-zinc-50 p-3">
                <div className="flex gap-3">
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", colorGrupo(s.grupo_id).punto)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-950">{s.asignatura}</p>
                    <p className="tabular text-[13px] text-zinc-600">
                      {hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)} · {s.grupo?.nombre}
                    </p>
                    <p className="truncate text-[13px] text-zinc-500">{nombreDocente(s.docente)}</p>
                  </div>
                  <button
                    onClick={() => setAbierta(expandida ? null : s.id)}
                    className="tabular flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13px] text-zinc-600 hover:bg-zinc-200/60"
                    aria-expanded={expandida}
                    title="Ver asistentes"
                  >
                    <span className="font-semibold text-zinc-950">{presentes}</span>/{total}
                    <ChevronDown className={cx("size-3.5 transition-transform", expandida && "rotate-180")} aria-hidden />
                  </button>
                </div>

                {expandida && (
                  <div className="mt-2 animate-entrar pl-5">
                    {lista.length === 0 ? (
                      <p className="text-[13px] text-zinc-500">Aún no hay asistencia registrada.</p>
                    ) : (
                      <ul className="space-y-1">
                        {lista.map((a) => (
                          <li key={a.id} className="flex justify-between gap-2 text-[13px]">
                            <span className="truncate text-zinc-800">{a.estudiante}</span>
                            <span className="tabular shrink-0 font-mono text-zinc-500">
                              {horaDe(a.registrada_en)}
                              {a.metodo === "MANUAL" && " · manual"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {puedeOperar && (
                  <div className="mt-3 flex items-center gap-2 pl-5">
                    <BotonEnlace href={`/asistencia?sesion=${s.id}`} tam="sm" className="flex-1">
                      <ScanFace className="size-3.5" aria-hidden /> Tomar asistencia
                    </BotonEnlace>
                    <Boton
                      variante="fantasma"
                      tam="sm"
                      onClick={() => setPorEliminar(porEliminar === s.id ? null : s.id)}
                      aria-label={`Eliminar la clase de ${s.asignatura}`}
                      title="Eliminar clase"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Boton>
                  </div>
                )}

                {porEliminar === s.id && (
                  <div className="mt-3">
                    {presentes > 0 ? (
                      <Aviso tono="aviso" titulo="No se puede eliminar">
                        Esta clase ya tiene {presentes} {presentes === 1 ? "asistencia registrada" : "asistencias registradas"}.
                      </Aviso>
                    ) : (
                      <ConfirmarEliminar
                        texto={`¿Eliminar ${s.asignatura} de las ${hhmm(s.hora_inicio)}?`}
                        cargando={eliminando}
                        onConfirmar={() => eliminar(s)}
                        onCancelar={() => setPorEliminar(null)}
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ========================================================== Programar clase */
function ProgramarClase({
  docentes,
  grupos,
  fechaInicial,
  inicioInicial,
  finInicial,
  docenteFijo,
  onCancelar,
  onCreada,
}: {
  docentes: Docente[]
  grupos: Grupo[]
  fechaInicial: string
  inicioInicial: string
  finInicial: string
  docenteFijo: number | null
  onCancelar: () => void
  onCreada: (s: { id: number; fecha: string; texto: string }) => Promise<void>
}) {
  const [docenteId, setDocenteId] = useState("")
  const [grupoId, setGrupoId] = useState("")
  const [asignatura, setAsignatura] = useState("")
  const [fecha, setFecha] = useState(fechaInicial)
  const [inicio, setInicio] = useState(inicioInicial)
  const [fin, setFin] = useState(finInicial)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const docenteElegido = docenteFijo ? String(docenteFijo) : docenteId
  const duraciones = [
    { etiqueta: "1 h", horas: 1 },
    { etiqueta: "1 h 30", horas: 1.5 },
    { etiqueta: "2 h", horas: 2 },
    { etiqueta: "3 h", horas: 3 },
  ]

  function aplicarDuracion(horas: number) {
    if (!inicio) return
    const total = horaDecimal(inicio) + horas
    const h = Math.min(Math.floor(total), 23)
    const m = total >= 24 ? 59 : Math.round((total - Math.floor(total)) * 60)
    setFin(`${pad(h)}:${pad(m)}`)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
    await onCreada({ id: data.id, fecha, texto: `${asignatura.trim()} · ${grupo} · ${fechaLarga(fecha)}, ${inicio}–${fin}` })
  }

  const sinDatos = grupos.length === 0 || docentes.length === 0

  return (
    <Panel className="animate-entrar">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <button
          onClick={onCancelar}
          className="grid size-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Volver al detalle del día"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <h2 className="text-[15px] font-semibold text-zinc-950">Programar clase</h2>
      </div>
      <p className="px-5 pb-3 pl-14 text-[13px] text-zinc-500 first-letter:uppercase">
        {esFechaValida(fecha) ? fechaLarga(fecha) : "Elige una fecha"}
      </p>

      {sinDatos ? (
        <div className="px-5 pb-5">
          <Aviso tono="info" titulo="Faltan datos">
            Para programar una clase primero crea al menos un grupo y un docente activo en Administración.
          </Aviso>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-4 px-5 pb-5">
          <Campo etiqueta="Asignatura" htmlFor="p-asig" error={errores.asignatura}>
            <Entrada
              id="p-asig"
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              placeholder="Ej.: Meteorología"
              aria-invalid={Boolean(errores.asignatura)}
              autoFocus
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
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
          <div className="-mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500">Duración:</span>
            {duraciones.map((d) => (
              <button
                key={d.etiqueta}
                type="button"
                onClick={() => aplicarDuracion(d.horas)}
                className={cx(
                  "h-7 rounded-md px-2 text-xs font-medium transition-colors",
                  inicio && fin && Math.abs(horaDecimal(fin) - horaDecimal(inicio) - d.horas) < 0.01
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
              >
                {d.etiqueta}
              </button>
            ))}
          </div>
          {errores.horas && <p className="-mt-2 text-[13px] text-peligro">{errores.horas}</p>}
          {error && <Aviso tono="peligro">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton type="submit" className="flex-1" cargando={enviando}>
              Programar clase
            </Boton>
            <Boton type="button" variante="fantasma" onClick={onCancelar}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </Panel>
  )
}
