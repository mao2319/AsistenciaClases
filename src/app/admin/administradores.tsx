"use client"

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react"
import { Plus, ShieldCheck, UserMinus } from "lucide-react"
import { useSesion } from "@/components/sesion"
import {
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
import { fechaHoraDe } from "@/lib/fechas"
import { mensajeError, supabase } from "@/lib/supabase/cliente"

type Admin = { email: string; nombre: string; creado_en: string; tiene_usuario: boolean; ultimo_ingreso: string | null }

/** Administradores: usuarios de Supabase con rol de administrador en la app. */
export function TablaAdministradores({ onCuenta }: { onCuenta: (n: number) => void }) {
  const { perfil } = useSesion()
  const [admins, setAdmins] = useState<Admin[] | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [porQuitar, setPorQuitar] = useState<string | null>(null)
  const [quitando, setQuitando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("listar_administradores")
    if (error) {
      setMensaje({ tono: "peligro", texto: mensajeError(error) })
      setAdmins([])
      return
    }
    setAdmins(data)
    onCuenta(data.length)
  }, [onCuenta])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [cargar])

  async function quitar(email: string) {
    setQuitando(true)
    const { error } = await supabase().rpc("quitar_administrador", { p_email: email })
    setQuitando(false)
    setPorQuitar(null)
    if (error) return setMensaje({ tono: "peligro", texto: mensajeError(error) })
    setMensaje({ tono: "exito", texto: `${email} ya no es administrador. Su usuario de Supabase se conserva.` })
    await cargar()
  }

  return (
    <div className="space-y-6">
      {nuevo && (
        <FormAdministrador
          onCerrar={() => setNuevo(false)}
          onGuardado={async (texto) => {
            setNuevo(false)
            setMensaje({ tono: "exito", texto })
            await cargar()
          }}
        />
      )}
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <Panel className="overflow-hidden">
        <TituloPanel
          titulo="Administradores"
          descripcion="Usuarios de Supabase que pueden entrar al módulo de administración."
          acciones={
            <Boton onClick={() => setNuevo(true)}>
              <Plus className="size-4" aria-hidden /> Nuevo administrador
            </Boton>
          }
        />
        {admins === null ? (
          <FilasEsqueleto filas={2} />
        ) : admins.length === 0 ? (
          <Vacio icono={<ShieldCheck className="size-5" aria-hidden />} titulo="No hay administradores" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Último ingreso</Th>
                <Th>Usuario Supabase</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const soyYo = a.email === perfil?.email.toLowerCase()
                return (
                  <Fragment key={a.email}>
                    <Tr>
                      <Td className="font-medium text-zinc-900">
                        {a.nombre} {soyYo && <span className="ml-1 text-xs font-normal text-zinc-500">(tú)</span>}
                      </Td>
                      <Td className="text-[13px]">{a.email}</Td>
                      <Td className="tabular whitespace-nowrap font-mono text-[13px] text-zinc-500">
                        {a.ultimo_ingreso ? fechaHoraDe(a.ultimo_ingreso) : "Nunca"}
                      </Td>
                      <Td>{a.tiene_usuario ? <Etiqueta tono="info">Activo</Etiqueta> : <Etiqueta tono="aviso">Sin usuario</Etiqueta>}</Td>
                      <Td className="text-right">
                        {!soyYo && (
                          <Boton variante="fantasma" tam="sm" onClick={() => setPorQuitar(porQuitar === a.email ? null : a.email)}>
                            <UserMinus className="size-3.5" aria-hidden /> Quitar
                          </Boton>
                        )}
                      </Td>
                    </Tr>
                    {porQuitar === a.email && (
                      <tr>
                        <td colSpan={5} className="px-5 pb-3">
                          <ConfirmarEliminar
                            texto={`¿Quitar a ${a.nombre} como administrador? Su usuario de Supabase no se borra.`}
                            cargando={quitando}
                            onConfirmar={() => quitar(a.email)}
                            onCancelar={() => setPorQuitar(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </div>
  )
}

function FormAdministrador({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: (mensaje: string) => Promise<void> }) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [clave, setClave] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (nombre.trim().length < 3) return setError("Escribe el nombre del administrador.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("El correo no es válido.")
    if (clave && clave.length < 8) return setError("La contraseña temporal debe tener al menos 8 caracteres.")
    setEnviando(true)
    const r = await fetch("/api/administradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), password: clave }),
    })
    const cuerpo = (await r.json().catch(() => ({}))) as { mensaje?: string; error?: string }
    setEnviando(false)
    if (!r.ok) return setError(cuerpo.error ?? "No fue posible agregar el administrador.")
    await onGuardado(cuerpo.mensaje ?? "Administrador agregado.")
  }

  return (
    <Panel className="animate-entrar">
      <TituloPanel
        titulo="Nuevo administrador"
        descripcion="Si el correo ya tiene usuario en Supabase, deja la contraseña vacía; si no, se crea con la contraseña temporal."
      />
      <form onSubmit={guardar} noValidate className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
        <Campo etiqueta="Nombre" htmlFor="ad-nombre">
          <Entrada id="ad-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="ad-email">
          <Entrada id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etiqueta="Contraseña temporal" htmlFor="ad-clave" ayuda="Mínimo 8 caracteres. Opcional si ya existe.">
          <Entrada id="ad-clave" type="text" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        {error && (
          <div className="sm:col-span-3">
            <Aviso tono="peligro">{error}</Aviso>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-3">
          <Boton type="submit" cargando={enviando}>
            Agregar administrador
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Panel>
  )
}
