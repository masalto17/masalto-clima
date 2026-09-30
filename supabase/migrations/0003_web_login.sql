-- masalto-clima: ingreso a la web desde el bot sin poner el mail (Hito 1b).
-- `/web` en un chat vinculado crea un token de un solo uso (10 min); se guarda solo el hash.

create table clima.web_login_tokens (
  token_hash text primary key,
  profile_id uuid not null references clima.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index web_login_tokens_profile_id_idx on clima.web_login_tokens (profile_id);

-- Sin políticas: solo service_role.
alter table clima.web_login_tokens enable row level security;

-- Canjea el token de forma atómica y devuelve el perfil, o null si venció o ya se usó.
create function clima.redeem_web_login(p_token_hash text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update clima.web_login_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
  returning profile_id;
$$;

revoke all on function clima.redeem_web_login(text) from public, anon, authenticated;
grant execute on function clima.redeem_web_login(text) to service_role;
