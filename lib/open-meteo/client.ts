// Sin imports de Node ni alias `@/`: este archivo también lo usan las Edge Functions (Deno).
import type { ForecastRow, PlacePoint } from "../forecast/types.ts";

/** Modelos globales que cubren Argentina en Open-Meteo. */
export const OPEN_METEO_MODELS = [
  "ecmwf_ifs025",
  "gfs_seamless",
  "icon_seamless",
  "gem_seamless",
  "meteofrance_seamless",
] as const;

export const FORECAST_DAYS = 7;

const VARIABLES = {
  temperature_2m: "temperature_c",
  relative_humidity_2m: "humidity_pct",
  precipitation: "precipitation_mm",
  wind_speed_10m: "wind_speed_kmh",
  wind_gusts_10m: "wind_gust_kmh",
  wind_direction_10m: "wind_direction_deg",
  surface_pressure: "pressure_hpa",
} as const;

type VariableColumn = (typeof VARIABLES)[keyof typeof VARIABLES];

type OpenMeteoLocation = {
  hourly?: { time: number[] } & Record<string, (number | null)[]>;
};

/**
 * Open-Meteo no informa la corrida de cada modelo: se usa la franja de 6 h (UTC)
 * de la consulta. Las consultas de una misma franja pisan las filas anteriores.
 */
export function runSlot(now: Date): string {
  const slot = new Date(now);
  slot.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6, 0, 0, 0);
  return slot.toISOString();
}

export function buildForecastUrl(places: PlacePoint[], apiKey?: string): string {
  // Con clave se usa el plan comercial; sin clave, el gratuito (no comercial).
  const host = apiKey ? "customer-api.open-meteo.com" : "api.open-meteo.com";
  const params = new URLSearchParams({
    latitude: places.map((p) => p.lat).join(","),
    longitude: places.map((p) => p.lon).join(","),
    hourly: Object.keys(VARIABLES).join(","),
    models: OPEN_METEO_MODELS.join(","),
    forecast_days: String(FORECAST_DAYS),
    timezone: "UTC",
    timeformat: "unixtime",
    wind_speed_unit: "kmh",
  });
  if (apiKey) params.set("apikey", apiKey);
  return `https://${host}/v1/forecast?${params.toString()}`;
}

/** Convierte la respuesta de Open-Meteo en filas de `forecasts`. */
export function parseForecastResponse(
  body: unknown,
  places: PlacePoint[],
  runTime: string,
): ForecastRow[] {
  // Con un solo lugar la API devuelve un objeto; con varios, una lista en el mismo orden.
  const locations = (Array.isArray(body) ? body : [body]) as OpenMeteoLocation[];
  if (locations.length !== places.length) {
    throw new Error(
      `Open-Meteo devolvió ${locations.length} lugares, se esperaban ${places.length}`,
    );
  }

  const rows: ForecastRow[] = [];
  locations.forEach((location, index) => {
    const hourly = location.hourly;
    if (!hourly?.time) throw new Error("Open-Meteo: respuesta sin datos horarios");

    for (const model of OPEN_METEO_MODELS) {
      hourly.time.forEach((unixSeconds, hour) => {
        const values = {} as Record<VariableColumn, number | null>;
        let hasData = false;
        for (const [variable, column] of Object.entries(VARIABLES)) {
          const value = hourly[`${variable}_${model}`]?.[hour] ?? null;
          values[column] = value;
          if (value !== null) hasData = true;
        }
        // Los modelos de menor alcance traen nulos al final: no se guardan.
        if (!hasData) return;
        rows.push({
          place_id: places[index].id,
          source: "open-meteo",
          model,
          run_time: runTime,
          valid_time: new Date(unixSeconds * 1000).toISOString(),
          ...values,
        });
      });
    }
  });
  return rows;
}

export async function fetchForecasts(
  places: PlacePoint[],
  options: { now: Date; apiKey?: string; fetchFn?: typeof fetch },
): Promise<ForecastRow[]> {
  if (places.length === 0) return [];
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildForecastUrl(places, options.apiKey));
  if (!response.ok) {
    // Sin la URL: puede llevar la clave.
    throw new Error(`Open-Meteo falló: HTTP ${response.status}`);
  }
  return parseForecastResponse(await response.json(), places, runSlot(options.now));
}
