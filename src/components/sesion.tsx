"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/cliente"

export type Rol = "admin" | "docente" | "operador"

export type Perfil = {
  email: string
  rol: Rol | null
  docenteId: number | null
  nombre: string
}

type Contexto = {
  perfil: Perfil | null
  cargando: boolean
  salir: () => Promise<void>
}

const Ctx = createContext<Contexto>({ perfil: null, cargando: true, salir: async () => {} })

async function cargarPerfil(): Promise<Perfil | null> {
  const sb = supabase()
  const { data } = await sb.auth.getUser()
  const user = data.user
  if (!user?.email) return null
  const [{ data: rol }, { data: docenteId }] = await Promise.all([sb.rpc("rol_actual"), sb.rpc("docente_actual_id")])
  let nombre = user.email
  if (rol === "docente" && docenteId) {
    const { data: d } = await sb.from("docente").select("nombres, apellidos").eq("id", docenteId).maybeSingle()
    if (d) nombre = `${d.nombres} ${d.apellidos}`
  } else if (rol) {
    const { data: c } = await sb.from("cuenta").select("nombre").eq("email", user.email.toLowerCase()).maybeSingle()
    if (c) nombre = c.nombre
  }
  return {
    email: user.email,
    rol: (rol as Rol | null) ?? null,
    docenteId: (docenteId as number | null) ?? null,
    nombre,
  }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let vivo = true
    const actualizar = async () => {
      const p = await cargarPerfil().catch(() => null)
      if (vivo) {
        setPerfil(p)
        setCargando(false)
      }
    }
    actualizar()
    const { data } = supabase().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        setTimeout(actualizar, 0)
      }
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const salir = useCallback(async () => {
    await supabase().auth.signOut()
    router.replace("/login")
    router.refresh()
  }, [router])

  return <Ctx.Provider value={{ perfil, cargando, salir }}>{children}</Ctx.Provider>
}

export function useSesion() {
  return useContext(Ctx)
}

export const nombreRol: Record<Rol, string> = {
  admin: "Administrador",
  docente: "Docente",
  operador: "Operador",
}
