-- Cada docente puede tener su propia cuenta: su correo se guarda en docente.email.
-- Roles: 'admin' (tabla cuenta) y 'docente' (correo de un docente activo).

alter table public.docente
  add column email text unique check (email is null or email = lower(email));

create or replace function public.rol_actual()
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.cuenta c
                 where c.email = lower((select auth.jwt() ->> 'email')) and c.rol = 'admin') then 'admin'
    when exists (select 1 from public.docente d
                 where d.email = lower((select auth.jwt() ->> 'email')) and d.activo) then 'docente'
    when exists (select 1 from public.cuenta c
                 where c.email = lower((select auth.jwt() ->> 'email'))) then 'operador'
  end;
$$;

create or replace function public.docente_actual_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select d.id from public.docente d
  where d.email = lower((select auth.jwt() ->> 'email')) and d.activo;
$$;
revoke execute on function public.docente_actual_id() from public, anon;
grant execute on function public.docente_actual_id() to authenticated;

-- Un docente solo programa sesiones propias; el admin, de cualquiera.
drop policy sesion_insert on public.sesion;
create policy sesion_insert on public.sesion for insert to authenticated
  with check ((select public.es_admin()) or docente_id = (select public.docente_actual_id()));

-- Puede registrar asistencia el admin o el docente de la sesión.
create or replace function public.puede_operar_sesion(p_docente_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_admin()
      or public.rol_actual() = 'operador'
      or p_docente_id = public.docente_actual_id();
$$;
revoke execute on function public.puede_operar_sesion(bigint) from public, anon;
grant execute on function public.puede_operar_sesion(bigint) to authenticated;

create or replace function public.registrar_asistencia(
  p_sesion_id bigint,
  p_descriptor extensions.vector(128)
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c_umbral constant double precision := 0.5;
  v_sesion   public.sesion%rowtype;
  v_est_id   bigint;
  v_nombre   text;
  v_grupo    bigint;
  v_dist     double precision;
  v_hora     timestamptz;
begin
  if not public.es_personal() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_sesion from public.sesion where id = p_sesion_id;
  if not found then
    raise exception 'La sesión % no existe', p_sesion_id using errcode = 'P0002';
  end if;

  if not public.puede_operar_sesion(v_sesion.docente_id) then
    raise exception 'Solo el docente de la sesión o un administrador puede registrar asistencia'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.docente d where d.id = v_sesion.docente_id and d.activo) then
    raise exception 'El docente de la sesión está inactivo' using errcode = 'P0001';
  end if;

  select e.id, e.nombres || ' ' || e.apellidos, e.grupo_id,
         r.descriptor operator(extensions.<->) p_descriptor
    into v_est_id, v_nombre, v_grupo, v_dist
  from public.rostro r
  join public.estudiante e on e.id = r.estudiante_id
  where e.activo
  order by r.descriptor operator(extensions.<->) p_descriptor
  limit 1;

  if v_est_id is null or v_dist > c_umbral then
    return jsonb_build_object('estado', 'DESCONOCIDO', 'distancia', v_dist);
  end if;

  if v_grupo <> v_sesion.grupo_id then
    return jsonb_build_object('estado', 'OTRO_GRUPO', 'estudiante', v_nombre, 'distancia', v_dist);
  end if;

  insert into public.asistencia (sesion_id, estudiante_id, docente_id, metodo, registrada_por)
  values (v_sesion.id, v_est_id, v_sesion.docente_id, 'FACIAL', lower(auth.jwt() ->> 'email'))
  on conflict on constraint asistencia_unica do nothing
  returning registrada_en into v_hora;

  if v_hora is null then
    select a.registrada_en into v_hora
    from public.asistencia a
    where a.sesion_id = v_sesion.id and a.estudiante_id = v_est_id;
    return jsonb_build_object('estado', 'DUPLICADO', 'estudiante', v_nombre,
                              'registrada_en', v_hora, 'distancia', v_dist);
  end if;

  return jsonb_build_object('estado', 'REGISTRADO', 'estudiante', v_nombre,
                            'registrada_en', v_hora, 'distancia', v_dist);
end;
$$;

create or replace function public.registrar_asistencia_manual(
  p_sesion_id bigint,
  p_estudiante_id bigint,
  p_motivo text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_sesion public.sesion%rowtype;
  v_est    public.estudiante%rowtype;
  v_hora   timestamptz;
begin
  if not public.es_personal() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'El motivo es obligatorio (mínimo 5 caracteres)' using errcode = 'P0001';
  end if;

  select * into v_sesion from public.sesion where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe' using errcode = 'P0002';
  end if;

  if not public.puede_operar_sesion(v_sesion.docente_id) then
    raise exception 'Solo el docente de la sesión o un administrador puede registrar asistencia'
      using errcode = '42501';
  end if;

  select * into v_est from public.estudiante where id = p_estudiante_id;
  if not found or not v_est.activo then
    raise exception 'El estudiante no existe o está inactivo' using errcode = 'P0001';
  end if;

  if v_est.grupo_id <> v_sesion.grupo_id then
    raise exception 'El estudiante no pertenece al grupo de la sesión' using errcode = 'P0001';
  end if;

  insert into public.asistencia (sesion_id, estudiante_id, docente_id, metodo, motivo, registrada_por)
  values (v_sesion.id, v_est.id, v_sesion.docente_id, 'MANUAL', trim(p_motivo), lower(auth.jwt() ->> 'email'))
  on conflict on constraint asistencia_unica do nothing
  returning registrada_en into v_hora;

  if v_hora is null then
    raise exception 'El estudiante ya tiene asistencia registrada en esta sesión' using errcode = 'P0001';
  end if;

  return jsonb_build_object('estado', 'REGISTRADO', 'estudiante', v_est.nombres || ' ' || v_est.apellidos,
                            'registrada_en', v_hora);
end;
$$;
