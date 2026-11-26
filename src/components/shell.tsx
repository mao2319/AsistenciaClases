"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  BottleWine,
  CalendarDays,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react"
import { nombreRol, useSesion } from "./sesion"
import { Boton, Esqueleto, cx } from "./ui"

const enlaces = [
  { href: "/", etiqueta: "Inicio", icono: LayoutGrid },
  { href: "/asistencia", etiqueta: "Tomar asistencia", icono: ScanFace },
  { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays },
  { href: "/historial", etiqueta: "Historial", icono: History },
  { href: "/escaner", etiqueta: "Escáner de botellas", icono: BottleWine },
  { href: "/admin", etiqueta: "Administración", icono: ShieldCheck, soloAdmin: true },
]

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="grid size-7 place-items-center rounded-lg bg-zinc-950 text-white">
        <ScanFace className="size-4" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-950">Asistencia Face ID ESAVE</span>
    </Link>
  )
}

function Navegacion({ onNavegar }: { onNavegar?: () => void }) {
  const ruta = usePathname()
  const { perfil } = useSesion()
  return (
    <nav className="space-y-0.5" aria-label="Principal">
      {enlaces
        .filter((e) => !e.soloAdmin || perfil?.rol === "admin")
        .map(({ href, etiqueta, icono: Icono }) => {
          const activo = href === "/" ? ruta === "/" : ruta.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavegar}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
                activo ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900",
              )}
            >
              <Icono className={cx("size-4", activo ? "text-acento" : "text-zinc-500")} aria-hidden />
              {etiqueta}
            </Link>
          )
        })}
    </nav>
  )
}

function Cuenta() {
  const { perfil, cargando, salir } = useSesion()
  if (cargando) return <Esqueleto className="h-11 w-full" />
  if (!perfil) return null
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
        {perfil.nombre.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-zinc-900">{perfil.nombre}</p>
        <p className="truncate text-xs text-zinc-500">{perfil.rol ? nombreRol[perfil.rol] : "Sin acceso"}</p>
      </div>
      <button
        onClick={salir}
        className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function SinAcceso() {
  const { perfil, salir } = useSesion()
  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-50 p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-zinc-950">Tu cuenta aún no está autorizada</h1>
        <p className="text-sm text-zinc-600">
          Iniciaste sesión como <span className="font-medium text-zinc-900">{perfil?.email}</span>, pero ese correo no
          pertenece a un administrador ni a un docente activo. Pide al administrador que registre tu correo en tu ficha
          de docente.
        </p>
        <Boton variante="secundario" onClick={salir}>
          Cerrar sesión
        </Boton>
      </div>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname()
  const { perfil, cargando } = useSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (ruta === "/login") return <>{children}</>
  // El escáner es público: sin sesión se muestra con una barra simple
  if (ruta === "/escaner" && (cargando || !perfil)) return <ShellPublico>{children}</ShellPublico>
  if (!cargando && perfil && !perfil.rol) return <SinAcceso />

  return (
    <div className="min-h-dvh bg-zinc-100/70 lg:grid lg:grid-cols-[248px_1fr]">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 px-3 py-5 lg:flex">
        <Marca />
        <div className="flex-1">
          <Navegacion />
        </div>
        <Cuenta />
      </aside>

      {/* Barra superior (tablet / celular) */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-zinc-100/90 px-4 backdrop-blur lg:hidden">
        <Marca />
        <button
          onClick={() => setMenuAbierto(true)}
          className="grid size-9 place-items-center rounded-lg text-zinc-700 hover:bg-zinc-200"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-zinc-950/30" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-entrar flex-col gap-6 bg-zinc-100 px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Marca />
              <button
                onClick={() => setMenuAbierto(false)}
                className="grid size-9 place-items-center rounded-lg text-zinc-700 hover:bg-zinc-200"
                aria-label="Cerrar menú"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1">
              <Navegacion onNavegar={() => setMenuAbierto(false)} />
            </div>
            <Cuenta />
          </div>
        </div>
      )}

      <main className="min-w-0 lg:py-2 lg:pr-2">
        <div className="min-h-[calc(100dvh-1rem)] bg-white px-4 py-6 sm:px-8 sm:py-8 lg:rounded-xl lg:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.05)]">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  )
}

function ShellPublico({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <div className="sticky top-0 z-30 flex h-14 items-center bg-white/90 px-4 shadow-[0_1px_0_rgb(0_0_0/0.06)] backdrop-blur sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-zinc-950 text-white">
            <BottleWine className="size-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-950">Escáner de botellas</span>
        </span>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  )
}
