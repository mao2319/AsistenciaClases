# Plan: Sistema de asistencia por reconocimiento facial — versión web (Vercel + Supabase)

Aplicación web para llamar a lista con la cámara del navegador. Cada registro de asistencia queda asociado a **un estudiante, un docente y una sesión de clase**.

## 1. ¿Se necesita Supabase? Sí

Vercel ejecuta funciones *serverless* sin disco persistente: un SQLite local se perdería en cada despliegue o arranque en frío, y el criterio 3 exige que los cambios **se conserven al reiniciar**. Hace falta una base de datos administrada. Supabase cubre en un solo servicio lo que pide la rúbrica:

| Necesidad | Supabase |
|---|---|
| Persistencia (criterio 3) | Postgres |
| Cuenta de administrador (criterio 3) | Supabase Auth (email + contraseña) + tabla de perfiles con rol |
| Comparar rostros | Extensión **pgvector** (`vector(128)`, distancia `<->`) |
| Seguridad | Row Level Security (RLS) + funciones RPC |

Alternativa descartada: Neon/Vercel Postgres + auth propia → más código para el mismo resultado.

**Infraestructura creada (2026-11-25):**

| Servicio | Recurso |
|---|---|
| Supabase | Proyecto `asistencia-esave`, ref `kizkpigoilzqgtwbghrb`, `us-east-1`, URL `https://kizkpigoilzqgtwbghrb.supabase.co` |
| Vercel | Proyecto `asistencia-esave` (equipo Ventas365), framework Next.js, variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cargadas |
| GitHub | `mao2319/AsistenciaClases` (rama `main`) — **pendiente vincular a Vercel** |

## 2. Arquitectura

```
Navegador (cámara, HTTPS)                Vercel (Next.js)              Supabase
┌──────────────────────────┐           ┌──────────────────┐        ┌────────────────────────┐
│ getUserMedia → <video>    │           │ Páginas + SSR     │        │ Auth (admin, operador)  │
│ face-api: detecta rostro  │──login───▶│ middleware de     │──────▶ │ Postgres + RLS          │
│ y calcula descriptor 128-d│           │ sesión (@supabase/ │        │ pgvector                │
│                           │──RPC──────┼──────────ssr)─────┼──────▶ │ registrar_asistencia()  │
└──────────────────────────┘           └──────────────────┘        └────────────────────────┘
```

- **El reconocimiento corre en el navegador** con `@vladmandic/face-api` (modelos en `/public/models`). Vercel no puede correr OpenCV/TensorFlow pesado en funciones serverless, y así no se envían fotos al servidor.
- **El navegador solo envía el vector** (128 números). La comparación ocurre en Postgres; los descriptores de los estudiantes **nunca se descargan** al cliente.
- La cámara requiere HTTPS → Vercel lo da por defecto (en local, `localhost` también funciona).

| Pieza | Elección |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| UI | Tailwind CSS + componentes simples |
| Rostros | `@vladmandic/face-api` (TinyFaceDetector + FaceLandmark68 + FaceRecognition) |
| Datos/Auth | `@supabase/supabase-js` + `@supabase/ssr` |
| Pruebas | Vitest (lógica/validaciones) + pruebas SQL de las RPC |
| Zona horaria | `America/Bogota` (se guarda `timestamptz`) |

## 3. Modelo de datos (Postgres)

```sql
perfil(id uuid → auth.users, nombre, rol 'admin'|'operador')
docente(id, documento UNIQUE, nombres, apellidos, activo bool)
grupo(id, nombre UNIQUE)
estudiante(id, documento UNIQUE, nombres, apellidos, grupo_id, activo bool)
rostro(id, estudiante_id, descriptor vector(128), creado_en)      -- 3–5 muestras
sesion(id, docente_id, grupo_id, asignatura, fecha date, hora_inicio time, hora_fin time,
       CHECK (hora_fin > hora_inicio))
asistencia(id, sesion_id, estudiante_id, docente_id, registrada_en timestamptz,
           metodo 'FACIAL'|'MANUAL', motivo text NULL,
           UNIQUE (sesion_id, estudiante_id))                     -- impide doble registro
```

**Funciones RPC (`security definer`, validan rol):**
- `registrar_asistencia(p_sesion_id, p_descriptor)` → busca el rostro más cercano de estudiantes **activos**; devuelve uno de:
  - `REGISTRADO` (nombre, hora) · `DUPLICADO` (hora del primer registro) · `DESCONOCIDO` (distancia > 0,5) · `OTRO_GRUPO`.
  - Toma `docente_id` de la sesión y lo guarda en la asistencia (criterio 4).
- `enrolar_rostro(p_estudiante_id, p_descriptores vector[])` → solo admin.

**RLS:** lectura para usuarios autenticados; escritura de docentes/estudiantes/grupos/rostros solo `rol = 'admin'`; `asistencia` solo vía RPC. "Desactivar" = `activo = false` (no se borra nada).

