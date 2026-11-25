import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

/**
 * POST /api/administradores  { email, nombre, password? }
 * Agrega un administrador. Si el usuario no existe en Supabase Auth, lo crea con la
 * contraseña indicada (requiere SUPABASE_SECRET_KEY en el servidor).
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const almacen = await cookies()
  const sb = createServerClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => almacen.getAll(), setAll: () => {} },
  })

  const { data: esAdmin } = await sb.rpc("es_admin")
  if (!esAdmin) return Response.json({ error: "Solo un administrador puede agregar administradores." }, { status: 403 })

  const cuerpo = (await request.json().catch(() => null)) as { email?: string; nombre?: string; password?: string } | null
  const email = (cuerpo?.email ?? "").trim().toLowerCase()
  const nombre = (cuerpo?.nombre ?? "").trim()
  const password = cuerpo?.password ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "El correo no es válido." }, { status: 400 })
  if (nombre.length < 3) return Response.json({ error: "Escribe el nombre del administrador." }, { status: 400 })

  const { data: existe } = await sb.rpc("existe_usuario_auth", { p_email: email })
  let creado = false

  if (!existe) {
    if (password.length < 8) {
      return Response.json(
        { error: "Ese correo aún no tiene usuario en Supabase. Escribe una contraseña temporal de al menos 8 caracteres para crearlo." },
        { status: 400 },
      )
    }
    const secreta = process.env.SUPABASE_SECRET_KEY
    if (!secreta) {
      return Response.json(
        {
          error:
            "Para crear usuarios nuevos falta configurar SUPABASE_SECRET_KEY en Vercel. Mientras tanto, crea el usuario en Supabase › Authentication › Users y vuelve a agregarlo aquí sin contraseña.",
        },
        { status: 503 },
      )
    }
    const admin = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })
    const r = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (r.error) return Response.json({ error: r.error.message }, { status: 400 })
    creado = true
  }

  const { error } = await sb.rpc("agregar_administrador", { p_email: email, p_nombre: nombre })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({
    mensaje: creado
      ? `Administrador creado: ${email} ya puede iniciar sesión con la contraseña temporal.`
      : `${email} ahora es administrador.`,
  })
}
