"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Loader2,
  ScanFace,
  UserRoundX,
  Users,
} from "lucide-react"
import { useSesion } from "@/components/sesion"
import { useCamara, VistaCamara } from "@/components/camara"
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Encabezado,
  Entrada,
  Etiqueta,
  Panel,
  Selector,
  TituloPanel,
  Vacio,
  cx,
} from "@/components/ui"
import {
  listarDocentes,
  nombreDocente,
  obtenerSesion,
  sesionesPorFecha,
  type AsistenciaDetalle,
  type Docente,
  type Estudiante,
  type SesionDetalle,
} from "@/lib/datos"
import { fechaLarga, hhmm, horaDe, hoy } from "@/lib/fechas"
import { aVector, cargarModelos, detectarRostros, distancia, type Caja } from "@/lib/rostros"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

type Veredicto =
  | { tipo: "REGISTRADO" | "DUPLICADO"; estudiante: string; hora: string }
  | { tipo: "OTRO_GRUPO"; estudiante: string }
  | { tipo: "DESCONOCIDO" }
  | { tipo: "VARIOS" }
  | { tipo: "ERROR"; mensaje: string }

const INTERVALO_MS = 600
const ESPERA_MISMO_ROSTRO_MS = 4000
const TAMANO_MINIMO = 110 // px de ancho del rostro para intentar reconocer