## 4. Páginas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/login` | público | Supabase Auth |
| `/asistencia` | autenticado | Selector de docente activo → sus grupos y sesiones del día → sesión activa → cámara en vivo con avisos |
| `/calendario` | autenticado | Crear sesión (docente, grupo, asignatura, fecha, horas), listar por fecha, "usar como sesión activa" |
| `/historial` | autenticado | Asistencia por fecha (+ filtros docente/sesión), columna **Docente**, exportar CSV |
| `/admin/estudiantes`, `/admin/docentes`, `/admin/grupos` | **solo admin** (middleware + RLS) | Agregar, editar, desactivar/activar, **enrolar rostro** |

## 5. Fases de construcción

**Fase 0 – Infraestructura.** Crear proyecto Supabase, `create-next-app`, variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, proyecto en Vercel (equipo `Ventas365`) y primer despliegue "hola mundo". Spike: página que abre la cámara y dibuja el rostro con face-api en el dominio de Vercel.

**Fase 1 – Base de datos.** Migraciones: tablas, pgvector, índices, RLS, RPCs. `supabase/seed.sql` con datos ficticios (2 docentes, 2 grupos, 6 estudiantes, sesiones de hoy y mañana) y usuario admin de demo. Revisar *advisors* de seguridad de Supabase.

**Fase 2 – Auth y administración (criterio 3).** Login, middleware que protege `/admin/*` según `perfil.rol`, CRUD con validaciones (documento único, campos obligatorios), desactivar/activar.

**Fase 3 – Enrolamiento (criterio 1a).** En la ficha del estudiante: cámara, captura 5 muestras válidas (exactamente un rostro), envía los descriptores a `enrolar_rostro`.

**Fase 4 – Calendario (criterio 2).** Crear/seleccionar sesiones; validar horas y cruces del mismo grupo; consulta por fecha.

**Fase 5 – Toma de asistencia (criterios 1b, 1c, 4a).** Selector de docente activo → sesiones → cámara. Detección cada ~500 ms; al estabilizarse un rostro, llama `registrar_asistencia` y muestra aviso verde / amarillo / rojo. Enfriamiento de 3 s por rostro para no repetir llamadas.

**Fase 6 – Historial (criterios 2b, 4b).** Tabla por fecha con estudiante, grupo, sesión, docente, hora, método.

**Fase 7 – Función adicional (criterio 5).** **Exportar CSV + reporte de inasistencias** (presentes y ausentes del grupo de la sesión), generado en un *route handler* `/api/reportes/[sesionId]` con BOM UTF-8 para Excel.
- Válido: sesión con datos → descarga `asistencia_2026-11-25_<grupo>.csv`.
- Error: sesión inexistente / fecha inválida → respuesta 400 con mensaje en pantalla.
- Opcional: corrección manual con motivo obligatorio (`metodo = 'MANUAL'`).

**Fase 8 – Pruebas y entrega.** Vitest para validaciones y CSV; pruebas SQL de RLS y de `registrar_asistencia` (duplicado, desconocido, otro grupo). README con instalación local, variables de entorno y URL de Vercel. Ensayar la demo en el equipo/navegador del salón.

## 6. Rúbrica → dónde se cumple

| Criterio | Pts | Fase |
|---|---|---|
| Enrolar y reconocer desde cámara | 0,50 | 3, 5 |
| Registrar en sesión activa con fecha y hora | 0,50 | 5 |
| Aviso de desconocido + evitar doble registro | 0,50 | 1 (UNIQUE + RPC), 5 |
| Crear/seleccionar sesión por fecha, hora y grupo | 0,50 | 4 |
| Consultar sesiones y asistencia por fecha | 0,50 | 4, 6 |
| Acceso restringido con cuenta admin | 0,50 | 2 |
| CRUD + desactivar, persiste al reiniciar | 0,50 | 1, 2 |
| Elegir docente activo y ver sus grupos/sesiones | 0,50 | 5 |
| Asistencia asociada al docente en el historial | 0,25 | 5, 6 |
| Función adicional integrada | 0,50 | 7 |
| Explicación + caso válido y caso de error | 0,25 | 7, 8 |
| **Total** | **5,00** | |

## 7. Guion de demostración

1. Abrir la URL de Vercel → login fallido → login como admin.
2. Admin: editar estudiante, desactivar docente, recargar la página (persistencia).
3. Enrolar al voluntario autorizado.
4. Asistencia → elegir docente activo → ver sus sesiones → Calendario: programar clase y activarla.
5. Voluntario a cámara → REGISTRADO con hora. Repetir → DUPLICADO. Persona no enrolada → DESCONOCIDO.
6. Historial por fecha → columna Docente.
7. Exportar CSV (válido) y forzar el caso de error.

## 8. Riesgos

- **Wi-Fi del salón** → la app depende de internet; llevar hotspot del celular de respaldo.
- **Permiso de cámara** del navegador → probar antes en el equipo de la demo; Chrome recomendado.
- **Carga de modelos** (~7 MB) la primera vez → precargar al abrir `/asistencia`.
- **Umbral 0,5** → ajustable en configuración; probar con la iluminación real.
- **Proyecto Supabase gratuito pausado** por inactividad (7 días) → abrir la app el día anterior.
- **GitHub MCP con token vencido** → desplegar con Vercel CLI o renovar el token para despliegue por Git.
