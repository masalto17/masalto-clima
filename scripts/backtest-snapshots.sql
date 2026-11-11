-- Lectura de pronósticos realmente guardados para el Estadio.
-- Cambiar las fechas antes de cada análisis. No modifica la base.
-- `ingested_at` es la disponibilidad comprobable; `run_time` de Open-Meteo
-- es una franja artificial de 6 h y no sirve para medir anticipación.
with parametros as (
  select
    'Estadio San Juan del Bicentenario'::text as lugar,
    '2026-11-01 00:00:00+00'::timestamptz as desde,
    '2026-11-08 00:00:00+00'::timestamptz as hasta
), elegibles as (
  select
    p.name as lugar,
    h.horas_anticipacion,
    f.source,
    f.model,
    f.valid_time,
    f.ingested_at,
    f.wind_speed_kmh,
    f.wind_gust_kmh,
    f.wind_direction_deg,
    f.precipitation_mm,
    row_number() over (
      partition by p.id, h.horas_anticipacion, f.model, f.valid_time
      order by f.ingested_at desc, f.run_time desc
    ) as version
  from clima.forecasts f
  join clima.places p on p.id = f.place_id
  cross join parametros x
  cross join (values (24), (48)) as h(horas_anticipacion)
  where p.name = x.lugar
    and f.valid_time >= x.desde
    and f.valid_time < x.hasta
    and f.ingested_at <= f.valid_time - make_interval(hours => h.horas_anticipacion)
)
select lugar, horas_anticipacion, source, model, valid_time, ingested_at,
       wind_speed_kmh, wind_gust_kmh, wind_direction_deg, precipitation_mm
from elegibles
where version = 1
order by valid_time, horas_anticipacion, model;