export default function AsistenciaPage() {
  const { perfil } = useSesion()
  const esDocente = perfil?.rol === "docente"

  const [docentes, setDocentes] = useState<Docente[]>([])
  const [docenteId, setDocenteId] = useState<number | null>(null)
  const [fecha, setFecha] = useState(hoy())
  const [sesiones, setSesiones] = useState<SesionDetalle[] | null>(null)
  const [sesion, setSesion] = useState<SesionDetalle | null>(null)
  const [asistentes, setAsistentes] = useState<AsistenciaDetalle[]>([])
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [error, setError] = useState<string | null>(null)

  const [camaraActiva, setCamaraActiva] = useState(false)
  const camara = useCamara(camaraActiva)
  const [modelos, setModelos] = useState<"cargando" | "listos" | "error">("cargando")
  const [cajas, setCajas] = useState<Caja[]>([])
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Precarga de los modelos de reconocimiento
  useEffect(() => {
    cargarModelos()
      .then(() => setModelos("listos"))
      .catch(() => setModelos("error"))
  }, [])

  // Docentes activos y sesión indicada en la URL (?sesion=ID)
  useEffect(() => {
    if (!perfil?.rol) return
    let vivo = true
    ;(async () => {
      try {
        const lista = await listarDocentes(true)
        if (!vivo) return
        setDocentes(lista)
        const idUrl = Number(new URLSearchParams(window.location.search).get("sesion"))
        if (idUrl) {
          const s = await obtenerSesion(idUrl)
          if (!vivo) return
          if (s) {
            setDocenteId(s.docente_id)
            setFecha(s.fecha)
            setSesion(s)
            return
          }
        }
        if (perfil.rol === "docente" && perfil.docenteId) setDocenteId(perfil.docenteId)
      } catch (e) {
        if (vivo) setError(mensajeError(e as { message?: string }))
      }
    })()
    return () => {
      vivo = false
    }
  }, [perfil])

  // Sesiones del docente en la fecha elegida
  useEffect(() => {
    if (!docenteId) return
    let vivo = true
    ;(async () => {
      try {
        const lista = await sesionesPorFecha(fecha, docenteId)
        if (vivo) setSesiones(lista)
      } catch (e) {
        if (vivo) setError(mensajeError(e as { message?: string }))
      }
    })()
    return () => {
      vivo = false
    }
  }, [docenteId, fecha])

  const cargarAsistentes = useCallback(async (s: SesionDetalle) => {
    const sb = supabase()
    const [a, e] = await Promise.all([
      sb.from("asistencia_detalle").select("*").eq("sesion_id", s.id).order("registrada_en", { ascending: false }),
      sb.from("estudiante").select("*").eq("grupo_id", s.grupo_id).eq("activo", true).order("apellidos"),
    ])
    if (a.error) throw a.error
    if (e.error) throw e.error
    setAsistentes(a.data)
    setEstudiantes(e.data)
  }, [])

  useEffect(() => {
    if (!sesion) return
    const t = setTimeout(() => cargarAsistentes(sesion).catch((e) => setError(mensajeError(e))), 0)
    return () => clearTimeout(t)
  }, [sesion, cargarAsistentes])

  // ------------------------------------------------ Bucle de reconocimiento
  const recientes = useRef<{ descriptor: number[]; hasta: number }[]>([])
  const ocupado = useRef(false)

  useEffect(() => {
    if (camara.estado !== "lista" || !sesion || modelos !== "listos") return
    let vivo = true
    let temporizador: ReturnType<typeof setTimeout>

    const ciclo = async () => {
      if (!vivo) return
      const video = camara.videoRef.current
      if (video && !ocupado.current) {
        ocupado.current = true
        try {
          const rostros = await detectarRostros(video)
          if (!vivo) return
          setCajas(rostros.map((r) => r.caja))
          if (rostros.length > 1) {
            setVeredicto({ tipo: "VARIOS" })
          } else if (rostros.length === 1 && rostros[0].caja.width >= TAMANO_MINIMO) {
            const { descriptor } = rostros[0]
            const ahora = Date.now()
            recientes.current = recientes.current.filter((r) => r.hasta > ahora)
            const visto = recientes.current.some((r) => distancia(r.descriptor, descriptor) < 0.45)
            if (!visto) {
              recientes.current.push({ descriptor, hasta: ahora + ESPERA_MISMO_ROSTRO_MS })
              setEnviando(true)
              const { data, error } = await supabase().rpc("registrar_asistencia", {
                p_sesion_id: sesion.id,
                p_descriptor: aVector(descriptor),
              })
              if (!vivo) return
              setEnviando(false)
              if (error) {
                setVeredicto({ tipo: "ERROR", mensaje: mensajeError(error) })
              } else {
                const r = data as { estado: string; estudiante?: string; registrada_en?: string }
                if (r.estado === "REGISTRADO" || r.estado === "DUPLICADO") {
                  setVeredicto({ tipo: r.estado, estudiante: r.estudiante ?? "", hora: horaDe(r.registrada_en) })
                  if (r.estado === "REGISTRADO") cargarAsistentes(sesion).catch(() => undefined)
                } else if (r.estado === "OTRO_GRUPO") {
                  setVeredicto({ tipo: "OTRO_GRUPO", estudiante: r.estudiante ?? "" })
                } else {
                  setVeredicto({ tipo: "DESCONOCIDO" })
                }
              }
            }
          }
        } catch {
          // un fotograma fallido no detiene el bucle
        } finally {
          ocupado.current = false
        }
      }
      temporizador = setTimeout(ciclo, INTERVALO_MS)
    }
    ciclo()
    return () => {
      vivo = false
      clearTimeout(temporizador)
      setCajas([])
    }
  }, [camara.estado, camara.videoRef, sesion, modelos, cargarAsistentes])

  // ------------------------------------------------------------ Derivados
  const docenteSel = docentes.find((d) => d.id === docenteId)
  const presentesIds = useMemo(() => new Set(asistentes.map((a) => a.estudiante_id)), [asistentes])
  const ausentes = estudiantes.filter((e) => !presentesIds.has(e.id))

  function elegirSesion(id: string) {
    setCamaraActiva(false)
    setVeredicto(null)
    setAsistentes([])
    setEstudiantes([])
    recientes.current = []
    setSesion(sesiones?.find((s) => s.id === Number(id)) ?? null)
  }

  function elegirDocente(id: string) {
    setDocenteId(id ? Number(id) : null)
    setSesiones(null)
    setSesion(null)
    setCamaraActiva(false)
  }

  return (
    <>
      <Encabezado
        titulo="Tomar asistencia"
        descripcion="Elige el docente y la sesión activa; luego cada estudiante se ubica frente a la cámara."
      />

      {error && (
        <Aviso tono="peligro" className="mb-6">
          {error}
        </Aviso>
      )}

      {/* Selector de docente y sesión */}
      <Panel className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_180px_1.4fr]">
          <Campo etiqueta="Docente" htmlFor="docente">
            <Selector
              id="docente"
              value={docenteId ?? ""}
              onChange={(e) => elegirDocente(e.target.value)}
              disabled={esDocente}
            >
              <option value="">Selecciona un docente activo…</option>
              {docentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombres} {d.apellidos}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Fecha" htmlFor="fecha">
            <Entrada
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value)
                setSesion(null)
                setCamaraActiva(false)
              }}
            />
          </Campo>
          <Campo
            etiqueta="Sesión activa"
            htmlFor="sesion"
            ayuda={docenteId && sesiones?.length === 0 ? "Este docente no tiene sesiones en esa fecha." : undefined}
          >
            <Selector
              id="sesion"
              value={sesion?.id ?? ""}
              onChange={(e) => elegirSesion(e.target.value)}
              disabled={!docenteId || !sesiones?.length}
            >
              <option value="">{docenteId ? "Selecciona una sesión…" : "Primero elige un docente"}</option>
              {sesiones?.map((s) => (
                <option key={s.id} value={s.id}>
                  {hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)} · {s.asignatura} · {s.grupo?.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        {docenteSel && sesiones && sesiones.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 pb-4 text-[13px] text-zinc-500">
            <span>Grupos de {docenteSel.nombres} este día:</span>
            {[...new Set(sesiones.map((s) => s.grupo?.nombre))].map((g) => (
              <Etiqueta key={g}>{g}</Etiqueta>
            ))}
          </div>
        )}
      </Panel>

      {!sesion ? (
        <Panel>
          <Vacio icono={<ScanFace className="size-5" aria-hidden />} titulo="Selecciona una sesión para empezar">
            La asistencia queda asociada al estudiante reconocido, al docente y a la sesión que elijas.
          </Vacio>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Cámara */}
          <div className="space-y-4">
            {sesion.fecha !== hoy() && (
              <Aviso tono="aviso" titulo="Esta sesión no es de hoy">
                Es del {fechaLarga(sesion.fecha)}. La asistencia se guardará con la fecha y hora actuales.
              </Aviso>
            )}
            <VistaCamara
              videoRef={camara.videoRef}
              estado={camara.estado}
              error={camara.error}
              dimensiones={camara.dimensiones}
              cajas={cajas}
              onReintentar={camara.reintentar}
            >
              {camara.estado === "apagada" && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-300">
                      {sesion.asignatura} · {sesion.grupo?.nombre}
                    </p>
                    <Boton tam="lg" onClick={() => setCamaraActiva(true)} className="bg-white text-zinc-950 hover:bg-zinc-200">
                      <Camera className="size-4" aria-hidden /> Iniciar cámara
                    </Boton>
                  </div>
                </div>
              )}
              {camara.estado === "lista" && (
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
                  <PanelVeredicto veredicto={veredicto} modelos={modelos} enviando={enviando} />
                </div>
              )}
            </VistaCamara>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-zinc-500">
              <span>
                Docente: <span className="font-medium text-zinc-800">{nombreDocente(sesion.docente)}</span> ·{" "}
                {hhmm(sesion.hora_inicio)}–{hhmm(sesion.hora_fin)}
              </span>
              {camaraActiva && (
                <Boton variante="secundario" tam="sm" onClick={() => setCamaraActiva(false)}>
                  <CameraOff className="size-3.5" aria-hidden /> Detener cámara
                </Boton>
              )}
            </div>
          </div>

          {/* Presentes y corrección manual */}
          <div className="space-y-6">
            <Panel>
              <TituloPanel
                titulo="Presentes"
                descripcion={sesion.grupo?.nombre}
                acciones={
                  <p className="tabular text-sm text-zinc-500">
                    <span className="text-2xl font-semibold tracking-tight text-zinc-950">{asistentes.length}</span> /{" "}
                    {estudiantes.length}
                  </p>
                }
              />
              {asistentes.length === 0 ? (
                <Vacio icono={<Users className="size-5" aria-hidden />} titulo="Nadie registrado todavía">
                  Los estudiantes reconocidos aparecerán aquí con su hora de llegada.
                </Vacio>
              ) : (
                <ul className="max-h-80 overflow-y-auto pb-2">
                  {asistentes.map((a) => (
                    <li key={a.id} className="flex animate-entrar items-center gap-3 px-5 py-2.5">
                      <CheckCircle2 className="size-4 shrink-0 text-exito" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{a.estudiante}</p>
                        {a.motivo && <p className="truncate text-xs text-zinc-500">{a.motivo}</p>}
                      </div>
                      {a.metodo === "MANUAL" && <Etiqueta>Manual</Etiqueta>}
                      <span className="tabular font-mono text-xs text-zinc-500">{horaDe(a.registrada_en)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <CorreccionManual
              sesion={sesion}
              ausentes={ausentes}
              onRegistrado={() => cargarAsistentes(sesion).catch(() => undefined)}
            />
          </div>
        </div>
      )}
    </>
  )
}

function PanelVeredicto({
  veredicto,
  modelos,
  enviando,
}: {
  veredicto: Veredicto | null
  modelos: "cargando" | "listos" | "error"
  enviando: boolean
}) {
  const base = "flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg backdrop-blur-md"
  if (modelos === "cargando")
    return (
      <div className={cx(base, "bg-white/90 text-zinc-700")}>
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <p className="text-sm">Cargando el modelo de reconocimiento…</p>
      </div>
    )
  if (modelos === "error")
    return (
      <div className={cx(base, "bg-peligro-suave text-peligro")}>
        <AlertTriangle className="size-5" aria-hidden />
        <p className="text-sm">No se pudo cargar el modelo de reconocimiento. Recarga la página.</p>
      </div>
    )
  if (enviando)
    return (
      <div className={cx(base, "bg-white/90 text-zinc-700")}>
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <p className="text-sm">Verificando…</p>
      </div>
    )
  if (!veredicto)
    return (
      <div className={cx(base, "bg-white/85 text-zinc-700")}>
        <ScanFace className="size-5" aria-hidden />
        <p className="text-sm">Ubica el rostro frente a la cámara, a menos de un metro.</p>
      </div>
    )

  switch (veredicto.tipo) {
    case "REGISTRADO":
      return (
        <div key={veredicto.estudiante + veredicto.hora} className={cx(base, "animate-entrar bg-exito-suave text-exito")} role="status">
          <CheckCircle2 className="size-7 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-950">{veredicto.estudiante}</p>
            <p className="tabular text-sm">Asistencia registrada a las {veredicto.hora}</p>
          </div>
        </div>
      )
    case "DUPLICADO":
      return (
        <div className={cx(base, "animate-entrar bg-aviso-suave text-aviso")} role="status">
          <Clock className="size-7 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-950">{veredicto.estudiante}</p>
            <p className="tabular text-sm">Ya estaba registrado en esta sesión a las {veredicto.hora}. No se duplicó.</p>
          </div>
        </div>
      )
    case "OTRO_GRUPO":
      return (
        <div className={cx(base, "animate-entrar bg-aviso-suave text-aviso")} role="status">
          <AlertTriangle className="size-7 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-950">{veredicto.estudiante}</p>
            <p className="text-sm">No pertenece al grupo de esta sesión. No se registró.</p>
          </div>
        </div>
      )
    case "DESCONOCIDO":
      return (
        <div className={cx(base, "animate-entrar bg-peligro-suave text-peligro")} role="alert">
          <UserRoundX className="size-7 shrink-0" aria-hidden />
          <div>
            <p className="text-lg font-semibold text-zinc-950">Rostro no reconocido</p>
            <p className="text-sm">Esta persona no está enrolada. No se registró asistencia.</p>
          </div>
        </div>
      )
    case "VARIOS":
      return (
        <div className={cx(base, "bg-white/90 text-zinc-700")} role="status">
          <Users className="size-5" aria-hidden />
          <p className="text-sm">Hay varias personas en cuadro. Debe quedar solo una frente a la cámara.</p>
        </div>
      )
    case "ERROR":
      return (
        <div className={cx(base, "bg-peligro-suave text-peligro")} role="alert">
          <AlertTriangle className="size-5" aria-hidden />
          <p className="text-sm">{veredicto.mensaje}</p>
        </div>
      )
  }
}

/** FUNCIÓN ADICIONAL: corrección manual de asistencia con motivo obligatorio. */
function CorreccionManual({
  sesion,
  ausentes,
  onRegistrado,
}: {
  sesion: SesionDetalle
  ausentes: Estudiante[]
  onRegistrado: () => void
}) {
  const [estudianteId, setEstudianteId] = useState("")
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function registrar() {
    setError(null)
    setExito(null)
    if (!estudianteId) return setError("Selecciona el estudiante.")
    if (motivo.trim().length < 5) return setError("Escribe el motivo de la corrección (mínimo 5 caracteres).")
    setEnviando(true)
    const { data, error } = await supabase().rpc("registrar_asistencia_manual", {
      p_sesion_id: sesion.id,
      p_estudiante_id: Number(estudianteId),
      p_motivo: motivo,
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    const r = data as { estudiante: string; registrada_en: string }
    setExito(`${r.estudiante} quedó presente (${horaDe(r.registrada_en)}).`)
    setEstudianteId("")
    setMotivo("")
    onRegistrado()
  }

  return (
    <Panel>
      <TituloPanel titulo="Corrección manual" descripcion="Registra a un estudiante sin cámara, con un motivo." />
      <div className="space-y-4 px-5 pb-5">
        <Campo etiqueta="Estudiante" htmlFor="manual-est">
          <Selector id="manual-est" value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)}>
            <option value="">{ausentes.length ? "Selecciona…" : "Todos están presentes"}</option>
            {ausentes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.apellidos}, {e.nombres}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Motivo" htmlFor="manual-motivo">
          <AreaTexto
            id="manual-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: la cámara no reconoció por poca luz; verificado en persona."
          />
        </Campo>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        {exito && <Aviso tono="exito">{exito}</Aviso>}
        <Boton variante="secundario" className="w-full" onClick={registrar} cargando={enviando}>
          Registrar manualmente
        </Boton>
      </div>
    </Panel>
  )
}
