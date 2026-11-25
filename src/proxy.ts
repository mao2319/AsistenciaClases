import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Se ejecuta antes de cada página:
 *  - refresca la sesión de Supabase (cookies),
 *  - envía a /login a quien no ha iniciado sesión,
 *  - restringe /admin a cuentas con rol de administrador.
 * La protección real de los datos la hacen las políticas RLS de Postgres.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v))
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const autenticado = Boolean(data?.claims)
  const ruta = request.nextUrl.pathname

  const redirigir = (destino: string) => {
    const url = request.nextUrl.clone()
    const [path, query] = destino.split("?")
    url.pathname = path
    url.search = query ? `?${query}` : ""
    const r = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => r.cookies.set(c))
    return r
  }

  if (!autenticado && ruta !== "/login") return redirigir("/login")
  if (autenticado && ruta === "/login") return redirigir("/")

  if (autenticado && ruta.startsWith("/admin")) {
    const { data: rol } = await supabase.rpc("rol_actual")
    if (rol !== "admin") return redirigir("/?denegado=admin")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|models/|api/|.*\\.(?:svg|png|jpg|jpeg|webp|json|bin)$).*)"],
}
