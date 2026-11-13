import type { ConsensusHour, HourPoint, Variable } from "./types";

type Weighted = { source: string; value: number; weight: number };

function usable(samples: Weighted[]): Weighted[] {
  return samples.filter((sample) => Number.isFinite(sample.value) && sample.weight > 0);
}

/** Promedio ponderado. Peso 1 = la fuente todavía no tiene historial. */
export function weightedMean(samples: Weighted[]): number | null {
  const rows = usable(samples);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return rows.reduce((sum, row) => sum + row.value * row.weight, 0) / total;
}

/**
 * Peor caso razonable para viento y ráfaga.
 * Con pesos iguales es el máximo (la regla actual del proyecto).
 * Una fuente con peso menor a la mitad de la mejor queda afuera: ya mostró
 * un error bastante más grande en esa variable. Su pico igual se informa aparte.
 */
export function trustedUpper(samples: Weighted[], trustRatio = 0.5): Weighted | null {
  const rows = usable(samples);
  if (rows.length === 0) return null;
  const maxWeight = Math.max(...rows.map((row) => row.weight));
  const trusted = rows.filter((row) => row.weight >= maxWeight * trustRatio);
  return trusted.reduce((best, row) => (row.value > best.value ? row : best));
}

function samples(
  rows: HourPoint[],
  pick: (row: HourPoint) => number | null,
  weightOf: (source: string, variable: Variable) => number,
  variable: Variable,
): Weighted[] {
  return rows.flatMap((row) => {
    const value = pick(row);
    if (value === null) return [];
    return [{ source: row.source, value, weight: weightOf(row.source, variable) }];
  });
}

/** Combina las horas de todas las fuentes. Cada `validTime` ya está en hora UTC. */
export function consensusHours(
  points: HourPoint[],
  weightOf: (source: string, variable: Variable) => number,
): ConsensusHour[] {
  const byTime = new Map<string, HourPoint[]>();
  for (const point of points) {
    byTime.set(point.validTime, [...(byTime.get(point.validTime) ?? []), point]);
  }

  return [...byTime.keys()].sort().map((validTime) => {
    const rows = byTime.get(validTime)!;
    const wind = trustedUpper(samples(rows, (row) => row.wind_speed_kmh, weightOf, "wind_speed_kmh"));
    const gust = trustedUpper(samples(rows, (row) => row.wind_gust_kmh, weightOf, "wind_gust_kmh"));
    const rain = samples(rows, (row) => row.precipitation_mm, weightOf, "precipitation_mm");
    const rainUpper = trustedUpper(rain);
    const windRow = wind ? rows.find((row) => row.source === wind.source && row.wind_direction_deg !== null) : undefined;
    let gustPeak: Weighted | null = null;
    for (const row of rows) {
      if (row.wind_gust_kmh === null) continue;
      const candidate = { source: row.source, value: row.wind_gust_kmh, weight: 1 };
      if (!gustPeak || candidate.value > gustPeak.value) gustPeak = candidate;
    }
    const pressure = weightedMean(
      samples(
        rows.filter((row) => !row.pressureIsMsl),
        (row) => row.pressure_hpa,
        weightOf,
        "pressure_hpa",
      ),
    );

    return {
      validTime,
      temperature_c: weightedMean(samples(rows, (row) => row.temperature_c, weightOf, "temperature_c")),
      humidity_pct: weightedMean(samples(rows, (row) => row.humidity_pct, weightOf, "humidity_pct")),
      precipitation_mm: weightedMean(rain),
      rainHigh_mm: rainUpper?.value ?? null,
      wind_speed_kmh: wind?.value ?? null,
      wind_direction_deg: windRow?.wind_direction_deg ?? null,
      wind_gust_kmh: gust?.value ?? null,
      gustPeak_kmh: gustPeak?.value ?? null,
      gustPeakSource: gustPeak?.source ?? null,
      pressure_hpa: pressure,
      sources: new Set(rows.map((row) => row.source)).size,
    };
  });
}
