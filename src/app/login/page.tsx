"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { BottleWine, ChevronRight, ScanFace } from "lucide-react"
import { supabase } from "@/lib/supabase/cliente"
import { Aviso, Boton, Campo, Entrada } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [clave, setClave] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function ingresar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !clave) {
      setError("Escribe tu correo y tu contraseña.")
      return
    }
    setEnviando(true)
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave })
    if (error) {
      setEnviando(false)
      setError(
        error.message.includes("Invalid login credentials")
          ? "Correo o contraseña incorrectos."
          : error.message.includes("Email not confirmed")
            ? "Tu correo aún no está confirmado."
            : "No fue posible iniciar sesión. Revisa tu conexión e intenta de nuevo.",
      )
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-100/70 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-zinc-950 text-white">
            <ScanFace className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Asistencia Face ID ESAVE</h1>
            <p className="mt-1 text-sm text-zinc-500">Ingresa con tu cuenta de docente o administrador</p>
          </div>
        </div>

        <form
          onSubmit={ingresar}
          noValidate
          className="space-y-4 rounded-xl bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.06)]"
        >
          <Campo etiqueta="Correo" htmlFor="email">
            <Entrada
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.edu.co"
              autoFocus
            />
          </Campo>
          <Campo etiqueta="Contraseña" htmlFor="clave">
            <Entrada
              id="clave"
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </Campo>
          {error && <Aviso tono="peligro">{error}</Aviso>}
          <Boton type="submit" tam="lg" className="w-full" cargando={enviando}>
            Ingresar
          </Boton>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-500">Las cuentas las crea el administrador.</p>

        <a
          href="/escaner"
          className="mt-8 flex items-center gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.06)] transition-colors hover:bg-zinc-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-800">
            <BottleWine className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-950">Escáner de botellas</span>
            <span className="block text-[13px] text-zinc-500">Analiza fotos de botellas sin iniciar sesión</span>
          </span>
          <ChevronRight className="size-4 text-zinc-400" aria-hidden />
        </a>
      </div>
    </div>
  )
}
