import "server-only";
import { unstable_cache } from "next/cache";
import { loadOfficialAlerts } from "@/lib/smn/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadForecasts, updateLedger } from "./accuracy";
import { fetchForecasts, fetchObservations, openMeteoKey, truncateWrf } from "./fetch";
import { PUBLIC_PLACES, type PublicPlace } from "./places";
import { buildReport, recentRainMm, type AlertInput } from "./report";
import { sourceLabel } from "./sources";
import { readLedger, storageKind, writeLedger } from "./storage";
import { loadThresholds } from "./thresholds";
import type { ClimateReport, HourPoint, SourceStatus } from "./types";

function keys(env: NodeJS.ProcessEnv = process.env) {
  return {
    apiKey: openMeteoKey(env),
    openWeatherKey: env.OPENWEATHER_API_KEY || undefined,
    weatherApiKey: env.WEATHERAPI_KEY || undefined,
    tomorrowKey: env.TOMORROW_API_KEY || undefined,
  };
}

async function loadWrf(places: PublicPlace[]): Promise<{ points: HourPoint[]; ok: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { points: [], ok: false };
  try {
    const supabase = createAdminClient();
    const { data: orgs, error } = await supabase.from("organizations").select("id").eq("name", "MasAlto").limit(1);
    if (error || !orgs?.length) return { points: [], ok: false };
    const { data: saved, error: placeError } = await supabase
      .from("places")
      .select("id, name")
      .eq("organization_id", orgs[0].id)
      .eq("is_saved_place", true);
    if (placeError || !saved) return { points: [], ok: false };
    const idByName = new Map(saved.map((place: { id: string; name: string }) => [place.name, place.id]));
    const from = new Date(Date.now() - 3_600_000).toISOString();
    const points: HourPoint[] = [];
    for (const place of places) {
      const id = idByName.get(place.name);
      if (!id) continue;
      const { data, error: forecastError } = await supabase
        .from("forecasts_latest")
        .select("valid_time, temperature_c, precipitation_mm, wind_speed_kmh, wind_gust_kmh, wind_direction_deg")
        .eq("place_id", id)
        .eq("source", "smn-wrf")
        .gte("valid_time", from)
        .limit(400);
      if (forecastError || !data) continue;
      for (const row of data as {
        valid_time: string;
        temperature_c: number | null;
        precipitation_mm: number | null;
        wind_speed_kmh: number | null;
        wind_gust_kmh: number | null;
        wind_direction_deg: number | null;
      }[]) {
        const validTime = truncateWrf(row.valid_time);
        if (!validTime) continue;
        points.push({
          placeId: place.id,
          source: "smn-wrf",
          validTime,
          temperature_c: row.temperature_c,
          humidity_pct: null,
          precipitation_mm: row.precipitation_mm,
          wind_speed_kmh: row.wind_speed_kmh,
          wind_gust_kmh: row.wind_gust_kmh,
          wind_direction_deg: row.wind_direction_deg,
          pressure_hpa: null,
        });
      }
    }
    return { points, ok: points.length > 0 };
  } catch {
    return { points: [], ok: false };
  }
}

async function gather(now: Date, days: number, metarHours: number, places = PUBLIC_PLACES) {
  const [live, observations, wrf, alerts, ledger] = await Promise.all([
    fetchForecasts(places, { days, ...keys() }),
    fetchObservations(places, { metarHours, now }),
    loadWrf(places),
    loadOfficialAlerts(
      places.map((place) => ({ id: place.id, lat: place.lat, lon: place.lon })),
      now,
    ),
    readLedger(now),
  ]);
  const sources: SourceStatus[] = [...live.sources];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    sources.push({ id: "smn-wrf", label: sourceLabel("smn-wrf"), ok: wrf.ok });
  }
  const alertInputs: AlertInput[] = [];
  for (const place of places) {
    for (const alert of alerts.byPlace[place.id] ?? []) {
      alertInputs.push({ placeId: place.id, ...alert });
    }
  }
  return {
    places,
    points: [...live.points, ...wrf.points],
    observations,
    alerts: alertInputs,
    alertsState: alerts.state,
    sources,
    ledger,
  };
}

function toReport(data: Awaited<ReturnType<typeof gather>>, now: Date): ClimateReport {
  return buildReport({
    now,
    places: data.places,
    points: data.points,
    observations: data.observations,
    alerts: data.alerts,
    alertsState: data.alertsState,
    scores: data.ledger.scores,
    thresholds: loadThresholds(),
    sources: data.sources,
    storage: storageKind(),
    recentRain: Object.fromEntries(
      data.places.map((place) => [place.id, recentRainMm(data.points, place.id, place.timezone, now)]),
    ),
  });
}

export async function buildClimateReport(now = new Date()): Promise<ClimateReport> {
  return toReport(await gather(now, 7, 3), now);
}

export async function reportForPlace(place: PublicPlace, now = new Date()): Promise<ClimateReport> {
  return toReport(await gather(now, 7, 3, [place]), now);
}

export const loadClimateReport = unstable_cache(async () => buildClimateReport(new Date()), ["clima-consenso-v5"], {
  revalidate: 600,
});

export type PrecisionResult = {
  stored: boolean;
  storage: "blob" | "kv" | "none";
  added: number;
  matched: number;
  pending: number;
  message?: string;
};

/** Corre una vez por día en el plan Hobby. En Pro se puede pasar a cada hora. */
export async function runPrecisionCron(now = new Date()): Promise<PrecisionResult> {
  const kind = storageKind();
  if (kind === "none") {
    return {
      stored: false,
      storage: "none",
      added: 0,
      matched: 0,
      pending: 0,
      message: "Sin BLOB_READ_WRITE_TOKEN ni KV_REST_API_URL. El consenso sigue en vivo, sin historial.",
    };
  }
  const data = await gather(now, 2, 26);
  const forecasts = leadForecasts(data.points, now);
  const update = updateLedger(data.ledger, forecasts, data.observations, now);
  const stored = await writeLedger(update.ledger);
  return {
    stored,
    storage: kind,
    added: update.added,
    matched: update.matched,
    pending: update.ledger.pending.length,
  };
}
