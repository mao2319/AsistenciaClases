-- Gestión de administradores desde la app (pestaña Administración › Administradores).

-- Lista los administradores con datos de su usuario de Supabase Auth.
create or replace function public.listar_administradores()
returns table (email text, nombre text, creado_en timestamptz, tiene_usuario boolean, ultimo_ingreso timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.email, c.nombre, c.creado_en, u.id is not null, u.last_sign_in_at
  from public.cuenta c
  left join auth.users u on lower(u.email) = c.email
  where c.rol = 'admin' and public.es_admin()
  order by c.creado_en;
$$;

-- ¿Existe un usuario de Supabase Auth con ese correo? (solo admin)
create or replace function public.existe_usuario_auth(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_admin() and exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)));
$$;

-- Da rol de administrador a un correo.
create or replace function public.agregar_administrador(p_email text, p_nombre text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede agregar administradores' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'El correo no es válido' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe el nombre del administrador' using errcode = 'P0001';
  end if;
  insert into public.cuenta (email, nombre, rol) values (v_email, trim(p_nombre), 'admin')
  on conflict (email) do update set nombre = excluded.nombre, rol = 'admin';
  return jsonb_build_object('email', v_email);
end;
$$;

-- Quita el rol de administrador (no borra el usuario de Supabase Auth).
create or replace function public.quitar_administrador(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede quitar administradores' using errcode = '42501';
  end if;
  if v_email = lower(auth.jwt() ->> 'email') then
    raise exception 'No puedes quitarte a ti mismo el rol de administrador' using errcode = 'P0001';
  end if;
  if (select count(*) from public.cuenta where rol = 'admin') <= 1 then
    raise exception 'Debe quedar al menos un administrador' using errcode = 'P0001';
  end if;
  delete from public.cuenta where email = v_email;
  if not found then
    raise exception 'Ese correo no es administrador' using errcode = 'P0002';
  end if;
  return jsonb_build_object('email', v_email);
end;
$$;

revoke execute on function public.listar_administradores() from public, anon;
revoke execute on function public.existe_usuario_auth(text) from public, anon;
revoke execute on function public.agregar_administrador(text, text) from public, anon;
revoke execute on function public.quitar_administrador(text) from public, anon;
grant execute on function public.listar_administradores() to authenticated;
grant execute on function public.existe_usuario_auth(text) to authenticated;
grant execute on function public.agregar_administrador(text, text) to authenticated;
grant execute on function public.quitar_administrador(text) to authenticated;
