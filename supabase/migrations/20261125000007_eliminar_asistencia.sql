-- El administrador puede eliminar un registro de asistencia indicando un motivo.
-- Antes de borrarlo se guarda una copia en la bitácora asistencia_eliminada (auditoría).

create table public.asistencia_eliminada (
  id             bigint generated always as identity primary key,
  asistencia_id  bigint not null,
  datos          jsonb not null,
  motivo         text not null check (length(trim(motivo)) >= 5),
  eliminada_por  text not null,
  eliminada_en   timestamptz not null default now()
);
alter table public.asistencia_eliminada enable row level security;
create policy asistencia_eliminada_select on public.asistencia_eliminada for select to authenticated
  using ((select public.es_admin()));

create or replace function public.eliminar_asistencia(p_asistencia_id bigint, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_fila public.asistencia%rowtype;
  v_nombre text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede eliminar registros de asistencia' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'El motivo es obligatorio (mínimo 5 caracteres)' using errcode = 'P0001';
  end if;

  select * into v_fila from public.asistencia where id = p_asistencia_id;
  if not found then
    raise exception 'El registro de asistencia no existe' using errcode = 'P0002';
  end if;

  select e.nombres || ' ' || e.apellidos into v_nombre from public.estudiante e where e.id = v_fila.estudiante_id;

  insert into public.asistencia_eliminada (asistencia_id, datos, motivo, eliminada_por)
  values (v_fila.id, to_jsonb(v_fila), trim(p_motivo), lower(auth.jwt() ->> 'email'));

  delete from public.asistencia where id = v_fila.id;

  return jsonb_build_object('estado', 'ELIMINADO', 'estudiante', v_nombre);
end;
$$;

revoke execute on function public.eliminar_asistencia(bigint, text) from public, anon;
grant execute on function public.eliminar_asistencia(bigint, text) to authenticated;
