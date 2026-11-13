import { describe, expect, it } from "vitest";
import { emptyLedger, leadForecasts, updateLedger, weightFor } from "./accuracy";
import type { HourPoint, Observation } from "./types";

const NOW = new Date("2026-11-13T18:00:00.000Z");
const VALID = "2026-11-13T12:00:00.000Z";

function forecast(source: string, gust: number | null) {
  return {
    placeId: "estadio-san-juan",
    source,
    issuedAt: "2026-11-13T06:00:00.000Z",
    validTime: VALID,
    leadHours: 6,
    temperature_c: 30,
    humidity_pct: 20,
    precipitation_mm: null,
    wind_speed_kmh: 15,
    wind_gust_kmh: gust,
  };
}

function obs(source: Observation["source"], time: string, gust: number | null): Observation {
  return {
    placeId: "estadio-san-juan",
    source,
    label: source,
    time,
    temperature_c: 28,
    humidity_pct: 25,
    precipitation_mm: null,
    wind_speed_kmh: 10,
    wind_gust_kmh: gust,
    wind_direction_deg: 180,
    pressure_hpa: null,
  };
}

describe("registro de aciertos", () => {
  it("compara contra el METAR y no cuenta una ráfaga que nadie midió", () => {
    const update = updateLedger(
      emptyLedger(NOW),
      [forecast("om-ecmwf", 40)],
      [obs("smn", VALID, null), obs("metar", "2026-11-13T12:20:00.000Z", null)],
      NOW,
    );
    expect(update.matched).toBe(1);
    expect(update.ledger.scores["om-ecmwf"]?.temperature_c).toMatchObject({ samples: 1, sumAbs: 2 });
    expect(update.ledger.scores["om-ecmwf"]?.wind_gust_kmh?.samples).toBe(0);
    expect(update.ledger.pending).toHaveLength(0);
  });

  it("no duplica el mismo pronóstico y deja abierto el que todavía no ocurre", () => {
    const first = updateLedger(emptyLedger(NOW), [forecast("om-gfs", 20)], [], NOW);
    const again = updateLedger(first.ledger, [forecast("om-gfs", 20)], [], NOW);
    expect(again.added).toBe(0);
    expect(again.ledger.pending).toHaveLength(1);

    const future = leadForecasts(
      [
        {
          placeId: "estadio-san-juan",
          source: "om-icon",
          validTime: "2026-11-14T00:00:00.000Z",
          temperature_c: 22,
          humidity_pct: null,
          precipitation_mm: 0,
          wind_speed_kmh: 12,
          wind_gust_kmh: 18,
          wind_direction_deg: 90,
          pressure_hpa: null,
        } satisfies HourPoint,
      ],
      NOW,
    );
    expect(future.map((row) => row.leadHours)).toEqual([6]);
  });

  it("recién pesa distinto después de 8 comparaciones", () => {
    expect(weightFor({ samples: 7, sumAbs: 70, sumErr: 0 }, 2)).toBe(1);
    expect(weightFor({ samples: 8, sumAbs: 80, sumErr: 0 }, 2)).toBeCloseTo(1 / 12);
  });
});
