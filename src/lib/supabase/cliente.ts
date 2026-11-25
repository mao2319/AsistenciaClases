import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

let cliente: SupabaseClient<Database> | undefined

/** Cliente de Supabase para el navegador (una sola instancia). */
export function supabase(): SupabaseClient<Database> {
  if (!cliente) {
    cliente = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )
  }
  return cliente
}

/** Convierte un error de Supabase/Postgres en un mensaje legible en español. */
export function mensajeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado."
  const m = error.message ?? ""
  if (error.code === "23505") {
    if (m.includes("documento")) return "Ya existe un registro con ese número de documento."
    if (m.includes("email")) return "Ese correo ya está asignado a otro docente."
    if (m.includes("nombre")) return "Ya existe un grupo con ese nombre."
    return "El registro ya existe."
  }
  if (error.code === "23514") return "Algún dato no cumple las reglas (campos vacíos, horas o correo inválidos)."
  if (error.code === "42501") return m && m !== "No autorizado" ? m : "Tu cuenta no tiene permiso para esta acción."
  return m || "Ocurrió un error inesperado."
}
