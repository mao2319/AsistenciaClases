"use client"

import { useState, type FormEvent } from "react"
import { KeyRound, Pencil, Plus, UserRound } from "lucide-react"
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  Etiqueta,
  FilasEsqueleto,
  Panel,
  Tabla,
  Td,
  Th,
  TituloPanel,
  Tr,
  Vacio,
} from "@/components/ui"
import type { Docente } from "@/lib/datos"
import { mensajeError, supabase } from "@/lib/supabase/cliente"
import type { DatosAdmin } from "./page"

export function TablaDocentes({ datos, onCambio }: { datos: DatosAdmin | null; onCambio: () => Promise<void> }) {
  const [editando, setEditando] = useState<Docente | "nuevo" | null>(null)
  const [acceso, setAcceso] = useState<Docente | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)

  async function alternarActivo(d: Docente) {
    setMensaje(null)
    const { error } = await supabase().from("docente").update({ activo: !d.activo }).eq("id", d.id)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    setMensaje({
      tono: "exito",
      texto: `${d.nombres} ${d.apellidos} quedó ${d.activo ? "inactivo: ya no aparece en el selector de docentes" : "activo"}.`,
    })
    await onCambio()
  }

  return (
    <div className="space-y-6">
      {editando && (
        <FormDocente
          docente={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={async (texto) => {
            setEditando(null)
            setMensaje({ tono: "exito", texto })
            await onCambio()
          }}
        />
      )}
      {acceso && (
        <CrearAcceso
          docente={acceso}
          onCerrar={() => setAcceso(null)}
          onCreado={(texto) => {
            setAcceso(null)
            setMensaje({ tono: "exito", texto })
          }}
        />
      )}
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <Panel className="overflow-hidden">
        <TituloPanel
          titulo="Docentes"
          descripcion="Solo los docentes activos aparecen en el selector al tomar asistencia."
          acciones={
            <Boton onClick={() => setEditando("nuevo")}>
              <Plus className="size-4" aria-hidden /> Nuevo docente
            </Boton>
          }
        />
        {!datos ? (
          <FilasEsqueleto />
        ) : datos.docentes.length === 0 ? (
          <Vacio icono={<UserRound className="size-5" aria-hidden />} titulo="Aún no hay docentes" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                <Th>Correo de acceso</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {datos.docentes.map((d) => (
                <Tr key={d.id} className={d.activo ? "" : "text-zinc-400"}>
                  <Td className="tabular font-mono text-[13px]">{d.documento}</Td>
                  <Td className="font-medium text-zinc-900">
                    {d.apellidos}, {d.nombres}
                  </Td>
                  <Td className="text-[13px]">{d.email ?? <span className="text-zinc-400">Sin correo</span>}</Td>
                  <Td>{d.activo ? <Etiqueta tono="info">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Boton
                        variante="fantasma"
                        tam="sm"
                        onClick={() => setAcceso(d)}
                        disabled={!d.email || !d.activo}
                        title={d.email ? "Crear la cuenta para que el docente inicie sesión" : "Primero asigna un correo"}
                      >
                        <KeyRound className="size-3.5" aria-hidden /> Acceso
                      </Boton>
                      <Boton variante="fantasma" tam="sm" onClick={() => setEditando(d)} aria-label={`Editar ${d.nombres}`}>
                        <Pencil className="size-3.5" aria-hidden />
                      </Boton>
                      <Boton variante="fantasma" tam="sm" onClick={() => alternarActivo(d)}>
                        {d.activo ? "Desactivar" : "Activar"}
                      </Boton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </div>
  )
}

function FormDocente({
  docente,
  onCerrar,
  onGuardado,
}: {
  docente: Docente | null
  onCerrar: () => void
  onGuardado: (mensaje: string) => Promise<void>
}) {
  const [documento, setDocumento] = useState(docente?.documento ?? "")
  const [nombres, setNombres] = useState(docente?.nombres ?? "")
  const [apellidos, setApellidos] = useState(docente?.apellidos ?? "")
  const [email, setEmail] = useState(docente?.email ?? "")
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!/^\d{5,12}$/.test(documento.trim())) errs.documento = "Entre 5 y 12 dígitos, sin puntos."
    if (!nombres.trim()) errs.nombres = "Obligatorio."
    if (!apellidos.trim()) errs.apellidos = "Obligatorio."
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Correo inválido."
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    setError(null)
    const valores = {
      documento: documento.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      email: email.trim() ? email.trim().toLowerCase() : null,
    }
    const sb = supabase()
    const { error } = docente
      ? await sb.from("docente").update(valores).eq("id", docente.id)
      : await sb.from("docente").insert(valores)
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    await onGuardado(`${valores.nombres} ${valores.apellidos} ${docente ? "actualizado" : "agregado"}.`)
  }

  return (
    <Panel className="animate-entrar">
      <TituloPanel titulo={docente ? "Editar docente" : "Nuevo docente"} />
      <form onSubmit={guardar} noValidate className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Documento" htmlFor="d-doc" error={errores.documento}>
          <Entrada id="d-doc" inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} aria-invalid={Boolean(errores.documento)} />
        </Campo>
        <Campo etiqueta="Nombres" htmlFor="d-nom" error={errores.nombres}>
          <Entrada id="d-nom" value={nombres} onChange={(e) => setNombres(e.target.value)} aria-invalid={Boolean(errores.nombres)} />
        </Campo>
        <Campo etiqueta="Apellidos" htmlFor="d-ape" error={errores.apellidos}>
          <Entrada id="d-ape" value={apellidos} onChange={(e) => setApellidos(e.target.value)} aria-invalid={Boolean(errores.apellidos)} />
        </Campo>
        <Campo etiqueta="Correo (opcional)" htmlFor="d-email" error={errores.email} ayuda="Para que el docente inicie sesión.">
          <Entrada id="d-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errores.email)} />
        </Campo>
        {error && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Aviso tono="peligro">{error}</Aviso>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Boton type="submit" cargando={enviando}>
            {docente ? "Guardar cambios" : "Agregar docente"}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Panel>
  )
}

/** Crea (o restablece) la cuenta de inicio de sesión del docente con una contraseña temporal. */
function CrearAcceso({
  docente,
  onCerrar,
  onCreado,
}: {
  docente: Docente
  onCerrar: () => void
  onCreado: (mensaje: string) => void
}) {
  const [clave, setClave] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (clave.length < 8) return setError("La contraseña temporal debe tener al menos 8 caracteres.")
    setEnviando(true)
    const r = await fetch("/api/cuentas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docenteId: docente.id, password: clave }),
    })
    const cuerpo = (await r.json().catch(() => ({}))) as { mensaje?: string; error?: string }
    setEnviando(false)
    if (!r.ok) return setError(cuerpo.error ?? "No fue posible crear la cuenta.")
    onCreado(cuerpo.mensaje ?? "Cuenta creada.")
  }

  return (
    <Panel className="animate-entrar">
      <TituloPanel
        titulo={`Acceso de ${docente.nombres} ${docente.apellidos}`}
        descripcion={`Crea la cuenta ${docente.email} con una contraseña temporal que le entregarás al docente.`}
      />
      <form onSubmit={crear} noValidate className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end">
        <Campo etiqueta="Contraseña temporal" htmlFor="a-clave" className="sm:w-72">
          <Entrada id="a-clave" type="text" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        <div className="flex gap-2">
          <Boton type="submit" cargando={enviando}>
            Crear acceso
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
      {error && (
        <div className="px-5 pb-5">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Panel>
  )
}
