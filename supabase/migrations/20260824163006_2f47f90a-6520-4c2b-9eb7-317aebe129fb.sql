create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

drop policy if exists "admins read roles" on public.user_roles;
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "users read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins update site settings" on public.site_settings;
create policy "admins update site settings" on public.site_settings for update to authenticated
  using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
drop policy if exists "admins insert site settings" on public.site_settings;
create policy "admins insert site settings" on public.site_settings for insert to authenticated
  with check (private.has_role(auth.uid(),'admin'));

drop policy if exists "admins manage providers" on public.api_providers;
create policy "admins manage providers" on public.api_providers for all to authenticated
  using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));

drop policy if exists "admins manage seo" on public.seo_overrides;
create policy "admins manage seo" on public.seo_overrides for all to authenticated
  using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));

drop policy if exists "admins read audit log" on public.audit_log;
create policy "admins read audit log" on public.audit_log for select to authenticated
  using (private.has_role(auth.uid(),'admin'));
drop policy if exists "admins write audit log" on public.audit_log;
create policy "admins write audit log" on public.audit_log for insert to authenticated
  with check (private.has_role(auth.uid(),'admin') and actor_id = auth.uid());
drop policy if exists "admins delete audit log" on public.audit_log;
create policy "admins delete audit log" on public.audit_log for delete to authenticated
  using (private.has_role(auth.uid(),'admin'));

drop function if exists public.has_role(uuid, public.app_role);