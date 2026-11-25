"use client"

import { Fragment, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Camera, KeyRound, Pencil, Plus, Trash2, UserRound } from "lucide-react"
import {
  Avatar,
  Aviso,
  Boton,
  Campo,
  ConfirmarEliminar,
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
import { ErrorFoto, guardarFotoDocente, prepararFoto, quitarFotoDocente, urlsFotos } from "@/lib/fotos"
import type { DatosAdmin } from "./page"

export function TablaDocentes({ datos, onCambio }: { datos: DatosAdmin | null; onCambio: () => Promise<void> }) {
  const [editando, setEditando] = useState<Docente | "nuevo" | null>(null)
  const [acceso, setAcceso] = useState<Docente | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)
  const [porEliminar, setPorEliminar] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [fotos, setFotos] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!datos) return
    let vivo = true
    urlsFotos(datos.docentes.map((d) => d.foto_path)).then((m) => vivo && setFotos(m))
    return () => {
      vivo = false
    }
  }, [datos])

  async function eliminar(d: Docente) {
    setEliminando(true)
    const { data, error } = await supabase().from("docente").delete().eq("id", d.id).select("id")
    setEliminando(false)
    setPorEliminar(null)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    if (!data?.length) return setMensaje({ tono: "peligro", texto: "No tienes permiso para eliminar docentes." })
    if (d.foto_path) await supabase().storage.from("fotos-docentes").remove([d.foto_path])
    setMensaje({ tono: "exito", texto: `${d.nombres} ${d.apellidos} fue eliminado.` })
    await onCambio()
  }

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
          fotoUrl={editando !== "nuevo" && editando.foto_path ? fotos[editando.foto_path] : null}
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
                <Fragment key={d.id}>
                <Tr className={d.activo ? "" : "text-zinc-400"}>
                  <Td className="tabular font-mono text-[13px]">{d.documento}</Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar url={d.foto_path ? fotos[d.foto_path] : null} nombre={`${d.nombres} ${d.apellidos}`} tam={32} />
                      <span className="font-medium text-zinc-900">
                        {d.apellidos}, {d.nombres}
                      </span>
                    </div>
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
                      <Boton
                        variante="fantasma"
                        tam="sm"
                        onClick={() => setPorEliminar(porEliminar === d.id ? null : d.id)}
                        aria-label={`Eliminar a ${d.nombres} ${d.apellidos}`}
                        title="Eliminar"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Boton>
                    </div>
                  </Td>
                </Tr>
                {porEliminar === d.id && (
                  <tr>
                    <td colSpan={5} className="px-5 pb-3">
                      <ConfirmarEliminar
                        texto={`¿Eliminar a ${d.nombres} ${d.apellidos}? Si tiene sesiones o asistencias registradas no se podrá eliminar.`}
                        cargando={eliminando}
                        onConfirmar={() => eliminar(d)}
                        onCancelar={() => setPorEliminar(null)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
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
  fotoUrl,
  onCerrar,
  onGuardado,
}: {
  docente: Docente | null
  fotoUrl: string | null
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
  const [foto, setFoto] = useState<Blob | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(fotoUrl)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (vistaPrevia?.startsWith("blob:")) URL.revokeObjectURL(vistaPrevia)
    }
  }, [vistaPrevia])

  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ""
    if (!archivo) return
    setErrorFoto(null)
    try {
      const blob = await prepararFoto(archivo)
      setFoto(blob)
      setQuitarFoto(false)
      setVistaPrevia(URL.createObjectURL(blob))
    } catch (err) {
      setErrorFoto(err instanceof ErrorFoto ? err.message : "No se pudo usar esa imagen.")
    }
  }

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
    const res = docente
      ? await sb.from("docente").update(valores).eq("id", docente.id).select("id").single()
      : await sb.from("docente").insert(valores).select("id").single()
    if (res.error) {
      setEnviando(false)
      return setError(mensajeError(res.error))
    }
    try {
      if (foto) await guardarFotoDocente(res.data.id, foto, docente?.foto_path ?? null)
      else if (quitarFoto && docente?.foto_path) await quitarFotoDocente(docente.id, docente.foto_path)
    } catch (err) {
      setEnviando(false)
      return setError(err instanceof Error ? err.message : "No se pudo guardar la foto.")
    }
    setEnviando(false)
    await onGuardado(`${valores.nombres} ${valores.apellidos} ${docente ? "actualizado" : "agregado"}.`)
  }

  return (
    <Panel className="animate-entrar">
      <TituloPanel titulo={docente ? "Editar docente" : "Nuevo docente"} />
      <form onSubmit={guardar} noValidate className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
          <Avatar url={vistaPrevia} nombre={`${nombres || "Nuevo"} ${apellidos || "docente"}`} tam={72} />
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-zinc-700">Foto</p>
            <div className="flex flex-wrap gap-2">
              <Boton type="button" variante="secundario" tam="sm" onClick={() => archivoRef.current?.click()}>
                <Camera className="size-3.5" aria-hidden /> {vistaPrevia ? "Cambiar foto" : "Subir foto"}
              </Boton>
              {vistaPrevia && (
                <Boton
                  type="button"
                  variante="fantasma"
                  tam="sm"
                  onClick={() => {
                    setFoto(null)
                    setVistaPrevia(null)
                    setQuitarFoto(true)
                  }}
                >
                  Quitar
                </Boton>
              )}
            </div>
            <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={elegirFoto} />
            {errorFoto ? (
              <p className="text-[13px] text-peligro">{errorFoto}</p>
            ) : (
              <p className="text-xs text-zinc-500">JPG, PNG o WebP. Se recorta en cuadrado. En tablet o celular puedes tomarla con la cámara.</p>
            )}
          </div>
        </div>
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
