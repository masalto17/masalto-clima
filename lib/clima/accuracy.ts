import type { HourPoint, Observation, Variable } from "./types";
import { hourIso } from "./time";

export const MIN_SAMPLES = 8;
export const LEAD_HOURS = [1, 3, 6, 12, 24] as const;

/** Por debajo de esto el peso no se usa: el ruido de pocas horas mueve el consenso. */
export const ERROR_FLOOR: Partial<Record<Variable, number>> = {
  temperature_c: 0.5,
  humidity_pct: 3,
  precipitation_mm: 0.5,
  wind_speed_kmh: 2,
  wind_gust_kmh: 3,
};

export const RANKED_VARIABLES: { variable: Variable; label: string; unit: string }[] = [
  { variable: "wind_gust_kmh", label: "Ráfagas", unit: "km/h" },
  { variable: "wind_speed_kmh", label: "Viento", unit: "km/h" },
  { variable: "precipitation_mm", label: "Lluvia", unit: "mm" },
  { variable: "temperature_c", label: "Temperatura", unit: "°C" },
  { variable: "humidity_pct", label: "Humedad", unit: "%" },
];

const SCORED = ["temperature_c", "humidity_pct", "precipitation_mm", "wind_speed_kmh", "wind_gust_kmh"] as const;

export type ScoreBucket = { samples: number; sumAbs: number; sumErr: number };

export type PendingForecast = {
  placeId: string;
  source: string;
  issuedAt: string;
  validTime: string;
  leadHours: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_gust_kmh: number | null;
};

export type Ledger = {
  version: 1;
  updatedAt: string;
  pending: PendingForecast[];
  observations: Observation[];
  scores: Record<string, Partial<Record<Variable, ScoreBucket>>>;
};

export function emptyLedger(now: Date): Ledger {
  return { version: 1, updatedAt: now.toISOString(), pending: [], observations: [], scores: {} };
}

export function parseLedger(raw: string, now: Date): Ledger {
  try {
    const value = JSON.parse(raw) as Partial<Ledger>;
    if (value?.version !== 1 || !Array.isArray(value.pending) || !Array.isArray(value.observations)) {
      return emptyLedger(now);
    }
    return {
      version: 1,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now.toISOString(),
      pending: value.pending,
      observations: value.observations,
      scores: value.scores && typeof value.scores === "object" ? value.scores : {},
    };
  } catch {
    return emptyLedger(now);
  }
}

export function weightFor(bucket: ScoreBucket | undefined, floor: number): number {
  if (!bucket || bucket.samples < MIN_SAMPLES || floor < 0) return 1;
  const mae = bucket.sumAbs / bucket.samples;
  return 1 / (mae + floor);
}

export function maeOf(bucket: ScoreBucket | undefined): number | null {
  if (!bucket || bucket.samples === 0) return null;
  return bucket.sumAbs / bucket.samples;
}

function pendingKey(row: PendingForecast): string {
  return `${row.placeId}|${row.source}|${row.leadHours}|${row.validTime}`;
}

function emptyBucket(): ScoreBucket {
  return { samples: 0, sumAbs: 0, sumErr: 0 };
}

function addError(bucket: ScoreBucket, forecast: number | null, observed: number | null): ScoreBucket {
  if (forecast === null || observed === null) return bucket;
  const error = forecast - observed;
  return { samples: bucket.samples + 1, sumAbs: bucket.sumAbs + Math.abs(error), sumErr: bucket.sumErr + error };
}

/** Pronósticos puntuales en horizontes fijos, para compararlos cuando pase la hora. */
export function leadForecasts(points: HourPoint[], now: Date, leads: readonly number[] = LEAD_HOURS): PendingForecast[] {
  const groups = new Map<string, HourPoint[]>();
  for (const point of points) {
    const key = `${point.placeId}|${point.source}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  const issuedAt = hourIso(now) ?? now.toISOString();
  const result: PendingForecast[] = [];
  for (const [key, series] of groups) {
    const split = key.indexOf("|");
    const placeId = key.slice(0, split);
    const source = key.slice(split + 1);
    for (const lead of leads) {
      const target = now.getTime() + lead * 3_600_000;
      let best: HourPoint | null = null;
      let bestDelta = Infinity;
      for (const point of series) {
        const delta = Math.abs(Date.parse(point.validTime) - target);
        if (delta < bestDelta) {
          best = point;
          bestDelta = delta;
        }
      }
      if (!best || bestDelta > 45 * 60_000) continue;
      result.push({
        placeId,
        source,
        issuedAt,
        validTime: best.validTime,
        leadHours: lead,
        temperature_c: best.temperature_c,
        humidity_pct: best.humidity_pct,
        precipitation_mm: best.precipitation_mm,
        wind_speed_kmh: best.wind_speed_kmh,
        wind_gust_kmh: best.wind_gust_kmh,
      });
    }
  }
  return result;
}

export type LedgerUpdate = { ledger: Ledger; matched: number; added: number };

/**
 * Suma pronósticos y observaciones, y cierra los que ya se pueden comparar.
 * La observación de referencia es el METAR; la estación SMN se usa si no hay METAR cerca.
 */
export function updateLedger(
  ledger: Ledger,
  forecasts: PendingForecast[],
  observations: Observation[],
  now: Date,
): LedgerUpdate {
  const pending = [...ledger.pending];
  const seen = new Set(pending.map(pendingKey));
  let added = 0;
  for (const forecast of forecasts) {
    const key = pendingKey(forecast);
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push(forecast);
    added += 1;
  }

  const storedObs = [...ledger.observations];
  const seenObs = new Set(storedObs.map((obs) => `${obs.placeId}|${obs.source}|${obs.time}`));
  for (const obs of observations) {
    const key = `${obs.placeId}|${obs.source}|${obs.time}`;
    if (seenObs.has(key)) continue;
    seenObs.add(key);
    storedObs.push(obs);
  }

  const scores: Ledger["scores"] = structuredClone(ledger.scores);
  let matched = 0;
  const open: PendingForecast[] = [];
  for (const forecast of pending) {
    const valid = Date.parse(forecast.validTime);
    if (!Number.isFinite(valid)) continue;
    if (valid > now.getTime() + 30 * 60_000) {
      open.push(forecast);
      continue;
    }
    const nearby = storedObs
      .filter((obs) => obs.placeId === forecast.placeId && Math.abs(Date.parse(obs.time) - valid) <= 45 * 60_000)
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === "metar" ? -1 : 1;
        return Math.abs(Date.parse(a.time) - valid) - Math.abs(Date.parse(b.time) - valid);
      });
    const obs = nearby[0];
    if (!obs) {
      if (valid >= now.getTime() - 36 * 3_600_000) open.push(forecast);
      continue;
    }
    const byVariable = { ...(scores[forecast.source] ?? {}) };
    for (const variable of SCORED) {
      byVariable[variable] = addError(byVariable[variable] ?? emptyBucket(), forecast[variable], obs[variable]);
    }
    scores[forecast.source] = byVariable;
    matched += 1;
  }

  const obsFrom = now.getTime() - 48 * 3_600_000;
  return {
    matched,
    added,
    ledger: {
      version: 1,
      updatedAt: now.toISOString(),
      pending: open.slice(-4000),
      observations: storedObs.filter((obs) => Date.parse(obs.time) >= obsFrom).slice(-2000),
      scores,
    },
  };
}
