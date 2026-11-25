"use client"

import { useState, type FormEvent } from "react"
import { Check, Pencil, Trash2, Users, X } from "lucide-react"
import { Aviso, Boton, ConfirmarEliminar, Entrada, FilasEsqueleto, Panel, TituloPanel, Vacio } from "@/components/ui"
import type { Grupo } from "@/lib/datos"
import { mensajeError, supabase } from "@/lib/supabase/cliente"
import type { DatosAdmin } from "./page"

export function TablaGrupos({ datos, onCambio }: { datos: DatosAdmin | null; onCambio: () => Promise<void> }) {
  const [nombre, setNombre] = useState("")
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [porEliminar, setPorEliminar] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function eliminar(g: Grupo) {
    setEliminando(true)
    const { data, error } = await supabase().from("grupo").delete().eq("id", g.id).select("id")
    setEliminando(false)
    setPorEliminar(null)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    if (!data?.length) return setMensaje({ tono: "peligro", texto: "No tienes permiso para eliminar grupos." })
    setMensaje({ tono: "exito", texto: `Grupo ${g.nombre} eliminado.` })
    await onCambio()
  }

  async function crear(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    const n = nombre.trim().toUpperCase()
    if (!n) return setMensaje({ tono: "peligro", texto: "Escribe el nombre del grupo." })
    setEnviando(true)
    const { error } = await supabase().from("grupo").insert({ nombre: n })
    setEnviando(false)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    setNombre("")
    setMensaje({ tono: "exito", texto: `Grupo ${n} creado.` })
    await onCambio()
  }

  async function renombrar(g: Grupo) {
    if (!editando) return
    const n = editando.nombre.trim().toUpperCase()
    if (!n) return setMensaje({ tono: "peligro", texto: "El nombre no puede quedar vacío." })
    const { error } = await supabase().from("grupo").update({ nombre: n }).eq("id", g.id)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    setEditando(null)
    setMensaje({ tono: "exito", texto: `Grupo renombrado a ${n}.` })
    await onCambio()
  }

  const integrantes = (id: number) => datos?.estudiantes.filter((e) => e.grupo_id === id && e.activo).length ?? 0

  return (
    <div className="space-y-6">
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
      <Panel className="max-w-2xl">
        <TituloPanel titulo="Grupos" descripcion="Cada estudiante pertenece a un grupo; las sesiones se programan por grupo." />
        <form onSubmit={crear} className="flex gap-2 px-5 pb-4">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: PILOTOS-2026-C" aria-label="Nombre del nuevo grupo" />
          <Boton type="submit" cargando={enviando}>
            Crear grupo
          </Boton>
        </form>
        {!datos ? (
          <FilasEsqueleto filas={2} />
        ) : datos.grupos.length === 0 ? (
          <Vacio icono={<Users className="size-5" aria-hidden />} titulo="Aún no hay grupos" />
        ) : (
          <ul className="pb-2">
            {datos.grupos.map((g) => (
              <li key={g.id} className="px-5 py-2.5 [&+&]:shadow-[0_-1px_0_rgb(0_0_0/0.05)]">
                <div className="flex items-center gap-3">
                {editando?.id === g.id ? (
                  <>
                    <Entrada
                      value={editando.nombre}
                      onChange={(e) => setEditando({ id: g.id, nombre: e.target.value })}
                      aria-label="Nuevo nombre"
                      autoFocus
                    />
                    <Boton variante="secundario" tam="sm" onClick={() => renombrar(g)} aria-label="Guardar">
                      <Check className="size-3.5" aria-hidden />
                    </Boton>
                    <Boton variante="fantasma" tam="sm" onClick={() => setEditando(null)} aria-label="Cancelar">
                      <X className="size-3.5" aria-hidden />
                    </Boton>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-zinc-900">{g.nombre}</span>
                    <span className="tabular text-[13px] text-zinc-500">{integrantes(g.id)} estudiantes activos</span>
                    <Boton variante="fantasma" tam="sm" onClick={() => setEditando({ id: g.id, nombre: g.nombre })} aria-label={`Renombrar ${g.nombre}`}>
                      <Pencil className="size-3.5" aria-hidden />
                    </Boton>
                    <Boton
                      variante="fantasma"
                      tam="sm"
                      onClick={() => setPorEliminar(porEliminar === g.id ? null : g.id)}
                      aria-label={`Eliminar ${g.nombre}`}
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Boton>
                  </>
                )}
                </div>
                {porEliminar === g.id && (
                  <div className="mt-2">
                    <ConfirmarEliminar
                      texto={`¿Eliminar el grupo ${g.nombre}? Solo es posible si no tiene estudiantes ni sesiones.`}
                      cargando={eliminando}
                      onConfirmar={() => eliminar(g)}
                      onCancelar={() => setPorEliminar(null)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
