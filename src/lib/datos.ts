// Consultas compartidas entre páginas.
import { supabase } from "./supabase/cliente"
import type { Fila, FilaVista } from "./database.types"

export type Docente = Fila<"docente">
export type Grupo = Fila<"grupo">
export type Estudiante = Fila<"estudiante">
export type AsistenciaDetalle = FilaVista<"asistencia_detalle">

export type SesionDetalle = Fila<"sesion"> & {
  docente: { nombres: string; apellidos: string; activo: boolean } | null
  grupo: { nombre: string } | null
}

const COLUMNAS_SESION = "*, docente(nombres, apellidos, activo), grupo(nombre)"

export async function listarDocentes(soloActivos = false): Promise<Docente[]> {
  let q = supabase().from("docente").select("*").order("apellidos")
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function listarGrupos(): Promise<Grupo[]> {
  const { data, error } = await supabase().from("grupo").select("*").order("nombre")
  if (error) throw error
  return data
}

export async function sesionesPorFecha(fecha: string, docenteId?: number | null): Promise<SesionDetalle[]> {
  let q = supabase().from("sesion").select(COLUMNAS_SESION).eq("fecha", fecha).order("hora_inicio")
  if (docenteId) q = q.eq("docente_id", docenteId)
  const { data, error } = await q
  if (error) throw error
  return data as unknown as SesionDetalle[]
}

export async function sesionesEnRango(desde: string, hasta: string): Promise<SesionDetalle[]> {
  const { data, error } = await supabase()
    .from("sesion")
    .select(COLUMNAS_SESION)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("hora_inicio")
  if (error) throw error
  return data as unknown as SesionDetalle[]
}

export async function sesionesDeDocente(docenteId: number, desde: string, hasta: string): Promise<SesionDetalle[]> {
  const { data, error } = await supabase()
    .from("sesion")
    .select(COLUMNAS_SESION)
    .eq("docente_id", docenteId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("hora_inicio")
  if (error) throw error
  return data as unknown as SesionDetalle[]
}

export async function obtenerSesion(id: number): Promise<SesionDetalle | null> {
  const { data, error } = await supabase().from("sesion").select(COLUMNAS_SESION).eq("id", id).maybeSingle()
  if (error) throw error
  return data as unknown as SesionDetalle | null
}

/** Número de asistentes registrados por sesión. */
export async function conteoPorSesion(ids: number[]): Promise<Record<number, number>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase().from("asistencia").select("sesion_id").in("sesion_id", ids)
  if (error) throw error
  const conteo: Record<number, number> = {}
  for (const f of data) conteo[f.sesion_id] = (conteo[f.sesion_id] ?? 0) + 1
  return conteo
}

/** Estudiantes activos por grupo. */
export async function totalPorGrupo(): Promise<Record<number, number>> {
  const { data, error } = await supabase().from("estudiante").select("grupo_id").eq("activo", true)
  if (error) throw error
  const conteo: Record<number, number> = {}
  for (const f of data) conteo[f.grupo_id] = (conteo[f.grupo_id] ?? 0) + 1
  return conteo
}

export function nombreDocente(d: { nombres: string; apellidos: string } | null | undefined): string {
  return d ? `${d.nombres} ${d.apellidos}` : "—"
}
