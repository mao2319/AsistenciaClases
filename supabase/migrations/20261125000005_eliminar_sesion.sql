-- Permite eliminar sesiones programadas:
--  - el admin puede eliminar cualquiera; el docente, solo las suyas;
--  - no se puede eliminar una sesión que ya tiene asistencia registrada
--    (protege el historial: la FK pasa de CASCADE a RESTRICT).

alter table public.asistencia drop constraint asistencia_sesion_id_fkey;
alter table public.asistencia
  add constraint asistencia_sesion_id_fkey
  foreign key (sesion_id) references public.sesion (id) on delete restrict;

drop policy sesion_delete on public.sesion;
create policy sesion_delete on public.sesion for delete to authenticated
  using ((select public.es_admin()) or docente_id = (select public.docente_actual_id()));
