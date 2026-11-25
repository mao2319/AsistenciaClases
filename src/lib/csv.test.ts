// Pruebas de la función adicional (exportación CSV). Ejecutar: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { ErrorReporte, escaparCampo, generarCsv, nombreArchivo, resumen, validarSolicitud, type FilaReporte } from "./csv.ts"
import { esFechaValida } from "./fechas.ts"

const info = {
  fecha: "2026-11-25",
  asignatura: "Aerodinámica",
  grupo: "PILOTOS-2026-A",
  docente: "Laura Restrepo Gil",
  horario: "07:00 - 09:00",
}

const filas: FilaReporte[] = [
  { documento: "1000000001", nombres: "Camilo", apellidos: "Ortiz Peña", estado: "PRESENTE", registrada_en: "2026-11-25T12:04:00Z", metodo: "FACIAL", motivo: null },
  { documento: "1000000002", nombres: "Valentina", apellidos: "Rojas León", estado: "PRESENTE", registrada_en: "2026-11-25T12:10:00Z", metodo: "MANUAL", motivo: 'Cámara falló; "verificado" en persona' },
  { documento: "1000000003", nombres: "Santiago", apellidos: "Herrera Díaz", estado: "AUSENTE", registrada_en: null, metodo: null, motivo: null },
]

test("caso válido: genera CSV con presentes, ausentes y totales", () => {
  const csv = generarCsv(info, filas, () => "07:04:00")
  assert.ok(csv.startsWith("﻿"), "incluye BOM para Excel")
  assert.match(csv, /1000000003;Herrera Díaz;Santiago;AUSENTE;;;/)
  assert.match(csv, /Presentes;2/)
  assert.match(csv, /Inasistencias;1/)
  assert.match(csv, /Total del grupo;3/)
  assert.match(csv, /"Cámara falló; ""verificado"" en persona"/, "escapa ; y comillas")
})

test("resumen cuenta presentes y ausentes", () => {
  assert.deepEqual(resumen(filas), { presentes: 2, ausentes: 1, total: 3 })
})

test("caso de error: fecha inválida", () => {
  assert.throws(() => validarSolicitud("2026-02-30", 1), ErrorReporte)
  assert.throws(() => validarSolicitud("25/11/2026", 1), /fecha no es válida/)
})

test("caso de error: sin sesión seleccionada", () => {
  assert.throws(() => validarSolicitud("2026-11-25", null), /Selecciona una sesión/)
})

test("caso de error: sesión sin estudiantes", () => {
  assert.throws(() => generarCsv(info, [], () => ""), /no hay nada que exportar/)
})

test("escaparCampo deja intactos los textos simples", () => {
  assert.equal(escaparCampo("Camilo"), "Camilo")
  assert.equal(escaparCampo(null), "")
})

test("nombreArchivo sin tildes ni espacios", () => {
  assert.equal(nombreArchivo(info), "asistencia_2026-11-25_pilotos-2026-a_aerodinamica.csv")
})

test("esFechaValida", () => {
  assert.equal(esFechaValida("2026-11-25"), true)
  assert.equal(esFechaValida("2026-13-01"), false)
})
