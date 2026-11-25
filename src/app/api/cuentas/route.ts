import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

/**
 * POST /api/cuentas  { docenteId, password }
 * Crea (o restablece la contraseña de) la cuenta de inicio de sesión de un docente.
 * Solo un administrador puede llamarla. Usa la clave secreta de Supabase, que vive
 * únicamente en el servidor (variable SUPABASE_SECRET_KEY).
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const almacen = await cookies()
  const sb = createServerClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => almacen.getAll(), setAll: () => {} },
  })

  const { data: esAdmin } = await sb.rpc("es_admin")
  if (!esAdmin) return Response.json({ error: "Solo un administrador puede crear cuentas." }, { status: 403 })

  const cuerpo = (await request.json().catch(() => null)) as { docenteId?: number; password?: string } | null
  if (!cuerpo?.docenteId || typeof cuerpo.password !== "string" || cuerpo.password.length < 8) {
    return Response.json({ error: "Datos inválidos: la contraseña debe tener al menos 8 caracteres." }, { status: 400 })
  }

  const { data: docente } = await sb.from("docente").select("email, nombres, activo").eq("id", cuerpo.docenteId).maybeSingle()
  if (!docente?.email) return Response.json({ error: "El docente no tiene correo asignado." }, { status: 400 })
  if (!docente.activo) return Response.json({ error: "El docente está inactivo." }, { status: 400 })

  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!secreta) {
    return Response.json(
      { error: "Falta configurar SUPABASE_SECRET_KEY en el servidor. Mientras tanto, crea el usuario en Supabase › Authentication › Users." },
      { status: 503 },
    )
  }

  const admin = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })
  const creado = await admin.auth.admin.createUser({
    email: docente.email,
    password: cuerpo.password,
    email_confirm: true,
  })

  if (creado.error) {
    const existe = /already|registered|exists/i.test(creado.error.message)
    if (!existe) return Response.json({ error: creado.error.message }, { status: 400 })
    // Ya existía: se restablece la contraseña
    const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const usuario = lista.users.find((u) => u.email?.toLowerCase() === docente.email)
    if (!usuario) return Response.json({ error: "No se encontró el usuario existente." }, { status: 500 })
    const act = await admin.auth.admin.updateUserById(usuario.id, { password: cuerpo.password })
    if (act.error) return Response.json({ error: act.error.message }, { status: 400 })
    return Response.json({ mensaje: `La cuenta ${docente.email} ya existía: se actualizó su contraseña.` })
  }

  return Response.json({ mensaje: `Cuenta creada: ${docente.email} ya puede iniciar sesión con la contraseña temporal.` })
}
