# Pase de lista — Asistencia por reconocimiento facial

Proyecto final de Programación I (ESAVE). Aplicación web que llama a lista con la cámara: cada registro queda asociado a **un estudiante, un docente y una sesión de clase**.

- **Frontend:** Next.js 16 + Tailwind CSS 4 (desplegado en Vercel)
- **Reconocimiento facial:** `@vladmandic/face-api` en el navegador (solo se envía un vector de 128 números; no se guardan fotos)
- **Datos y cuentas:** Supabase (Postgres + Auth + pgvector + RLS)

## Funciones según la rúbrica

| Criterio | Dónde |
|---|---|
| Enrolar y reconocer el rostro | Administración › Estudiantes › **Enrolar** · Tomar asistencia |
| Registrar asistencia con fecha y hora | Tomar asistencia (función SQL `registrar_asistencia`) |
| Aviso de rostro desconocido y sin doble registro | Tomar asistencia (restricción `UNIQUE(sesion_id, estudiante_id)`) |
| Crear/seleccionar sesión por fecha, hora y grupo | Calendario › Programar clase · Tomar asistencia |
| Consultar sesiones y asistencia por fecha | Calendario · Historial |
| Acceso restringido al administrador | `/admin` (proxy + políticas RLS) |
| Agregar, editar y desactivar estudiantes y docentes | Administración (los datos persisten en Postgres) |
| Selector de docente activo con sus grupos/sesiones | Tomar asistencia |
| Asistencia asociada al docente en el historial | Historial (columna Docente) |
| Función adicional | **Exportar CSV con inasistencias** (Historial) y **corrección manual con motivo** (Tomar asistencia) |

La función adicional está documentada en `src/lib/csv.ts` y probada en `src/lib/csv.test.ts` (casos válidos y de error).

## Ejecutar en local

Requisitos: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # completar con la URL y la clave publicable de Supabase
npm run dev                  # http://localhost:3000
npm test                     # pruebas de la función adicional
```

Variables de entorno:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Opcional, solo servidor: permite al admin crear cuentas de docentes desde la app |

La cámara necesita `localhost` o HTTPS.

## Cuenta de administrador

1. Supabase › **Authentication › Users › Add user**: correo + contraseña, marcar *Auto Confirm User*.
2. Registrar ese correo como administrador (Supabase › SQL Editor):

```sql
insert into public.cuenta (email, nombre, rol)
values ('correo-del-admin@ejemplo.com', 'Nombre del administrador', 'admin');
```

Los **docentes** inician sesión con el correo guardado en su ficha (Administración › Docentes). El botón **Acceso** les crea la cuenta con una contraseña temporal (requiere `SUPABASE_SECRET_KEY`).

## Base de datos

Migraciones en `supabase/migrations/` y datos ficticios en `supabase/seed.sql` (2 grupos, 3 docentes —uno inactivo—, 6 estudiantes y sesiones de hoy y mañana). Los rostros no se siembran: se enrolan en vivo con voluntarios autorizados.

## Guion de demostración

1. Iniciar sesión como administrador (probar antes una contraseña incorrecta).
2. Administración: editar un estudiante, desactivar un docente y recargar la página.
3. Enrolar al voluntario.
4. Tomar asistencia: elegir docente activo → ver sus grupos y sesiones → (Calendario: programar una clase) → elegir la sesión.
5. Voluntario a cámara → **registrado** con hora. Repetir → **ya registrado**. Persona no enrolada → **rostro no reconocido**.
6. Historial por fecha → columna Docente.
7. Exportar CSV (válido) y sin elegir sesión (error). Corrección manual con y sin motivo.
