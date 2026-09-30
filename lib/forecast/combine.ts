import type { ForecastRow } from "./types";

/** Resumen combinado de un día local para un lugar. */
export type DaySummary = {
  /** Día local, `YYYY-MM-DD`. */
  date: string;
  temperatureMin: number | null;
  temperatureMax: number | null;
  /** Lluvia del día: mediana entre modelos y el modelo que más da. */
  precipitation: number | null;
  precipitationHigh: number | null;
  /** Viento y ráfaga: valor alto del rango entre modelos (peor caso razonable). */
  windMax: number | null;
  windDirection: number | null;
  gustMax: number | null;
  /** El modelo que menos ráfaga da: con `gustMax` muestra la dispersión. */
  gustLow: number | null;
  /** Hora local (0 a 23) de la ráfaga máxima. */
  gustHour: number | null;
  /** Modelos con datos para todo el tramo del día que cubre el pronóstico. */
  models: number;
};

type ForecastValues = Pick<
  ForecastRow,
  | "model"
  | "valid_time"
  | "temperature_c"
  | "precipitation_mm"
  | "wind_speed_kmh"
  | "wind_gust_kmh"
  | "wind_direction_deg"
>;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function present(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

/** Día y hora locales de un instante, en la zona horaria del lugar. */
export function localDateParts(date: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/**
 * Combina la última corrida de cada modelo en un resumen por día local, desde hoy.
 * Temperatura y lluvia: mediana entre modelos. Viento y ráfaga: el valor más alto.
 */
export function summarizeDays(
  rows: ForecastValues[],
  timeZone: string,
  now: Date,
  days = 7,
): DaySummary[] {
  const today = localDateParts(now, timeZone).date;

  // día → modelo → filas con su hora local
  const byDay = new Map<string, Map<string, (ForecastValues & { hour: number })[]>>();
  for (const row of rows) {
    const { date, hour } = localDateParts(new Date(row.valid_time), timeZone);
    if (date < today) continue;
    const byModel = byDay.get(date) ?? new Map();
    byDay.set(date, byModel);
    byModel.set(row.model, [...(byModel.get(row.model) ?? []), { ...row, hour }]);
  }

  return [...byDay.keys()]
    .sort()
    .slice(0, days)
    .map((date) => {
      const byModel = byDay.get(date)!;
      // Mínimas, máximas y acumulados solo con modelos que cubren el mismo tramo del día:
      // uno que corta antes (WRF a 72 h) daría una máxima o una lluvia falsa.
      const coverage = Math.max(...[...byModel.values()].map((hours) => hours.length));
      const complete = [...byModel.values()].filter((hours) => hours.length === coverage);

      const dailyOf = (
        pick: (row: ForecastValues) => number | null,
        reduce: (values: number[]) => number,
      ) =>
        present(
          complete.map((hours) => {
            const values = present(hours.map(pick));
            return values.length ? reduce(values) : null;
          }),
        );
      const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

      const precipitation = dailyOf((row) => row.precipitation_mm, sum);
      const gustByModel = dailyOf((row) => row.wind_gust_kmh, (v) => Math.max(...v));

      // Peor caso: se miran todos los modelos, también los que cubren parte del día.
      const all = [...byModel.values()].flat();
      const strongest = (pick: (row: ForecastValues) => number | null) =>
        all.reduce<(typeof all)[number] | null>((best, row) => {
          const value = pick(row);
          if (value === null) return best;
          return best === null || value > (pick(best) ?? -Infinity) ? row : best;
        }, null);
      const windRow = strongest((row) => row.wind_speed_kmh);
      const gustRow = strongest((row) => row.wind_gust_kmh);

      return {
        date,
        temperatureMin: median(dailyOf((row) => row.temperature_c, (v) => Math.min(...v))),
        temperatureMax: median(dailyOf((row) => row.temperature_c, (v) => Math.max(...v))),
        precipitation: median(precipitation),
        precipitationHigh: precipitation.length ? Math.max(...precipitation) : null,
        windMax: windRow?.wind_speed_kmh ?? null,
        windDirection: windRow?.wind_direction_deg ?? null,
        gustMax: gustRow?.wind_gust_kmh ?? null,
        gustLow: gustByModel.length ? Math.min(...gustByModel) : null,
        gustHour: gustRow?.hour ?? null,
        models: complete.length,
      };
    });
}
