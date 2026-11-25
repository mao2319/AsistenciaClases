-- Foto de los docentes: bucket privado de Supabase Storage + ruta en docente.foto_path.
-- Lectura para el personal autenticado (URLs firmadas); escritura solo administrador.

alter table public.docente add column foto_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-docentes', 'fotos-docentes', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotos_docentes_select on storage.objects for select to authenticated
  using (bucket_id = 'fotos-docentes' and (select public.es_personal()));
create policy fotos_docentes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-docentes' and (select public.es_admin()));
create policy fotos_docentes_update on storage.objects for update to authenticated
  using (bucket_id = 'fotos-docentes' and (select public.es_admin()));
create policy fotos_docentes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-docentes' and (select public.es_admin()));
