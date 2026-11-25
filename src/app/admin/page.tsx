"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { useSesion } from "@/components/sesion"
import { Aviso, Encabezado, Panel, Pestanas, Vacio } from "@/components/ui"
import { listarDocentes, listarGrupos, type Docente, type Estudiante, type Grupo } from "@/lib/datos"
import { mensajeError, supabase } from "@/lib/supabase/cliente"
import { TablaEstudiantes } from "./estudiantes"
import { TablaDocentes } from "./docentes"
import { TablaGrupos } from "./grupos"

type Pestana = "estudiantes" | "docentes" | "grupos"

export type DatosAdmin = {
  estudiantes: Estudiante[]
  docentes: Docente[]
  grupos: Grupo[]
  muestras: Record<number, number>
}

export default function AdminPage() {
  const { perfil, cargando } = useSesion()
  const [pestana, setPestana] = useState<Pestana>("estudiantes")
  const [datos, setDatos] = useState<DatosAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      const sb = supabase()
      const [e, d, g, m] = await Promise.all([
        sb.from("estudiante").select("*").order("apellidos"),
        listarDocentes(false),
        listarGrupos(),
        sb.from("estudiante_enrolamiento").select("*"),
      ])
      if (e.error) throw e.error
      if (m.error) throw m.error
      const muestras: Record<number, number> = {}
      for (const f of m.data) if (f.estudiante_id) muestras[f.estudiante_id] = f.muestras ?? 0
      setDatos({ estudiantes: e.data, docentes: d, grupos: g, muestras })
      setError(null)
    } catch (e) {
      setError(mensajeError(e as { message?: string }))
    }
  }, [])

  useEffect(() => {
    if (perfil?.rol !== "admin") return
    const t = setTimeout(recargar, 0)
    return () => clearTimeout(t)
  }, [perfil, recargar])

  if (!cargando && perfil?.rol !== "admin") {
    return (
      <Panel>
        <Vacio icono={<ShieldAlert className="size-5" aria-hidden />} titulo="Acceso restringido">
          El módulo de administración solo está disponible para cuentas de administrador.
        </Vacio>
      </Panel>
    )
  }

  return (
    <>
      <Encabezado
        titulo="Administración"
        descripcion="Gestiona estudiantes, docentes y grupos. Los registros no se borran: se desactivan."
      />
      {error && (
        <Aviso tono="peligro" className="mb-6">
          {error}
        </Aviso>
      )}
      <div className="mb-5">
        <Pestanas
          valor={pestana}
          onCambio={setPestana}
          opciones={[
            { valor: "estudiantes", etiqueta: "Estudiantes", cuenta: datos?.estudiantes.length },
            { valor: "docentes", etiqueta: "Docentes", cuenta: datos?.docentes.length },
            { valor: "grupos", etiqueta: "Grupos", cuenta: datos?.grupos.length },
          ]}
        />
      </div>
      {pestana === "estudiantes" && <TablaEstudiantes datos={datos} onCambio={recargar} />}
      {pestana === "docentes" && <TablaDocentes datos={datos} onCambio={recargar} />}
      {pestana === "grupos" && <TablaGrupos datos={datos} onCambio={recargar} />}
    </>
  )
}
