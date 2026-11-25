-- =====================================================================
-- Sistema de asistencia por reconocimiento facial - ESAVE
-- Esquema principal
-- =====================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- Cuentas autorizadas para usar la aplicación.
-- AQUÍ SE REGISTRA EL CORREO DEL ADMINISTRADOR (rol = 'admin').
-- El usuario además debe existir en Authentication > Users con el mismo correo.
-- ---------------------------------------------------------------------
create table public.cuenta (
  email      text primary key check (email = lower(email)),
  nombre     text not null,
  rol        text not null check (rol in ('admin', 'operador')),
  creado_en  timestamptz not null default now()
);

create table public.docente (
  id              bigint generated always as identity primary key,
  documento       text not null unique check (length(trim(documento)) > 0),
  nombres         text not null check (length(trim(nombres)) > 0),
  apellidos       text not null check (length(trim(apellidos)) > 0),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table public.grupo (
  id         bigint generated always as identity primary key,
  nombre     text not null unique check (length(trim(nombre)) > 0),
  creado_en  timestamptz not null default now()
);

create table public.estudiante (
  id              bigint generated always as identity primary key,
  documento       text not null unique check (length(trim(documento)) > 0),
  nombres         text not null check (length(trim(nombres)) > 0),
  apellidos       text not null check (length(trim(apellidos)) > 0),
  grupo_id        bigint not null references public.grupo (id),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index estudiante_grupo_id_idx on public.estudiante (grupo_id);

-- Descriptores faciales (128 números por muestra). No se guardan fotos.
create table public.rostro (
  id             bigint generated always as identity primary key,
  estudiante_id  bigint not null references public.estudiante (id) on delete cascade,
  descriptor     extensions.vector(128) not null,
  creado_en      timestamptz not null default now()
);
create index rostro_estudiante_id_idx on public.rostro (estudiante_id);

create table public.sesion (
  id           bigint generated always as identity primary key,
  docente_id   bigint not null references public.docente (id),
  grupo_id     bigint not null references public.grupo (id),
  asignatura   text not null check (length(trim(asignatura)) > 0),
  fecha        date not null,
  hora_inicio  time not null,
  hora_fin     time not null,
  creado_en    timestamptz not null default now(),
  constraint sesion_horas_validas check (hora_fin > hora_inicio)
);
create index sesion_fecha_idx on public.sesion (fecha);
create index sesion_docente_id_idx on public.sesion (docente_id);
create index sesion_grupo_id_idx on public.sesion (grupo_id);

create table public.asistencia (
  id              bigint generated always as identity primary key,
  sesion_id       bigint not null references public.sesion (id) on delete cascade,
  estudiante_id   bigint not null references public.estudiante (id),
  docente_id      bigint not null references public.docente (id),
  registrada_en   timestamptz not null default now(),
  metodo          text not null check (metodo in ('FACIAL', 'MANUAL')),
  motivo          text,
  registrada_por  text not null,
  -- Un estudiante solo puede quedar registrado una vez por sesión.
  constraint asistencia_unica unique (sesion_id, estudiante_id),
  -- La corrección manual exige un motivo de al menos 5 caracteres.
  constraint asistencia_motivo_manual check (
    metodo = 'FACIAL' or length(trim(coalesce(motivo, ''))) >= 5
  )
);
create index asistencia_estudiante_id_idx on public.asistencia (estudiante_id);
create index asistencia_docente_id_idx on public.asistencia (docente_id);

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns text
language sql stable security definer set search_path = ''
as $$
  select c.rol from public.cuenta c
  where c.email = lower((select auth.jwt() ->> 'email'));
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual() = 'admin', false); $$;

create or replace function public.es_personal()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.rol_actual() is not null; $$;

-- Mantiene actualizado_en
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql set search_path = ''
as $$ begin new.actualizado_en := now(); return new; end; $$;

create trigger docente_actualizado before update on public.docente
  for each row execute function public.tocar_actualizado_en();
create trigger estudiante_actualizado before update on public.estudiante
  for each row execute function public.tocar_actualizado_en();

-- Evita dos sesiones cruzadas del mismo grupo el mismo día.
create or replace function public.validar_cruce_sesion()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.sesion s
    where s.grupo_id = new.grupo_id
      and s.fecha = new.fecha
      and s.id <> coalesce(new.id, -1)
      and new.hora_inicio < s.hora_fin
      and s.hora_inicio < new.hora_fin
  ) then
    raise exception 'El grupo ya tiene una sesión que se cruza con ese horario'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger sesion_sin_cruces before insert or update on public.sesion
  for each row execute function public.validar_cruce_sesion();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.cuenta     enable row level security;
alter table public.docente    enable row level security;
alter table public.grupo      enable row level security;
alter table public.estudiante enable row level security;
alter table public.rostro     enable row level security;
alter table public.sesion     enable row level security;
alter table public.asistencia enable row level security;

-- cuenta: cada usuario ve su propia fila; el admin ve todas. Se administra por SQL.
create policy cuenta_select on public.cuenta for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')) or (select public.es_admin()));

-- docente / grupo / estudiante: lectura para el personal, escritura solo admin.
-- No hay política de DELETE: se desactiva, no se borra.
create policy docente_select on public.docente for select to authenticated
  using ((select public.es_personal()));
create policy docente_insert on public.docente for insert to authenticated
  with check ((select public.es_admin()));
create policy docente_update on public.docente for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy grupo_select on public.grupo for select to authenticated
  using ((select public.es_personal()));
create policy grupo_insert on public.grupo for insert to authenticated
  with check ((select public.es_admin()));
create policy grupo_update on public.grupo for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy estudiante_select on public.estudiante for select to authenticated
  using ((select public.es_personal()));
create policy estudiante_insert on public.estudiante for insert to authenticated
  with check ((select public.es_admin()));
create policy estudiante_update on public.estudiante for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- rostro: solo el admin (enrolamiento). El personal nunca descarga descriptores.
create policy rostro_select on public.rostro for select to authenticated
  using ((select public.es_admin()));
create policy rostro_insert on public.rostro for insert to authenticated
  with check ((select public.es_admin()));
create policy rostro_delete on public.rostro for delete to authenticated
  using ((select public.es_admin()));

-- sesion: el personal consulta y programa; el admin edita/elimina.
create policy sesion_select on public.sesion for select to authenticated
  using ((select public.es_personal()));
create policy sesion_insert on public.sesion for insert to authenticated
  with check ((select public.es_personal()));
create policy sesion_update on public.sesion for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy sesion_delete on public.sesion for delete to authenticated
  using ((select public.es_admin()));

-- asistencia: solo lectura directa; se escribe únicamente por las funciones RPC.
create policy asistencia_select on public.asistencia for select to authenticated
  using ((select public.es_personal()));

-- Sin acceso para anónimos
revoke all on all tables in schema public from anon;
