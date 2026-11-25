-- =====================================================================
-- Funciones RPC de asistencia y reportes
-- =====================================================================

-- ---------------------------------------------------------------------
-- registrar_asistencia: recibe el descriptor facial capturado por la cámara,
-- busca el estudiante más parecido y registra su asistencia en la sesión.
-- Respuestas (campo "estado"):
--   REGISTRADO   -> se guardó la asistencia (con fecha y hora)
--   DUPLICADO    -> ya estaba registrado en esta sesión
--   DESCONOCIDO  -> ningún rostro enrolado se parece lo suficiente
--   OTRO_GRUPO   -> el estudiante no pertenece al grupo de la sesión
-- ---------------------------------------------------------------------
create or replace function public.registrar_asistencia(
  p_sesion_id bigint,
  p_descriptor extensions.vector(128)
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c_umbral constant double precision := 0.5;  -- distancia euclidiana máxima
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

  if not exists (select 1 from public.docente d where d.id = v_sesion.docente_id and d.activo) then
    raise exception 'El docente de la sesión está inactivo' using errcode = 'P0001';
  end if;

  -- Rostro enrolado más cercano entre estudiantes activos
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

-- ---------------------------------------------------------------------
-- registrar_asistencia_manual (función adicional): corrección manual con motivo.
-- Valida motivo, pertenencia al grupo y duplicados; lanza error claro si algo falla.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- reporte_sesion (función adicional): presentes y ausentes del grupo de una sesión.
-- Se usa para exportar el CSV con el reporte de inasistencias.
-- ---------------------------------------------------------------------
create or replace function public.reporte_sesion(p_sesion_id bigint)
returns table (
  documento text,
  nombres text,
  apellidos text,
  estado text,
  registrada_en timestamptz,
  metodo text,
  motivo text
)
language sql stable security invoker set search_path = ''
as $$
  select e.documento, e.nombres, e.apellidos,
         case when a.id is null then 'AUSENTE' else 'PRESENTE' end,
         a.registrada_en, a.metodo, a.motivo
  from public.sesion s
  join public.estudiante e on e.grupo_id = s.grupo_id and (e.activo or exists (
         select 1 from public.asistencia a2 where a2.sesion_id = s.id and a2.estudiante_id = e.id))
  left join public.asistencia a on a.sesion_id = s.id and a.estudiante_id = e.id
  where s.id = p_sesion_id
  order by e.apellidos, e.nombres;
$$;

-- ---------------------------------------------------------------------
-- Vista para el historial (respeta RLS del usuario que consulta)
-- ---------------------------------------------------------------------
create or replace view public.asistencia_detalle
with (security_invoker = true) as
select a.id,
       a.registrada_en,
       a.metodo,
       a.motivo,
       a.registrada_por,
       s.id          as sesion_id,
       s.fecha,
       s.hora_inicio,
       s.hora_fin,
       s.asignatura,
       g.nombre      as grupo,
       e.id          as estudiante_id,
       e.documento   as estudiante_documento,
       e.nombres || ' ' || e.apellidos as estudiante,
       d.id          as docente_id,
       d.nombres || ' ' || d.apellidos as docente
from public.asistencia a
join public.sesion s     on s.id = a.sesion_id
join public.grupo g      on g.id = s.grupo_id
join public.estudiante e on e.id = a.estudiante_id
join public.docente d    on d.id = a.docente_id;

-- Conteo de muestras faciales por estudiante (para el módulo admin)
create or replace view public.estudiante_enrolamiento
with (security_invoker = true) as
select e.id as estudiante_id, count(r.id)::int as muestras
from public.estudiante e
left join public.rostro r on r.estudiante_id = e.id
group by e.id;

-- Permisos de ejecución
revoke execute on function public.registrar_asistencia(bigint, extensions.vector) from public, anon;
revoke execute on function public.registrar_asistencia_manual(bigint, bigint, text) from public, anon;
revoke execute on function public.reporte_sesion(bigint) from public, anon;
grant execute on function public.registrar_asistencia(bigint, extensions.vector) to authenticated;
grant execute on function public.registrar_asistencia_manual(bigint, bigint, text) to authenticated;
grant execute on function public.reporte_sesion(bigint) to authenticated;
