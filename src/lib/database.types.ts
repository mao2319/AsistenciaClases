// Tipos generados desde Supabase (proyecto asistencia-esave).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" }
  public: {
    Tables: {
      asistencia: {
        Row: {
          docente_id: number
          estudiante_id: number
          id: number
          metodo: string
          motivo: string | null
          registrada_en: string
          registrada_por: string
          sesion_id: number
        }
        Insert: {
          docente_id: number
          estudiante_id: number
          id?: never
          metodo: string
          motivo?: string | null
          registrada_en?: string
          registrada_por: string
          sesion_id: number
        }
        Update: Partial<Database["public"]["Tables"]["asistencia"]["Insert"]>
        Relationships: [
          { foreignKeyName: "asistencia_docente_id_fkey"; columns: ["docente_id"]; isOneToOne: false; referencedRelation: "docente"; referencedColumns: ["id"] },
          { foreignKeyName: "asistencia_estudiante_id_fkey"; columns: ["estudiante_id"]; isOneToOne: false; referencedRelation: "estudiante"; referencedColumns: ["id"] },
          { foreignKeyName: "asistencia_sesion_id_fkey"; columns: ["sesion_id"]; isOneToOne: false; referencedRelation: "sesion"; referencedColumns: ["id"] },
        ]
      }
      cuenta: {
        Row: { creado_en: string; email: string; nombre: string; rol: string }
        Insert: { creado_en?: string; email: string; nombre: string; rol: string }
        Update: { creado_en?: string; email?: string; nombre?: string; rol?: string }
        Relationships: []
      }
      docente: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellidos: string
          creado_en: string
          documento: string
          email: string | null
          id: number
          nombres: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellidos: string
          creado_en?: string
          documento: string
          email?: string | null
          id?: never
          nombres: string
        }
        Update: Partial<Database["public"]["Tables"]["docente"]["Insert"]>
        Relationships: []
      }
      estudiante: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellidos: string
          creado_en: string
          documento: string
          grupo_id: number
          id: number
          nombres: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellidos: string
          creado_en?: string
          documento: string
          grupo_id: number
          id?: never
          nombres: string
        }
        Update: Partial<Database["public"]["Tables"]["estudiante"]["Insert"]>
        Relationships: [
          { foreignKeyName: "estudiante_grupo_id_fkey"; columns: ["grupo_id"]; isOneToOne: false; referencedRelation: "grupo"; referencedColumns: ["id"] },
        ]
      }
      grupo: {
        Row: { creado_en: string; id: number; nombre: string }
        Insert: { creado_en?: string; id?: never; nombre: string }
        Update: { creado_en?: string; id?: never; nombre?: string }
        Relationships: []
      }
      rostro: {
        Row: { creado_en: string; descriptor: string; estudiante_id: number; id: number }
        Insert: { creado_en?: string; descriptor: string; estudiante_id: number; id?: never }
        Update: { creado_en?: string; descriptor?: string; estudiante_id?: number; id?: never }
        Relationships: [
          { foreignKeyName: "rostro_estudiante_id_fkey"; columns: ["estudiante_id"]; isOneToOne: false; referencedRelation: "estudiante"; referencedColumns: ["id"] },
        ]
      }
      sesion: {
        Row: {
          asignatura: string
          creado_en: string
          docente_id: number
          fecha: string
          grupo_id: number
          hora_fin: string
          hora_inicio: string
          id: number
        }
        Insert: {
          asignatura: string
          creado_en?: string
          docente_id: number
          fecha: string
          grupo_id: number
          hora_fin: string
          hora_inicio: string
          id?: never
        }
        Update: Partial<Database["public"]["Tables"]["sesion"]["Insert"]>
        Relationships: [
          { foreignKeyName: "sesion_docente_id_fkey"; columns: ["docente_id"]; isOneToOne: false; referencedRelation: "docente"; referencedColumns: ["id"] },
          { foreignKeyName: "sesion_grupo_id_fkey"; columns: ["grupo_id"]; isOneToOne: false; referencedRelation: "grupo"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      asistencia_detalle: {
        Row: {
          asignatura: string | null
          docente: string | null
          docente_id: number | null
          estudiante: string | null
          estudiante_documento: string | null
          estudiante_id: number | null
          fecha: string | null
          grupo: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: number | null
          metodo: string | null
          motivo: string | null
          registrada_en: string | null
          registrada_por: string | null
          sesion_id: number | null
        }
        Relationships: Rel[]
      }
      estudiante_enrolamiento: {
        Row: { estudiante_id: number | null; muestras: number | null }
        Relationships: Rel[]
      }
    }
    Functions: {
      docente_actual_id: { Args: never; Returns: number }
      es_admin: { Args: never; Returns: boolean }
      es_personal: { Args: never; Returns: boolean }
      puede_operar_sesion: { Args: { p_docente_id: number }; Returns: boolean }
      registrar_asistencia: { Args: { p_descriptor: string; p_sesion_id: number }; Returns: Json }
      registrar_asistencia_manual: {
        Args: { p_estudiante_id: number; p_motivo: string; p_sesion_id: number }
        Returns: Json
      }
      reporte_sesion: {
        Args: { p_sesion_id: number }
        Returns: {
          apellidos: string
          documento: string
          estado: string
          metodo: string | null
          motivo: string | null
          nombres: string
          registrada_en: string | null
        }[]
      }
      rol_actual: { Args: never; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Fila<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type FilaVista<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]
