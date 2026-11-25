// Fotos de docentes en Supabase Storage (bucket privado "fotos-docentes").
import { supabase } from "./supabase/cliente"

const BUCKET = "fotos-docentes"
const LADO = 400 // px del recorte cuadrado final
const MAX_ENTRADA = 8 * 1024 * 1024

export class ErrorFoto extends Error {}

/** Valida la imagen elegida y la recorta a un cuadrado de 400 px en WebP (liviana). */
export async function prepararFoto(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) throw new ErrorFoto("El archivo debe ser una imagen (JPG, PNG o WebP).")
  if (archivo.size > MAX_ENTRADA) throw new ErrorFoto("La imagen pesa más de 8 MB. Elige una más liviana.")
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new ErrorFoto("No se pudo leer la imagen.")
  })
  const lado = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = LADO
  canvas.height = LADO
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, LADO, LADO)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85))
  if (!blob) throw new ErrorFoto("No se pudo procesar la imagen.")
  return blob
}

/** Sube la foto, la asocia al docente y borra la anterior. Devuelve la nueva ruta. */
export async function guardarFotoDocente(docenteId: number, foto: Blob, anterior: string | null): Promise<string> {
  const sb = supabase()
  const ruta = `docente-${docenteId}-${Date.now()}.webp`
  const subida = await sb.storage.from(BUCKET).upload(ruta, foto, { contentType: "image/webp", upsert: false })
  if (subida.error) throw new ErrorFoto(`No se pudo subir la foto: ${subida.error.message}`)
  const { error } = await sb.from("docente").update({ foto_path: ruta }).eq("id", docenteId)
  if (error) throw new ErrorFoto(`No se pudo guardar la foto: ${error.message}`)
  if (anterior) await sb.storage.from(BUCKET).remove([anterior])
  return ruta
}

export async function quitarFotoDocente(docenteId: number, anterior: string): Promise<void> {
  const sb = supabase()
  const { error } = await sb.from("docente").update({ foto_path: null }).eq("id", docenteId)
  if (error) throw new ErrorFoto(`No se pudo quitar la foto: ${error.message}`)
  await sb.storage.from(BUCKET).remove([anterior])
}

/** URLs firmadas (1 hora) para mostrar las fotos privadas. */
export async function urlsFotos(rutas: (string | null)[]): Promise<Record<string, string>> {
  const validas = [...new Set(rutas.filter((r): r is string => Boolean(r)))]
  if (validas.length === 0) return {}
  const { data } = await supabase().storage.from(BUCKET).createSignedUrls(validas, 3600)
  const mapa: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl
  return mapa
}
