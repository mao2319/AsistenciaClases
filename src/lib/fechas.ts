// Utilidades de fecha y hora en la zona horaria de Colombia.
export const ZONA = "America/Bogota"

/** Fecha de hoy en Bogotá, formato AAAA-MM-DD. */
export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** true si el texto es una fecha real con formato AAAA-MM-DD. */
export function esFechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [a, m, d] = texto.split("-").map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** "miércoles, 25 de noviembre de 2026" */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number)
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(a, m - 1, d)))
}

/** "25 nov" */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number)
  return new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace(".", "")
}

/** Hora de un timestamp en Bogotá, "07:04:12". */
export function horaDe(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

/** Fecha y hora de un timestamp en Bogotá, "2026-11-25 07:04:12". */
export function fechaHoraDe(iso: string | null | undefined): string {
  if (!iso) return ""
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
  return `${f} ${horaDe(iso)}`
}

/** "07:00:00" -> "07:00" */
export function hhmm(hora: string): string {
  return hora.slice(0, 5)
}
