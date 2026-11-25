"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, FileSearch } from "lucide-react"
import { useSesion } from "@/components/sesion"
import {
  Aviso,
  Boton,
  Campo,
  Encabezado,
  Entrada,
  Etiqueta,
  FilasEsqueleto,
  Panel,
  Selector,
  Tabla,
  Td,
  Th,
  TituloPanel,
  Tr,
  Vacio,
} from "@/components/ui"
import { listarDocentes, nombreDocente, sesionesPorFecha, type AsistenciaDetalle, type Docente, type SesionDetalle } from "@/lib/datos"
import { esFechaValida, hhmm, horaDe, hoy } from "@/lib/fechas"
import { ErrorReporte, generarCsv, nombreArchivo, resumen, validarSolicitud, type FilaReporte } from "@/lib/csv"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

export default function HistorialPage() {
  const { perfil } = useSesion()
  const [fecha, setFecha] = useState(hoy())
  const [docenteId, setDocenteId] = useState("")
  const [sesionId, setSesionId] = useState("")
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [sesiones, setSesiones] = useState<SesionDetalle[]>([])
  const [filas, setFilas] = useState<AsistenciaDetalle[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!perfil?.rol) return
    listarDocentes(false).then(setDocentes).catch((e) => setError(mensajeError(e)))
  }, [perfil])

  const consultar = useCallback(async () => {
    setError(null)
    if (!esFechaValida(fecha)) {
      setFilas([])
      setSesiones([])
      setError("La fecha no es válida. Usa el formato AAAA-MM-DD.")
      return
    }
    setFilas(null)
    try {
      let q = supabase().from("asistencia_detalle").select("*").eq("fecha", fecha).order("registrada_en")
      if (docenteId) q = q.eq("docente_id", Number(docenteId))
      if (sesionId) q = q.eq("sesion_id", Number(sesionId))
      const [{ data, error }, s] = await Promise.all([q, sesionesPorFecha(fecha, docenteId ? Number(docenteId) : null)])
      if (error) throw error
      setFilas(data)
      setSesiones(s)
    } catch (e) {
      setError(mensajeError(e as { message?: string }))
      setFilas([])
    }
  }, [fecha, docenteId, sesionId])

  useEffect(() => {
    const t = setTimeout(consultar, 0)
    return () => clearTimeout(t)
  }, [consultar])

  return (
    <>
      <Encabezado titulo="Historial de asistencia" descripcion="Consulta quién asistió, a qué sesión y con qué docente." />

      <Panel className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Campo etiqueta="Fecha" htmlFor="h-fecha">
            <Entrada
              id="h-fecha"
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value)
                setSesionId("")
              }}
            />
          </Campo>
          <Campo etiqueta="Docente" htmlFor="h-docente">
            <Selector
              id="h-docente"
              value={docenteId}
              onChange={(e) => {
                setDocenteId(e.target.value)
                setSesionId("")
              }}
            >
              <option value="">Todos los docentes</option>
              {docentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombres} {d.apellidos}
                  {!d.activo ? " (inactivo)" : ""}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Sesión" htmlFor="h-sesion">
            <Selector id="h-sesion" value={sesionId} onChange={(e) => setSesionId(e.target.value)}>
              <option value="">Todas las sesiones del día</option>
              {sesiones.map((s) => (
                <option key={s.id} value={s.id}>
                  {hhmm(s.hora_inicio)} · {s.asignatura} · {s.grupo?.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
      </Panel>

      {error && (
        <Aviso tono="peligro" className="mb-6">
          {error}
        </Aviso>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="overflow-hidden">
          <TituloPanel
            titulo="Registros"
            descripcion={filas ? `${filas.length} asistencias encontradas` : "Consultando…"}
          />
          {filas === null ? (
            <FilasEsqueleto filas={5} />
          ) : filas.length === 0 ? (
            <Vacio icono={<FileSearch className="size-5" aria-hidden />} titulo="Sin registros para estos filtros">
              Prueba otra fecha o quita el filtro de docente o sesión.
            </Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Hora</Th>
                  <Th>Estudiante</Th>
                  <Th>Sesión</Th>
                  <Th>Docente</Th>
                  <Th>Método</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <Tr key={f.id}>
                    <Td className="tabular whitespace-nowrap font-mono text-[13px] text-zinc-500">{horaDe(f.registrada_en)}</Td>
                    <Td>
                      <p className="font-medium text-zinc-900">{f.estudiante}</p>
                      <p className="tabular text-xs text-zinc-500">{f.estudiante_documento}</p>
                    </Td>
                    <Td>
                      <p className="text-zinc-800">{f.asignatura}</p>
                      <p className="text-xs text-zinc-500">
                        {f.grupo} · {f.hora_inicio && hhmm(f.hora_inicio)}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-800">{f.docente}</Td>
                    <Td>
                      {f.metodo === "MANUAL" ? (
                        <span title={f.motivo ?? ""}>
                          <Etiqueta tono="aviso">Manual</Etiqueta>
                          <span className="mt-1 block max-w-48 truncate text-xs text-zinc-500">{f.motivo}</span>
                        </span>
                      ) : (
                        <Etiqueta>Facial</Etiqueta>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Panel>

        <Exportar fecha={fecha} sesionId={sesionId ? Number(sesionId) : null} sesiones={sesiones} />
      </div>
    </>
  )
}

/**
 * FUNCIÓN ADICIONAL: exporta a CSV la asistencia de una sesión con el reporte de inasistencias.
 * Valida la fecha y que haya una sesión elegida; si algo falla muestra el error y no descarga nada.
 */
function Exportar({ fecha, sesionId, sesiones }: { fecha: string; sesionId: number | null; sesiones: SesionDetalle[] }) {
  const [estado, setEstado] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  async function exportar() {
    setEstado(null)
    try {
      validarSolicitud(fecha, sesionId)
      const sesion = sesiones.find((s) => s.id === sesionId)
      if (!sesion) throw new ErrorReporte("La sesión seleccionada no corresponde a la fecha elegida.")
      setCargando(true)
      const { data, error } = await supabase().rpc("reporte_sesion", { p_sesion_id: sesion.id })
      if (error) throw new ErrorReporte(mensajeError(error))
      const filas = data as FilaReporte[]
      const info = {
        fecha: sesion.fecha,
        asignatura: sesion.asignatura,
        grupo: sesion.grupo?.nombre ?? "",
        docente: nombreDocente(sesion.docente),
        horario: `${hhmm(sesion.hora_inicio)} - ${hhmm(sesion.hora_fin)}`,
      }
      const csv = generarCsv(info, filas, horaDe)
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = nombreArchivo(info)
      a.click()
      URL.revokeObjectURL(url)
      const r = resumen(filas)
      setEstado({ tono: "exito", texto: `Descargado: ${r.presentes} presentes y ${r.ausentes} inasistencias de ${r.total}.` })
    } catch (e) {
      setEstado({ tono: "peligro", texto: e instanceof Error ? e.message : "No fue posible exportar." })
    } finally {
      setCargando(false)
    }
  }

  return (
    <Panel className="self-start">
      <TituloPanel
        titulo="Exportar reporte"
        descripcion="CSV con presentes e inasistencias de la sesión elegida en los filtros. Se abre en Excel."
      />
      <div className="space-y-4 px-5 pb-5">
        {estado && <Aviso tono={estado.tono}>{estado.texto}</Aviso>}
        <Boton variante="secundario" className="w-full" onClick={exportar} cargando={cargando}>
          <Download className="size-4" aria-hidden /> Exportar CSV
        </Boton>
      </div>
    </Panel>
  )
}
