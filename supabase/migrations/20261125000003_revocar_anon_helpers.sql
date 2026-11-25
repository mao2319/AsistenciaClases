-- Las funciones de rol solo las usan usuarios autenticados (políticas RLS y la app).
revoke execute on function public.rol_actual() from public, anon;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.es_personal() from public, anon;
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_personal() to authenticated;
