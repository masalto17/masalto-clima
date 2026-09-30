-- masalto-clima: esquema base (Hito 0).
-- Vive en el esquema `clima` del proyecto Supabase compartido con Handy.
-- No toca `public` ni el historial `supabase_migrations` de Handy:
-- se aplica con `pnpm db:migrate` (registro propio en clima.schema_migrations).

create schema if not exists clima;

create table clima.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table clima.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table clima.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references clima.organizations (id) on delete cascade,
  full_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create table clima.places (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references clima.organizations (id) on delete cascade,
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  elevation_m double precision,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create table clima.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references clima.organizations (id) on delete cascade,
  profile_id uuid not null references clima.profiles (id) on delete cascade,
  kind text not null check (kind in ('telegram')),
  external_id text not null,
  active boolean not null default true,
  linked_at timestamptz not null default now(),
  unique (kind, external_id)
);

-- Códigos de vinculación de un solo uso. Se guarda solo el hash SHA-256.
create table clima.channel_link_codes (
  code_hash text primary key,
  kind text not null check (kind in ('telegram')),
  external_id text not null,
  display_name text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table clima.system_health (
  source text primary key,
  last_ok_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index places_organization_id_idx on clima.places (organization_id);
create index channels_organization_id_idx on clima.channels (organization_id);
create index channels_profile_id_idx on clima.channels (profile_id);
create index profiles_organization_id_idx on clima.profiles (organization_id);

-- RLS en todas las tablas.
alter table clima.schema_migrations enable row level security;
alter table clima.organizations enable row level security;
alter table clima.profiles enable row level security;
alter table clima.places enable row level security;
alter table clima.channels enable row level security;
alter table clima.channel_link_codes enable row level security;
alter table clima.system_health enable row level security;

-- Organización del usuario actual. SECURITY DEFINER para no recursar en RLS de profiles.
create function clima.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from clima.profiles where id = (select auth.uid());
$$;

revoke all on function clima.current_org_id() from public, anon;
grant execute on function clima.current_org_id() to authenticated, service_role;

create policy organizations_select_own on clima.organizations
  for select to authenticated
  using (id = (select clima.current_org_id()));

create policy profiles_select_same_org on clima.profiles
  for select to authenticated
  using (organization_id = (select clima.current_org_id()));

create policy places_all_same_org on clima.places
  for all to authenticated
  using (organization_id = (select clima.current_org_id()))
  with check (organization_id = (select clima.current_org_id()));

create policy channels_select_same_org on clima.channels
  for select to authenticated
  using (organization_id = (select clima.current_org_id()));

create policy system_health_select_members on clima.system_health
  for select to authenticated
  using ((select clima.current_org_id()) is not null);

-- schema_migrations y channel_link_codes: sin políticas, solo service_role.

-- Permisos: anon no entra al esquema.
grant usage on schema clima to authenticated, service_role;
grant all on all tables in schema clima to service_role;
grant select on clima.organizations, clima.profiles, clima.channels, clima.system_health to authenticated;
grant select, insert, update, delete on clima.places to authenticated;

alter default privileges in schema clima grant all on tables to service_role;

-- Canjea un código de vinculación de forma atómica (un solo uso, 10 minutos).
-- Solo service_role: la ruta del servidor valida antes la sesión del usuario.
create function clima.redeem_link_code(p_code_hash text, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code clima.channel_link_codes%rowtype;
  v_org uuid;
begin
  select organization_id into v_org from clima.profiles where id = p_profile_id;
  if v_org is null then
    return 'sin_perfil';
  end if;

  update clima.channel_link_codes
     set used_at = now()
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > now()
  returning * into v_code;

  if not found then
    return 'codigo_invalido';
  end if;

  insert into clima.channels (organization_id, profile_id, kind, external_id)
  values (v_org, p_profile_id, v_code.kind, v_code.external_id)
  on conflict (kind, external_id)
  do update set organization_id = excluded.organization_id,
                profile_id = excluded.profile_id,
                active = true,
                linked_at = now();

  return 'ok';
end;
$$;

revoke all on function clima.redeem_link_code(text, uuid) from public, anon, authenticated;
grant execute on function clima.redeem_link_code(text, uuid) to service_role;

insert into clima.organizations (name) values ('MasAlto');
