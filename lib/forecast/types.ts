// Sin imports de Node ni alias `@/`: este archivo también lo usan las Edge Functions (Deno).

export type ForecastSource = "open-meteo" | "smn-wrf";

/** Fila de `clima.forecasts`. Horas en ISO 8601 UTC. */
export type ForecastRow = {
  place_id: string;
  source: ForecastSource;
  model: string;
  run_time: string;
  valid_time: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_direction_deg: number | null;
  pressure_hpa: number | null;
};

export type PlacePoint = { id: string; lat: number; lon: number };
