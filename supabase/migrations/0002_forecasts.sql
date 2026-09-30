-- masalto-clima: pronósticos, latido y tareas programadas (Hito 1).
-- Igual que 0001: solo esquema `clima`, se aplica con `pnpm db:migrate`.

-- Lugares guardados: campos del plan que faltaban.
alter table clima.places
  add column is_saved_place boolean not null default true,
  add column smn_station text,
  add column notes text,
  add constraint places_org_name_key unique (organization_id, name);

-- Latido: momento en que se avisó la caída (un aviso por caída).
alter table clima.system_health add column alerted_at timestamptz;

-- Pronósticos por lugar, modelo, corrida y hora válida. Particionada por mes.
-- Open-Meteo no publica la corrida de cada modelo: run_time es la franja de
-- 6 h (UTC) en la que se consultó. En WRF es la corrida real.
create table clima.forecasts (
  place_id uuid not null references clima.places (id) on delete cascade,
  source text not null check (source in ('open-meteo', 'smn-wrf')),
  model text not null,
  run_time timestamptz not null,
  valid_time timestamptz not null,
  temperature_c real,
  humidity_pct real,
  precipitation_mm real,
  wind_speed_kmh real,
  wind_gust_kmh real,
  wind_direction_deg real,
  pressure_hpa real,
  ingested_at timestamptz not null default now(),
  primary key (place_id, model, valid_time, run_time)
) partition by range (valid_time);

alter table clima.forecasts enable row level security;

create policy forecasts_select_same_org on clima.forecasts
  for select to authenticated
  using (
    exists (
      select 1
        from clima.places p
       where p.id = place_id
         and p.organization_id = (select clima.current_org_id())
    )
  );

grant select on clima.forecasts to authenticated;

-- Crea las particiones del mes actual y los dos siguientes, y borra las que
-- terminaron hace más de 90 días (retención de corridas completas).
create function clima.maintain_forecast_partitions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_name text;
  v_child record;
begin
  for i in 0..2 loop
    v_month := (date_trunc('month', now() at time zone 'utc') + make_interval(months => i))::date;
    v_name := 'forecasts_' || to_char(v_month, 'YYYYMM');
    if to_regclass('clima.' || v_name) is null then
      execute format(
        'create table clima.%I partition of clima.forecasts for values from (%L) to (%L)',
        v_name,
        to_char(v_month, 'YYYY-MM-DD') || ' 00:00:00+00',
        to_char(v_month + interval '1 month', 'YYYY-MM-DD') || ' 00:00:00+00'
      );
      -- Las particiones no heredan RLS: sin políticas, solo service_role las lee directo.
      execute format('alter table clima.%I enable row level security', v_name);
    end if;
  end loop;

  for v_child in
    select c.relname
      from pg_catalog.pg_inherits i
      join pg_catalog.pg_class c on c.oid = i.inhrelid
     where i.inhparent = 'clima.forecasts'::regclass
       and c.relname ~ '^forecasts_[0-9]{6}$'
  loop
    if to_date(right(v_child.relname, 6), 'YYYYMM') + interval '1 month'
       < (now() at time zone 'utc') - interval '90 days' then
      execute format('drop table clima.%I', v_child.relname);
    end if;
  end loop;
end;
$$;

revoke all on function clima.maintain_forecast_partitions() from public, anon, authenticated;
grant execute on function clima.maintain_forecast_partitions() to service_role;

select clima.maintain_forecast_partitions();

-- Última corrida de cada modelo por lugar y hora. Un modelo que no actualiza
-- hace más de 24 h queda afuera del pronóstico combinado.
create view clima.forecasts_latest
with (security_invoker = true) as
select distinct on (place_id, model, valid_time) *
  from clima.forecasts
 where run_time > now() - interval '24 hours'
 order by place_id, model, valid_time, run_time desc;

grant select on clima.forecasts_latest to authenticated, service_role;

-- Tareas programadas: pg_cron llama a las Edge Functions con pg_net.
-- La URL y el secreto viven en Vault (se cargan a mano, fuera del repo):
--   clima_functions_url  → https://<ref>.supabase.co/functions/v1
--   clima_cron_secret    → mismo valor que el secreto CLIMA_CRON_SECRET de las funciones
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function clima.invoke_edge_function(p_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'clima_functions_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'clima_cron_secret';
  if v_url is null or v_secret is null then
    raise exception 'Faltan clima_functions_url o clima_cron_secret en Vault';
  end if;

  return net.http_post(
    url := v_url || '/' || p_name,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-clima-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function clima.invoke_edge_function(text) from public, anon, authenticated;

select cron.schedule(
  'clima-ingest-open-meteo', '5 * * * *',
  $$select clima.invoke_edge_function('clima-ingest-open-meteo')$$
);
select cron.schedule(
  'clima-health-check', '*/30 * * * *',
  $$select clima.invoke_edge_function('clima-health-check')$$
);
select cron.schedule(
  'clima-forecast-partitions', '10 3 * * *',
  $$select clima.maintain_forecast_partitions()$$
);

-- Lugares guardados iniciales de la organización MasAlto.
insert into clima.places (organization_id, name, lat, lon, elevation_m, timezone, smn_station)
select o.id, p.name, p.lat, p.lon, p.elevation_m, p.timezone, p.smn_station
  from clima.organizations o
 cross join (
   values
     ('San Juan Ciudad', -31.5375, -68.5364, 641, 'America/Argentina/San_Juan', 'San Juan'),
     ('Estadio San Juan del Bicentenario', -31.61195, -68.52818, 616, 'America/Argentina/San_Juan', 'San Juan'),
     ('Córdoba Villa Allende', -31.29362, -64.29762, 511, 'America/Argentina/Cordoba', 'Córdoba')
 ) as p (name, lat, lon, elevation_m, timezone, smn_station)
 where o.name = 'MasAlto'
on conflict (organization_id, name) do nothing;
