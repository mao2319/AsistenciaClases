"use client"

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react"

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

/* ------------------------------------------------------------------ Botón */
type Variante = "primario" | "secundario" | "fantasma" | "peligro"
const variantes: Record<Variante, string> = {
  primario: "bg-acento text-white hover:bg-acento-hover shadow-sm",
  secundario: "bg-white text-zinc-800 hover:bg-zinc-50 shadow-sm ring-1 ring-inset ring-zinc-950/10",
  fantasma: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  peligro: "bg-peligro-suave text-peligro hover:bg-[oklch(0.93_0.04_27)]",
}

export function clasesBoton(variante: Variante = "primario", tam: "sm" | "md" | "lg" = "md", extra?: string) {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
    tam === "sm" && "h-8 px-3 text-[13px]",
    tam === "md" && "h-9 px-3.5 text-sm",
    tam === "lg" && "h-11 px-5 text-[15px]",
    variantes[variante],
    extra,
  )
}

export const Boton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean; tam?: "sm" | "md" | "lg" }
>(function Boton({ variante = "primario", cargando, tam = "md", className, children, disabled, ...props }, ref) {
  return (
    <button ref={ref} disabled={disabled || cargando} className={clasesBoton(variante, tam, className)} {...props}>
      {cargando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/** Enlace con apariencia de botón. */
export function BotonEnlace({
  href,
  variante = "primario",
  tam = "md",
  className,
  children,
}: {
  href: string
  variante?: Variante
  tam?: "sm" | "md" | "lg"
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={clasesBoton(variante, tam, className)}>
      {children}
    </Link>
  )
}

/* ---------------------------------------------------------- Formularios */
const campoBase =
  "w-full rounded-lg bg-white px-3 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-950/10 placeholder:text-zinc-500 transition-shadow focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500 aria-[invalid=true]:bg-peligro-suave"

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx(campoBase, "h-9", className)} {...props} />
})

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Selector(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cx(campoBase, "h-9 pr-8", className)} {...props}>
      {children}
    </select>
  )
})

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AreaTexto({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx(campoBase, "min-h-20 py-2", className)} {...props} />
  },
)

export function Campo({
  etiqueta,
  ayuda,
  error,
  htmlFor,
  children,
  className,
}: {
  etiqueta: string
  ayuda?: string
  error?: string | null
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-zinc-700">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-peligro">{error}</p>
      ) : ayuda ? (
        <p className="text-[13px] text-zinc-500">{ayuda}</p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------- Avisos */
type Tono = "info" | "exito" | "aviso" | "peligro" | "neutro"
const tonos: Record<Tono, { caja: string; icono: ReactNode }> = {
  info: { caja: "bg-acento-suave text-acento-tinta", icono: <Info className="size-4" aria-hidden /> },
  exito: { caja: "bg-exito-suave text-exito", icono: <CheckCircle2 className="size-4" aria-hidden /> },
  aviso: { caja: "bg-aviso-suave text-aviso", icono: <AlertTriangle className="size-4" aria-hidden /> },
  peligro: { caja: "bg-peligro-suave text-peligro", icono: <XCircle className="size-4" aria-hidden /> },
  neutro: { caja: "bg-zinc-100 text-zinc-700", icono: <Info className="size-4" aria-hidden /> },
}

export function Aviso({ tono = "info", titulo, children, className }: { tono?: Tono; titulo?: string; children?: ReactNode; className?: string }) {
  const t = tonos[tono]
  return (
    <div role={tono === "peligro" ? "alert" : "status"} className={cx("flex gap-3 rounded-lg px-3.5 py-3 text-sm", t.caja, className)}>
      <span className="mt-0.5 shrink-0">{t.icono}</span>
      <div className="space-y-0.5">
        {titulo && <p className="font-medium">{titulo}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  )
}

export function Etiqueta({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium", tonos[tono].caja)}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ Estructura */
export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 text-balance">{titulo}</h1>
        {descripcion && <p className="text-sm text-zinc-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.06)]", className)}>{children}</section>
}

export function TituloPanel({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
      <div>
        <h2 className="text-[15px] font-semibold text-zinc-950">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-[13px] text-zinc-500">{descripcion}</p>}
      </div>
      {acciones}
    </div>
  )
}

export function Vacio({ icono, titulo, children }: { icono?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icono && <div className="mb-3 grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500">{icono}</div>}
      <p className="text-sm font-medium text-zinc-900">{titulo}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-zinc-500">{children}</div>}
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-zinc-100", className)} />
}

export function FilasEsqueleto({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-2 px-5 py-4">
      {Array.from({ length: filas }).map((_, i) => (
        <Esqueleto key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Avatar */
export function Avatar({ url, nombre, tam = 32 }: { url?: string | null; nombre: string; tam?: number }) {
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Foto de ${nombre}`} width={tam} height={tam} className="shrink-0 rounded-full bg-zinc-100 object-cover" style={{ width: tam, height: tam }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-zinc-200 font-semibold text-zinc-600"
      style={{ width: tam, height: tam, fontSize: Math.max(10, tam * 0.36) }}
      aria-hidden
    >
      {iniciales}
    </span>
  )
}

/* ------------------------------------------------- Confirmar eliminación */
export function ConfirmarEliminar({
  texto,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  texto: ReactNode
  cargando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="flex animate-entrar flex-col gap-3 rounded-lg bg-peligro-suave px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-peligro">{texto}</p>
      <div className="flex shrink-0 gap-2">
        <Boton variante="fantasma" tam="sm" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton tam="sm" className="bg-peligro hover:bg-[oklch(0.45_0.18_27)]" cargando={cargando} onClick={onConfirmar}>
          Eliminar
        </Boton>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Tabla */
export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  )
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx("whitespace-nowrap bg-zinc-50 px-5 py-2.5 text-xs font-medium text-zinc-500 first:rounded-tl-none", className)}>
      {children}
    </th>
  )
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("px-5 py-3 align-middle text-zinc-700", className)}>
      {children}
    </td>
  )
}
export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cx("transition-colors hover:bg-zinc-50/70 [&+&]:shadow-[0_-1px_0_rgb(0_0_0/0.05)]", className)}>{children}</tr>
}

/* --------------------------------------------------------------- Pestañas */
export function Pestanas<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T
  opciones: { valor: T; etiqueta: string; cuenta?: number }[]
  onCambio: (v: T) => void
}) {
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-zinc-100 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={cx(
            "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
            valor === o.valor ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          {o.etiqueta}
          {o.cuenta !== undefined && <span className="tabular text-xs text-zinc-500">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  )
}
