"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Pencil, Plus, ScanFace, Search, UserRound } from "lucide-react"
import {
  Aviso,
  Boton,
  Campo,
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
import type { Estudiante } from "@/lib/datos"
import { mensajeError, supabase } from "@/lib/supabase/cliente"
import type { DatosAdmin } from "./page"
import { Enrolar } from "./enrolar"

export function TablaEstudiantes({ datos, onCambio }: { datos: DatosAdmin | null; onCambio: () => Promise<void> }) {
  const [busqueda, setBusqueda] = useState("")
  const [grupo, setGrupo] = useState("")
  const [verInactivos, setVerInactivos] = useState(false)
  const [editando, setEditando] = useState<Estudiante | "nuevo" | null>(null)
  const [enrolando, setEnrolando] = useState<Estudiante | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim().toLowerCase()
    return datos.estudiantes.filter(
      (e) =>
        (verInactivos || e.activo) &&
        (!grupo || e.grupo_id === Number(grupo)) &&
        (!q || `${e.nombres} ${e.apellidos} ${e.documento}`.toLowerCase().includes(q)),
    )
  }, [datos, busqueda, grupo, verInactivos])

  const nombreGrupo = (id: number) => datos?.grupos.find((g) => g.id === id)?.nombre ?? "—"

  async function alternarActivo(e: Estudiante) {
    setMensaje(null)
    const { error } = await supabase().from("estudiante").update({ activo: !e.activo }).eq("id", e.id)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    setMensaje({ tono: "exito", texto: `${e.nombres} ${e.apellidos} quedó ${e.activo ? "inactivo" : "activo"}.` })
    await onCambio()
  }

  return (
    <div className="space-y-6">
      {editando && datos && (
        <FormEstudiante
          estudiante={editando === "nuevo" ? null : editando}
          grupos={datos.grupos}
          onCerrar={() => setEditando(null)}
          onGuardado={async (texto) => {
            setEditando(null)
            setMensaje({ tono: "exito", texto })
            await onCambio()
          }}
        />
      )}
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Entrada
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o documento"
              className="pl-9"
              aria-label="Buscar estudiante"
            />
          </div>
          <Selector value={grupo} onChange={(e) => setGrupo(e.target.value)} className="sm:w-48" aria-label="Filtrar por grupo">
            <option value="">Todos los grupos</option>
            {datos?.grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Selector>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
              className="size-4 accent-zinc-900"
            />
            Ver inactivos
          </label>
          <Boton onClick={() => setEditando("nuevo")}>
            <Plus className="size-4" aria-hidden /> Nuevo estudiante
          </Boton>
        </div>

        {!datos ? (
          <FilasEsqueleto />
        ) : filtrados.length === 0 ? (
          <Vacio icono={<UserRound className="size-5" aria-hidden />} titulo="No hay estudiantes con esos filtros" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                <Th>Grupo</Th>
                <Th>Rostro</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const n = datos.muestras[e.id] ?? 0
                return (
                  <Tr key={e.id} className={e.activo ? "" : "text-zinc-400"}>
                    <Td className="tabular font-mono text-[13px]">{e.documento}</Td>
                    <Td className="font-medium text-zinc-900">
                      {e.apellidos}, {e.nombres}
                    </Td>
                    <Td className="whitespace-nowrap">{nombreGrupo(e.grupo_id)}</Td>
                    <Td>{n > 0 ? <Etiqueta tono="exito">Enrolado · {n}</Etiqueta> : <Etiqueta>Sin enrolar</Etiqueta>}</Td>
                    <Td>{e.activo ? <Etiqueta tono="info">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Boton variante="fantasma" tam="sm" onClick={() => setEnrolando(e)} disabled={!e.activo}>
                          <ScanFace className="size-3.5" aria-hidden /> {n > 0 ? "Re-enrolar" : "Enrolar"}
                        </Boton>
                        <Boton variante="fantasma" tam="sm" onClick={() => setEditando(e)} aria-label={`Editar ${e.nombres}`}>
                          <Pencil className="size-3.5" aria-hidden />
                        </Boton>
                        <Boton variante="fantasma" tam="sm" onClick={() => alternarActivo(e)}>
                          {e.activo ? "Desactivar" : "Activar"}
                        </Boton>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>

      {enrolando && (
        <Enrolar
          estudiante={enrolando}
          onCerrar={() => setEnrolando(null)}
          onGuardado={async () => {
            setMensaje({ tono: "exito", texto: `Rostro de ${enrolando.nombres} ${enrolando.apellidos} enrolado.` })
            setEnrolando(null)
            await onCambio()
          }}
        />
      )}
    </div>
  )
}

function FormEstudiante({
  estudiante,
  grupos,
  onCerrar,
  onGuardado,
}: {
  estudiante: Estudiante | null
  grupos: DatosAdmin["grupos"]
  onCerrar: () => void
  onGuardado: (mensaje: string) => Promise<void>
}) {
  const [documento, setDocumento] = useState(estudiante?.documento ?? "")
  const [nombres, setNombres] = useState(estudiante?.nombres ?? "")
  const [apellidos, setApellidos] = useState(estudiante?.apellidos ?? "")
  const [grupoId, setGrupoId] = useState(estudiante ? String(estudiante.grupo_id) : "")
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!/^\d{5,12}$/.test(documento.trim())) errs.documento = "Entre 5 y 12 dígitos, sin puntos."
    if (!nombres.trim()) errs.nombres = "Obligatorio."
    if (!apellidos.trim()) errs.apellidos = "Obligatorio."
    if (!grupoId) errs.grupo = "Elige un grupo."
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    setError(null)
    const valores = {
      documento: documento.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      grupo_id: Number(grupoId),
    }
    const sb = supabase()
    const { error } = estudiante
      ? await sb.from("estudiante").update(valores).eq("id", estudiante.id)
      : await sb.from("estudiante").insert(valores)
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    await onGuardado(`${valores.nombres} ${valores.apellidos} ${estudiante ? "actualizado" : "agregado"}.`)
  }

  return (
    <Panel className="animate-entrar">
      <TituloPanel titulo={estudiante ? "Editar estudiante" : "Nuevo estudiante"} />
      <form onSubmit={guardar} noValidate className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Documento" htmlFor="e-doc" error={errores.documento}>
          <Entrada id="e-doc" inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} aria-invalid={Boolean(errores.documento)} />
        </Campo>
        <Campo etiqueta="Nombres" htmlFor="e-nom" error={errores.nombres}>
          <Entrada id="e-nom" value={nombres} onChange={(e) => setNombres(e.target.value)} aria-invalid={Boolean(errores.nombres)} />
        </Campo>
        <Campo etiqueta="Apellidos" htmlFor="e-ape" error={errores.apellidos}>
          <Entrada id="e-ape" value={apellidos} onChange={(e) => setApellidos(e.target.value)} aria-invalid={Boolean(errores.apellidos)} />
        </Campo>
        <Campo etiqueta="Grupo" htmlFor="e-grupo" error={errores.grupo}>
          <Selector id="e-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} aria-invalid={Boolean(errores.grupo)}>
            <option value="">Selecciona…</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        {error && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Aviso tono="peligro">{error}</Aviso>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Boton type="submit" cargando={enviando}>
            {estudiante ? "Guardar cambios" : "Agregar estudiante"}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Panel>
  )
}
