-- Usuarios de Supabase Auth que todavía no tienen rol en la app (ni admin ni docente).
-- Se muestran en Administración › Administradores para asignarles el rol con un clic.
create or replace function public.listar_usuarios_sin_rol()
returns table (email text, creado_en timestamptz, ultimo_ingreso timestamptz)
language sql stable security definer set search_path = ''
as $$
  select lower(u.email), u.created_at, u.last_sign_in_at
  from auth.users u
  where public.es_admin()
    and u.email is not null
    and not exists (select 1 from public.cuenta c where c.email = lower(u.email))
    and not exists (select 1 from public.docente d where d.email = lower(u.email))
  order by u.created_at;
$$;
revoke execute on function public.listar_usuarios_sin_rol() from public, anon;
grant execute on function public.listar_usuarios_sin_rol() to authenticated;
