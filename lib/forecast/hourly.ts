import { localDateParts } from "./combine";

export type HourlyRow = {
  model: string;
  valid_time: string;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  wind_gust_kmh: number | null;
  precipitation_mm: number | null;
};

export type HourlySummary = {
  hour: number;
  models: number;
  windLow: number | null;
  windHigh: number | null;
  windDirection: number | null;
  gustLow: number | null;
  gustHigh: number | null;
  rainHigh: number | null;
  rainModels: number;
  rainDataModels: number;
};

function bounds(values: (number | null)[]): [number | null, number | null] {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return present.length ? [Math.min(...present), Math.max(...present)] : [null, null];
}

/** Rangos por hora local: cantidad de modelos es acuerdo, nunca probabilidad. */
export function summarizeHours(rows: HourlyRow[], timeZone: string, date: string): HourlySummary[] {
  const byHour = new Map<number, Map<string, HourlyRow>>();
  for (const row of rows) {
    const valid = new Date(row.valid_time);
    if (Number.isNaN(valid.getTime())) continue;
    const local = localDateParts(valid, timeZone);
    if (local.date !== date) continue;
    const models = byHour.get(local.hour) ?? new Map<string, HourlyRow>();
    models.set(row.model, row);
    byHour.set(local.hour, models);
  }

  return [...byHour.entries()].sort(([a], [b]) => a - b).map(([hour, models]) => {
    const values = [...models.values()];
    const [windLow, windHigh] = bounds(values.map((row) => row.wind_speed_kmh));
    const windDirection = windHigh === null
      ? null
      : values.find((row) => row.wind_speed_kmh === windHigh)?.wind_direction_deg ?? null;
    const [gustLow, gustHigh] = bounds(values.map((row) => row.wind_gust_kmh));
    const [, rainHigh] = bounds(values.map((row) => row.precipitation_mm));
    return {
      hour,
      models: models.size,
      windLow,
      windHigh,
      windDirection,
      gustLow,
      gustHigh,
      rainHigh,
      rainModels: values.filter((row) => row.precipitation_mm !== null && row.precipitation_mm > 0).length,
      rainDataModels: values.filter((row) => row.precipitation_mm !== null).length,
    };
  });
}

/** Une horas consecutivas donde al menos un modelo prevé precipitación. */
export function rainWindows(hours: HourlySummary[]): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (const hour of hours) {
    if (hour.rainModels === 0) continue;
    const last = windows.at(-1);
    if (last && hour.hour === last.end + 1) last.end = hour.hour;
    else windows.push({ start: hour.hour, end: hour.hour });
  }
  return windows;
}
