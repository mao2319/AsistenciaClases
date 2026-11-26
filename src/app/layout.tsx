import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SesionProvider } from "@/components/sesion"
import { Shell } from "@/components/shell"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Asistencia Face ID ESAVE", template: "%s · Asistencia Face ID ESAVE" },
  description: "Registro de asistencia a clase por reconocimiento facial.",
}

export const viewport: Viewport = {
  themeColor: "#f4f4f5",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SesionProvider>
          <Shell>
            <Suspense fallback={<CargandoPagina />}>{children}</Suspense>
          </Shell>
        </SesionProvider>
      </body>
    </html>
  )
}

function CargandoPagina() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-100" />
      <div className="h-4 w-80 animate-pulse rounded-md bg-zinc-100" />
      <div className="mt-8 h-64 animate-pulse rounded-xl bg-zinc-100" />
    </div>
  )
}
