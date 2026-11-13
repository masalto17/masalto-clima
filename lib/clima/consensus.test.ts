import { describe, expect, it } from "vitest";
import { consensusHours, trustedUpper, weightedMean } from "./consensus";
import type { HourPoint } from "./types";

const hour = "2026-11-13T18:00:00.000Z";

function point(source: string, values: Partial<HourPoint>): HourPoint {
  return {
    placeId: "estadio-san-juan",
    source,
    validTime: hour,
    temperature_c: null,
    humidity_pct: null,
    precipitation_mm: null,
    wind_speed_kmh: null,
    wind_gust_kmh: null,
    wind_direction_deg: null,
    pressure_hpa: null,
    ...values,
  };
}

const even = () => 1;

describe("consenso", () => {
  it("promedia la temperatura con el peso de cada fuente", () => {
    expect(
      weightedMean([
        { source: "a", value: 10, weight: 1 },
        { source: "b", value: 20, weight: 3 },
      ]),
    ).toBe(17.5);
  });

  it("en viento, con pesos iguales, se queda con el máximo", () => {
    const chosen = trustedUpper([
      { source: "ecmwf", value: 30, weight: 1 },
      { source: "gfs", value: 80, weight: 1 },
    ]);
    expect(chosen).toMatchObject({ source: "gfs", value: 80 });
  });

  it("deja afuera la ráfaga de una fuente que ya viene errando", () => {
    const chosen = trustedUpper([
      { source: "ecmwf", value: 28, weight: 10 },
      { source: "gfs", value: 90, weight: 1 },
    ]);
    expect(chosen).toMatchObject({ source: "ecmwf", value: 28 });
  });

  it("arma la hora y conserva el pico aunque no entre al consenso", () => {
    const [row] = consensusHours(
      [
        point("ecmwf", { wind_gust_kmh: 28, wind_speed_kmh: 20, wind_direction_deg: 270, temperature_c: 30 }),
        point("gfs", { wind_gust_kmh: 90, wind_speed_kmh: 40, wind_direction_deg: 180, temperature_c: 20 }),
      ],
      (source) => (source === "ecmwf" ? 10 : 1),
    );
    expect(row.wind_gust_kmh).toBe(28);
    expect(row.gustPeak_kmh).toBe(90);
    expect(row.gustPeakSource).toBe("gfs");
    expect(row.wind_direction_deg).toBe(270);
    expect(row.temperature_c).toBeCloseTo((30 * 10 + 20) / 11);
  });

  it("no mezcla la presión a nivel del mar con la de superficie", () => {
    const [row] = consensusHours(
      [
        point("ecmwf", { pressure_hpa: 940 }),
        point("met-norway", { pressure_hpa: 1010, pressureIsMsl: true }),
      ],
      even,
    );
    expect(row.pressure_hpa).toBe(940);
  });
});
