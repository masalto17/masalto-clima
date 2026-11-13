import { describe, expect, it } from "vitest";
import { PUBLIC_PLACES } from "./places";
import { buildReport, type AlertInput } from "./report";
import { DEFAULT_THRESHOLDS } from "./thresholds";
import type { HourPoint } from "./types";

const NOW = new Date("2026-11-13T18:00:00.000Z");
const estadio = PUBLIC_PLACES[0];

function point(values: Partial<HourPoint>, validTime = "2026-11-13T18:00:00.000Z"): HourPoint {
  return {
    placeId: estadio.id,
    source: "om-ecmwf",
    validTime,
    temperature_c: 30,
    humidity_pct: 40,
    precipitation_mm: 0,
    wind_speed_kmh: 12,
    wind_gust_kmh: 18,
    wind_direction_deg: 160,
    pressure_hpa: 940,
    ...values,
  };
}

function report(points: HourPoint[], alerts: AlertInput[] = [], extraPoints: HourPoint[] = []) {
  return buildReport({
    now: NOW,
    places: [estadio],
    points: [...points, ...extraPoints],
    observations: [],
    alerts,
    alertsState: "ok",
    scores: {},
    thresholds: DEFAULT_THRESHOLDS,
    sources: [{ id: "om-ecmwf", label: "ECMWF", ok: points.length > 0 }],
    storage: "none",
  });
}

describe("estado", () => {
  it("dice todo bien cuando no hay nada que marcar", () => {
    const result = report([point({})]);
    expect(result.headline).toBe("Todo bien");
    expect(result.level).toBe("ok");
    expect(result.places[0].headline).toBe("Todo bien");
    expect(result.places[0].days[0].status).toBe("Todo bien");
  });

  it("marca alerta con ráfagas por encima del corte", () => {
    const result = report([point({ wind_gust_kmh: 80, wind_speed_kmh: 40 })]);
    expect(result.headline).toBe("Alerta");
    expect(result.places[0].reasons.map((reason) => reason.title)).toContain("Ráfagas fuertes");
    expect(result.places[0].reasons[0].detail).toMatch(/próxima hora/);
    expect(result.places[0].days[0].status).toBe("Ráfagas");
  });

  it("avisa que la ráfaga es de mañana, no de esta hora", () => {
    const result = report([
      point({ wind_gust_kmh: 12 }),
      point({ wind_gust_kmh: 80, wind_speed_kmh: 40 }, "2026-11-15T02:00:00.000Z"),
    ]);
    expect(result.places[0].reasons[0].detail).toMatch(/mañana a las 23 h/);
    expect(result.places[0].days[1].status).toBe("Ráfagas");
  });

  it("no dice todo bien si no llegó ningún modelo", () => {
    const result = report([]);
    expect(result.headline).toBe("Sin datos");
    expect(result.summary).toMatch(/usar SMN/);
    expect(result.degraded).toBe(true);
  });

  it("sin historial manda la ráfaga más alta; una fuente que viene errando no alcanza para la alerta", () => {
    const lone = report(
      [point({ source: "om-ecmwf", wind_gust_kmh: 20 })],
      [],
      [point({ source: "om-gfs", wind_gust_kmh: 90 })],
    );
    expect(lone.places[0].level).toBe("alerta");

    const trusted = buildReport({
      now: NOW,
      places: [estadio],
      points: [point({ source: "om-ecmwf", wind_gust_kmh: 20 }), point({ source: "om-gfs", wind_gust_kmh: 90 })],
      observations: [],
      alerts: [],
      alertsState: "ok",
      scores: {
        "om-ecmwf": { wind_gust_kmh: { samples: 20, sumAbs: 20, sumErr: 0 } },
        "om-gfs": { wind_gust_kmh: { samples: 20, sumAbs: 400, sumErr: 0 } },
      },
      thresholds: DEFAULT_THRESHOLDS,
      sources: [],
      storage: "blob",
    });
    expect(trusted.places[0].level).toBe("atencion");
    expect(trusted.places[0].reasons[0].title).toBe("Una fuente marca ráfagas altas");
    expect(trusted.ranking.find((row) => row.variable === "wind_gust_kmh")?.entries[0].label).toBe("ECMWF");
  });

  it("prioriza el Zonda sobre el cartel genérico de ráfaga", () => {
    const result = report([
      point({ wind_direction_deg: 290, wind_gust_kmh: 70, wind_speed_kmh: 40, humidity_pct: 16, temperature_c: 36 }),
    ]);
    expect(result.places[0].zonda.level).toBe("probable");
    expect(result.places[0].headline).toBe("Posible Zonda");
    expect(result.places[0].reasons.map((reason) => reason.code)).not.toContain("rafaga");
  });

  it("una tormenta oficial del SMN es alerta aunque el modelo esté quieto", () => {
    const result = report([point({})], [
      {
        placeId: estadio.id,
        event: "Tormentas fuertes",
        headline: "Tormentas en el Gran San Juan",
        description: "Lluvia intensa y ráfagas.",
        severity: "Severe",
        startsAt: "2026-11-13T17:00:00.000Z",
        expiresAt: "2026-11-13T22:00:00.000Z",
        sourceUrl: "https://ssl.smn.gob.ar/feeds/CAP/ejemplo.xml",
      },
    ]);
    expect(result.level).toBe("alerta");
    expect(result.places[0].reasons.map((reason) => reason.code)).toContain("tormenta");
    expect(result.places[0].days[0].status).toBe("Alerta");
  });
});
