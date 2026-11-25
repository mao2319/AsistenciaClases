-- El administrador puede eliminar estudiantes, docentes y grupos.
-- Las llaves foráneas impiden eliminar registros con historial:
--  - estudiante con asistencias,
--  - docente con sesiones o asistencias,
--  - grupo con estudiantes o sesiones.
-- En esos casos la app sugiere desactivar. Los rostros del estudiante se borran en cascada.

create policy estudiante_delete on public.estudiante for delete to authenticated
  using ((select public.es_admin()));
create policy docente_delete on public.docente for delete to authenticated
  using ((select public.es_admin()));
create policy grupo_delete on public.grupo for delete to authenticated
  using ((select public.es_admin()));
