"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { BottleWine, ChevronDown, Download, FileUp, ImagePlus, Loader2, RotateCcw } from "lucide-react"
import { Aviso, Boton, Esqueleto, Panel, cx } from "@/components/ui"
import { CLASES, caracteristicas, cargarExtractor, descargarModelo, predecir, type ModeloBotellas } from "@/lib/botellas"
import { escaparCampo } from "@/lib/csv"
import { fechaHoraDe } from "@/lib/fechas"
import { Entrenamiento } from "./entrenamiento"

const CLAVE_LOCAL = "modelo-botellas"

type Resultado = {
  id: string
  nombre: string
  url: string // URL temporal en memoria (blob:), nunca se sube
  estado: "procesando" | "listo" | "error"
  probabilidades?: number[]
  error?: string
}

const tonoClase: Record<string, string> = {
  exito: "bg-exito-suave text-exito",
  aviso: "bg-aviso-suave text-aviso",
  peligro: "bg-peligro-suave text-peligro",
}
const barraClase: Record<string, string> = {
  exito: "bg-exito",
  aviso: "bg-[oklch(0.72_0.14_70)]",
  peligro: "bg-peligro",
}

export default function EscanerPage() {
  const [modelo, setModelo] = useState<ModeloBotellas | null | undefined>(undefined)
  const [origen, setOrigen] = useState<"local" | "publicado" | "archivo">("publicado")
  const [verEntrenar, setVerEntrenar] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const archivoModelo = useRef<HTMLInputElement>(null)
  const [motor, setMotor] = useState<"inactivo" | "cargando" | "listo" | "error">("inactivo")
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])

  useEffect(() => {
    // 1) modelo entrenado en este navegador; 2) modelo publicado (si existe)
    let local: ModeloBotellas | null = null
    try {
      const guardado = localStorage.getItem(CLAVE_LOCAL)
      if (guardado) local = JSON.parse(guardado) as ModeloBotellas
    } catch {
      local = null
    }
    if (local?.version === 1) {
      setTimeout(() => {
        setModelo(local)
        setOrigen("local")
      }, 0)
    } else {
      descargarModelo()
        .then((m) => {
          setModelo(m)
          setOrigen("publicado")
          if (!m) setVerEntrenar(true)
        })
        .catch(() => {
          setModelo(null)
          setVerEntrenar(true)
        })
    }
    const lista = urls.current
    return () => lista.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const procesar = useCallback(
    async (archivos: File[]) => {
      if (!modelo) return
      const imagenes = archivos.filter((f) => f.type.startsWith("image/"))
      if (imagenes.length === 0) return
      const nuevos: Resultado[] = imagenes.map((f, i) => {
        const url = URL.createObjectURL(f)
        urls.current.push(url)
        return { id: `${Date.now()}-${i}`, nombre: f.name, url, estado: "procesando" }
      })
      setResultados((r) => [...nuevos, ...r])
      try {
        setMotor("cargando")
        await cargarExtractor()
        setMotor("listo")
      } catch {
        setMotor("error")
        setResultados((r) =>
          r.map((x) => (nuevos.some((n) => n.id === x.id) ? { ...x, estado: "error", error: "No se pudo cargar el modelo." } : x)),
        )
        return
      }
      for (let i = 0; i < imagenes.length; i++) {
        const id = nuevos[i].id
        try {
          const x = await caracteristicas(imagenes[i])
          const probabilidades = predecir(modelo, x)
          setResultados((r) => r.map((it) => (it.id === id ? { ...it, estado: "listo", probabilidades } : it)))
        } catch {
          setResultados((r) => r.map((it) => (it.id === id ? { ...it, estado: "error", error: "No se pudo leer la imagen." } : it)))
        }
      }
    },
    [modelo],
  )

  function usarModelo(m: ModeloBotellas, desde: "local" | "archivo") {
    setModelo(m)
    setOrigen(desde)
    try {
      localStorage.setItem(CLAVE_LOCAL, JSON.stringify(m))
    } catch {
      // sin almacenamiento local: el modelo sirve mientras la página esté abierta
    }
  }

  async function cargarArchivoModelo(archivo: File | undefined) {
    setErrorArchivo(null)
    if (!archivo) return
    try {
      const m = JSON.parse(await archivo.text()) as ModeloBotellas
      if (m?.version !== 1 || !Array.isArray(m.pesos) || m.sesgo?.length !== CLASES.length) throw new Error()
      usarModelo(m, "archivo")
    } catch {
      setErrorArchivo("El archivo no es un modelo válido del escáner (.json descargado desde aquí).")
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    procesar(Array.from(e.dataTransfer.files))
  }

  function limpiar() {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current = []
    setResultados([])
  }

  function exportar() {
    const filas = resultados.filter((r) => r.estado === "listo" && r.probabilidades)
    const lineas = [
      ["Archivo", "Resultado", "Confianza", ...CLASES.map((c) => c.etiqueta)].map(escaparCampo).join(";"),
      ...filas.map((r) => {
        const p = r.probabilidades!
        const i = p.indexOf(Math.max(...p))
        return [r.nombre, CLASES[i].etiqueta, `${Math.round(p[i] * 100)}%`, ...p.map((v) => `${Math.round(v * 100)}%`)]
          .map(escaparCampo)
          .join(";")
      }),
    ]
    const url = URL.createObjectURL(new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `escaneo_botellas_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const listos = resultados.filter((r) => r.estado === "listo" && r.probabilidades)
  const resumen = CLASES.map((_, i) => listos.filter((r) => r.probabilidades!.indexOf(Math.max(...r.probabilidades!)) === i).length)
  const procesando = resultados.some((r) => r.estado === "procesando")

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Escáner de botellas</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Sube fotos de botellas y el modelo indica si están sin daño, un poco dañadas o muy dañadas. Las fotos se analizan
            en tu navegador y no se guardan en ningún servidor.
          </p>
        </div>
      </header>

      {/* 1. Entrenar modelo */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setVerEntrenar((v) => !v)}
            className="flex items-center gap-2 text-left"
            aria-expanded={verEntrenar}
          >
            <span className="grid size-6 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">1</span>
            <span className="text-lg font-semibold tracking-tight text-zinc-950">Entrenar modelo</span>
            <ChevronDown className={cx("size-4 text-zinc-500 transition-transform", verEntrenar && "rotate-180")} aria-hidden />
          </button>
          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tam="sm" onClick={() => archivoModelo.current?.click()}>
              <FileUp className="size-3.5" aria-hidden /> Cargar modelo (.json)
            </Boton>
            <input
              ref={archivoModelo}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                cargarArchivoModelo(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>
        </div>

        {modelo === undefined ? (
          <Esqueleto className="h-6 w-96 max-w-full" />
        ) : modelo === null ? (
          <Aviso tono="aviso" titulo="Aún no hay un modelo">
            Carga las fotos de referencia en las tres categorías y pulsa “Entrenar modelo”, o carga un modelo descargado antes.
          </Aviso>
        ) : (
          <p className="text-[13px] text-zinc-500">
            {origen === "publicado" ? "Modelo publicado" : origen === "archivo" ? "Modelo cargado desde archivo" : "Modelo entrenado en este navegador"} ·{" "}
            <span className="tabular font-medium text-zinc-800">{Object.values(modelo.imagenes).reduce((a, b) => a + b, 0)}</span>{" "}
            imágenes · exactitud{" "}
            <span className="tabular font-medium text-zinc-800">{Math.round(modelo.metricas.exactitud * 100)} %</span> ·{" "}
            {fechaHoraDe(modelo.creado_en)}
          </p>
        )}
        {errorArchivo && <Aviso tono="peligro">{errorArchivo}</Aviso>}

        {verEntrenar && <Entrenamiento onModelo={(m) => usarModelo(m, "local")} />}
      </section>

      {/* 2. Escanear */}
      <div className="flex items-center gap-2 pt-2">
        <span className="grid size-6 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">2</span>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Escanear botellas</h2>
      </div>

      {/* Zona para soltar fotos */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={cx(
          "flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-10 text-center transition-colors",
          arrastrando ? "bg-acento-suave" : "bg-zinc-50",
          !modelo && "pointer-events-none opacity-50",
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-white text-zinc-700 shadow-sm">
          <BottleWine className="size-6" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-zinc-900">Arrastra aquí las fotos de las botellas</p>
          <p className="text-sm text-zinc-500">o elígelas desde tu equipo. JPG, PNG o WebP; puedes subir varias a la vez.</p>
        </div>
        <Boton onClick={() => entrada.current?.click()} disabled={!modelo}>
          <ImagePlus className="size-4" aria-hidden /> Subir fotos
        </Boton>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            procesar(Array.from(e.target.files ?? []))
            e.target.value = ""
          }}
        />
        {motor === "cargando" && (
          <p className="flex items-center gap-2 text-[13px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Cargando el modelo de visión (solo la primera vez)…
          </p>
        )}
      </div>

      {resultados.length > 0 && (
        <>
          {/* Resumen */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {CLASES.map((c, i) => (
                <span key={c.id} className={cx("tabular inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium", tonoClase[c.tono])}>
                  {c.etiqueta}
                  <span className="text-zinc-950">{resumen[i]}</span>
                </span>
              ))}
              <span className="tabular inline-flex h-8 items-center rounded-lg bg-zinc-100 px-3 text-sm text-zinc-600">
                Total {listos.length}
                {procesando && " · analizando…"}
              </span>
            </div>
            <div className="flex gap-2">
              <Boton variante="secundario" tam="sm" onClick={exportar} disabled={!listos.length}>
                <Download className="size-3.5" aria-hidden /> Exportar CSV
              </Boton>
              <Boton variante="fantasma" tam="sm" onClick={limpiar}>
                <RotateCcw className="size-3.5" aria-hidden /> Limpiar
              </Boton>
            </div>
          </div>

          {/* Resumen por imagen */}
          <Panel className="overflow-hidden">
            <div className="px-5 pb-2 pt-4">
              <h2 className="text-[15px] font-semibold text-zinc-950">Resumen por imagen</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs font-medium text-zinc-500">
                    <th className="px-5 py-2.5">#</th>
                    <th className="px-5 py-2.5">Imagen</th>
                    <th className="px-5 py-2.5">Resultado</th>
                    <th className="px-5 py-2.5 text-right">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados
                    .slice()
                    .reverse()
                    .map((r, n) => {
                      const p = r.probabilidades
                      const i = p ? p.indexOf(Math.max(...p)) : -1
                      const clase = i >= 0 ? CLASES[i] : null
                      return (
                        <tr key={r.id} className="[&+&]:shadow-[0_-1px_0_rgb(0_0_0/0.05)]">
                          <td className="tabular px-5 py-2.5 text-zinc-500">{n + 1}</td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={r.url} alt="" className="size-9 shrink-0 rounded-md bg-zinc-100 object-cover" />
                              <span className="max-w-64 truncate text-zinc-800" title={r.nombre}>
                                {r.nombre}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5">
                            {clase ? (
                              <span className={cx("rounded-md px-2 py-1 text-xs font-semibold", tonoClase[clase.tono])}>{clase.etiqueta}</span>
                            ) : r.estado === "error" ? (
                              <span className="text-[13px] text-peligro">{r.error}</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[13px] text-zinc-500">
                                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Analizando…
                              </span>
                            )}
                          </td>
                          <td className="tabular px-5 py-2.5 text-right text-zinc-700">{p && i >= 0 ? `${Math.round(p[i] * 100)} %` : "—"}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Resultados */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resultados.map((r) => {
              const p = r.probabilidades
              const i = p ? p.indexOf(Math.max(...p)) : -1
              const clase = i >= 0 ? CLASES[i] : null
              return (
                <li key={r.id}>
                  <Panel className="overflow-hidden">
                    <div className="relative aspect-square bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.url} alt={r.nombre} className="h-full w-full object-cover" />
                      {clase && (
                        <span className={cx("absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-semibold shadow-sm", tonoClase[clase.tono])}>
                          {clase.etiqueta}
                        </span>
                      )}
                      {r.estado === "procesando" && (
                        <div className="absolute inset-0 grid place-items-center bg-white/60 text-sm text-zinc-700 backdrop-blur-sm">
                          <span className="flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando…
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="truncate text-[13px] text-zinc-500" title={r.nombre}>
                        {r.nombre}
                      </p>
                      {r.estado === "error" && <p className="text-[13px] text-peligro">{r.error}</p>}
                      {p && clase && (
                        <>
                          <p className="text-sm text-zinc-900">
                            <span className="font-semibold">{clase.etiqueta}</span>{" "}
                            <span className="tabular text-zinc-500">· {Math.round(p[i] * 100)} % de confianza</span>
                          </p>
                          <div className="space-y-1.5">
                            {CLASES.map((c, j) => (
                              <div key={c.id} className="grid grid-cols-[96px_1fr_36px] items-center gap-2 text-xs text-zinc-600">
                                <span className="truncate">{c.etiqueta}</span>
                                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                                  <div className={cx("h-full rounded-full", barraClase[c.tono])} style={{ width: `${p[j] * 100}%` }} />
                                </div>
                                <span className="tabular text-right">{Math.round(p[j] * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </Panel>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
