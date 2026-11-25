/**
 * FUNCIÓN ADICIONAL: exportación CSV con reporte de inasistencias.
 *
 * Entrada: los datos de una sesión y la lista de estudiantes de su grupo con su estado
 * (PRESENTE / AUSENTE), que entrega la función de base de datos `reporte_sesion`.
 * Salida: el texto de un archivo CSV separado por ";" (así lo abre Excel en español)
 * con BOM UTF-8 para que las tildes se vean bien.
 *
 * Errores (lanza ErrorReporte con un mensaje claro):
 *  - fecha con formato inválido,
 *  - ninguna sesión seleccionada,
 *  - la sesión no tiene estudiantes que reportar.
 */
import { esFechaValida } from "./fechas.ts"

export type FilaReporte = {
  documento: string
  nombres: string
  apellidos: string
  estado: string
  registrada_en: string | null
  metodo: string | null
  motivo: string | null
}

export type InfoSesion = {
  fecha: string
  asignatura: string
  grupo: string
  docente: string
  horario: string
}

export class ErrorReporte extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = "ErrorReporte"
  }
}

/** Valida lo que el usuario eligió antes de consultar la base de datos. */
export function validarSolicitud(fecha: string, sesionId: number | null | undefined): void {
  if (!esFechaValida(fecha)) {
    throw new ErrorReporte("La fecha no es válida. Usa el formato AAAA-MM-DD.")
  }
  if (!sesionId) {
    throw new ErrorReporte("Selecciona una sesión para exportar su reporte.")
  }
}

/** Escapa un campo: si tiene ; comillas o saltos de línea, lo encierra entre comillas. */
export function escaparCampo(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor)
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export function resumen(filas: FilaReporte[]) {
  const presentes = filas.filter((f) => f.estado === "PRESENTE").length
  return { presentes, ausentes: filas.length - presentes, total: filas.length }
}

/**
 * Genera el CSV. `formatearHora` convierte el timestamp a hora local (se inyecta para
 * poder probar la función sin depender de la zona horaria del equipo).
 */
export function generarCsv(
  info: InfoSesion,
  filas: FilaReporte[],
  formatearHora: (iso: string) => string,
): string {
  if (filas.length === 0) {
    throw new ErrorReporte("La sesión no tiene estudiantes en su grupo; no hay nada que exportar.")
  }
  const linea = (campos: (string | number | null)[]) => campos.map(escaparCampo).join(";")
  const { presentes, ausentes, total } = resumen(filas)

  const lineas = [
    linea(["Reporte de asistencia"]),
    linea(["Fecha", info.fecha]),
    linea(["Horario", info.horario]),
    linea(["Asignatura", info.asignatura]),
    linea(["Grupo", info.grupo]),
    linea(["Docente", info.docente]),
    "",
    linea(["Documento", "Apellidos", "Nombres", "Estado", "Hora de registro", "Método", "Motivo"]),
    ...filas.map((f) =>
      linea([
        f.documento,
        f.apellidos,
        f.nombres,
        f.estado,
        f.registrada_en ? formatearHora(f.registrada_en) : "",
        f.metodo ?? "",
        f.motivo ?? "",
      ]),
    ),
    "",
    linea(["Presentes", presentes]),
    linea(["Inasistencias", ausentes]),
    linea(["Total del grupo", total]),
  ]
  return "﻿" + lineas.join("\r\n") + "\r\n"
}

export function nombreArchivo(info: InfoSesion): string {
  const limpio = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
  return `asistencia_${info.fecha}_${limpio(info.grupo)}_${limpio(info.asignatura)}.csv`
}
