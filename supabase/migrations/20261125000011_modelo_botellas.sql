-- Escáner de botellas: el modelo entrenado (JSON con pesos) se publica en un bucket público
-- de solo lectura; solo el administrador puede subirlo o reemplazarlo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('modelos', 'modelos', true, 5242880, array['application/json'])
on conflict (id) do nothing;

create policy modelos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'modelos' and (select public.es_admin()));
create policy modelos_update on storage.objects for update to authenticated
  using (bucket_id = 'modelos' and (select public.es_admin()));
create policy modelos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'modelos' and (select public.es_admin()));
