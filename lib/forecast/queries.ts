import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateParts, summarizeDays, type DaySummary } from "./combine";
import { summarizeHours, type HourlySummary } from "./hourly";
import { isStale } from "../health/check";

export type SavedPlace = { id: string; name: string; timezone: string; lat: number; lon: number };
export type SourceStatus = { source: string; last_ok_at: string | null };

export type PlaceForecast = {
  place: SavedPlace;
  days: DaySummary[];
  hourlyToday: HourlySummary[];
  hourlyTomorrow: HourlySummary[];
  /** Fuentes que aportan datos al combinado de este lugar. */
  sources: string[];
};

export type Overview = { places: PlaceForecast[]; health: SourceStatus[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente del esquema `clima`, sin tipos generados
type Client = SupabaseClient<any, any, any>;

const PAGE = 1000; // tope de filas por consulta de la API de Supabase
const COLUMNS =
  "source, model, valid_time, temperature_c, precipitation_mm, wind_speed_kmh, wind_gust_kmh, wind_direction_deg";

type LatestRow = {
  source: string;
  model: string;
  valid_time: string;
  temperature_c: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_direction_deg: number | null;
};

async function loadLatestRows(supabase: Client, placeId: string, from: Date): Promise<LatestRow[]> {
  const rows: LatestRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from("forecasts_latest")
      .select(COLUMNS)
      .eq("place_id", placeId)
      .gte("valid_time", from.toISOString())
      .order("valid_time")
      .order("model")
      .range(start, start + PAGE - 1)
      .returns<LatestRow[]>();
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Lugares guardados con su pronóstico combinado y el latido de las fuentes.
 * Con el cliente de sesión, RLS limita a la organización del usuario; con el de
 * service_role hay que pasar `organizationId`.
 */
export async function loadOverview(
  supabase: Client,
  now: Date,
  organizationId?: string,
): Promise<Overview> {
  let placesQuery = supabase
    .from("places")
    .select("id, name, timezone, lat, lon")
    .eq("is_saved_place", true)
    .order("created_at")
    .order("name");
  if (organizationId) placesQuery = placesQuery.eq("organization_id", organizationId);

  const [placesResult, healthResult] = await Promise.all([
    placesQuery.returns<SavedPlace[]>(),
    supabase.from("system_health").select("source, last_ok_at").order("source").returns<SourceStatus[]>(),
  ]);
  if (placesResult.error) throw placesResult.error;
  if (healthResult.error) throw healthResult.error;

  // Un modelo de una fuente caída puede seguir dentro de las últimas 24 h de
  // forecasts_latest. No mostrarlo como si acabara de actualizarse.
  const healthySources = new Set(
    healthResult.data.filter((status) => !isStale(status.last_ok_at, now)).map((status) => status.source),
  );

  // Un día de margen: alcanza para arrancar en la medianoche local de hoy.
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const places = await Promise.all(
    placesResult.data.map(async (place) => {
      const rows = (await loadLatestRows(supabase, place.id, from)).filter((row) => healthySources.has(row.source));
      const today = localDateParts(now, place.timezone).date;
      return {
        place,
        days: summarizeDays(rows, place.timezone, now),
        hourlyToday: summarizeHours(rows, place.timezone, today),
        hourlyTomorrow: summarizeHours(rows, place.timezone, addDays(today, 1)),
        sources: [...new Set(rows.map((row) => row.source))].sort(),
      };
    }),
  );

  return { places, health: healthResult.data };
}
