import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "./thresholds";
import type { ConsensusHour } from "./types";
import { detectZonda, isWesterly } from "./zonda";

const NOW = new Date("2026-11-13T18:00:00.000Z");

function hour(iso: string, values: Partial<ConsensusHour>): ConsensusHour {
  return {
    validTime: iso,
    temperature_c: 30,
    humidity_pct: 40,
    precipitation_mm: 0,
    rainHigh_mm: 0,
    wind_speed_kmh: 10,
    wind_direction_deg: 180,
    wind_gust_kmh: 15,
    gustPeak_kmh: 15,
    gustPeakSource: "ecmwf",
    pressure_hpa: 940,
    sources: 3,
    ...values,
  };
}

function detect(hours: ConsensusHour[], extra?: { enabled?: boolean; official?: boolean }) {
  return detectZonda(hours, {
    enabled: extra?.enabled ?? true,
    official: extra?.official ?? false,
    officialDetail: "Zonda en la precordillera.",
    thresholds: DEFAULT_THRESHOLDS,
    from: new Date(NOW.getTime() - 3_600_000),
    until: new Date(NOW.getTime() + 48 * 3_600_000),
  });
}

describe("Zonda", () => {
  it("reconoce el sector oeste-noroeste", () => {
    expect(isWesterly(270)).toBe(true);
    expect(isWesterly(300)).toBe(true);
    expect(isWesterly(180)).toBe(false);
    expect(isWesterly(20)).toBe(false);
    expect(isWesterly(null)).toBe(false);
  });

  it("marca probable con oeste, ráfaga y humedad muy baja", () => {
    const result = detect([
      hour("2026-11-13T18:00:00.000Z", { wind_direction_deg: 290, wind_gust_kmh: 62, wind_speed_kmh: 40, humidity_pct: 18 }),
    ]);
    expect(result.level).toBe("probable");
    expect(result.title).toBe("Posible Zonda");
    expect(result.reasons.join(" ")).toMatch(/noroeste|oeste/);
    expect(result.reasons.join(" ")).toMatch(/18/);
  });

  it("no confunde una tarde seca y quieta con Zonda", () => {
    const result = detect([
      hour("2026-11-13T18:00:00.000Z", { wind_direction_deg: 300, wind_gust_kmh: 12, humidity_pct: 15, temperature_c: 34 }),
    ]);
    expect(result.level).toBe("none");
  });

  it("no marca Zonda si el viento fuerte viene del sur", () => {
    const result = detect([
      hour("2026-11-13T18:00:00.000Z", { wind_direction_deg: 180, wind_gust_kmh: 80, humidity_pct: 12 }),
    ]);
    expect(result.level).toBe("none");
  });

  it("queda en vigilancia si la señal está a medias", () => {
    const result = detect([
      hour("2026-11-13T18:00:00.000Z", { wind_direction_deg: 280, wind_gust_kmh: 42, humidity_pct: 30 }),
    ]);
    expect(result.level).toBe("vigilancia");
  });

  it("usa la suba de temperatura en 3 horas cuando el aire todavía no está seco del todo", () => {
    const result = detect([
      hour("2026-11-13T15:00:00.000Z", { temperature_c: 22, humidity_pct: 55, wind_direction_deg: 270, wind_gust_kmh: 20 }),
      hour("2026-11-13T18:00:00.000Z", { temperature_c: 34, humidity_pct: 32, wind_direction_deg: 280, wind_gust_kmh: 58 }),
    ]);
    expect(result.level).toBe("probable");
    expect(result.reasons.join(" ")).toMatch(/temperatura|humedad/);
  });

  it("una alerta oficial manda, aunque el lugar no use el detector de modelo", () => {
    const result = detect([hour("2026-11-13T18:00:00.000Z", { wind_gust_kmh: 5 })], { enabled: false, official: true });
    expect(result.level).toBe("oficial");
    expect(result.detail).toMatch(/precordillera/);
  });

  it("no corre el detector de modelo fuera de Cuyo", () => {
    const result = detect(
      [hour("2026-11-13T18:00:00.000Z", { wind_direction_deg: 290, wind_gust_kmh: 70, humidity_pct: 10 })],
      { enabled: false },
    );
    expect(result.level).toBe("none");
  });
});
