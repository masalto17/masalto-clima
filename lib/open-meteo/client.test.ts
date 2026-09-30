import { describe, expect, it, vi } from "vitest";
import {
  OPEN_METEO_MODELS,
  buildForecastUrl,
  fetchForecasts,
  parseForecastResponse,
  runSlot,
} from "./client";

const places = [
  { id: "sj", lat: -31.5375, lon: -68.5364 },
  { id: "va", lat: -31.29362, lon: -64.29762 },
];

const T0 = Date.UTC(2026, 8, 30, 0) / 1000;

function location(overrides: Record<string, (number | null)[]> = {}) {
  const hourly: Record<string, (number | null)[]> = { time: [T0, T0 + 3600] };
  for (const model of OPEN_METEO_MODELS) {
    hourly[`temperature_2m_${model}`] = [15, 14];
    hourly[`relative_humidity_2m_${model}`] = [40, 45];
    hourly[`precipitation_${model}`] = [0, 0.2];
    hourly[`wind_speed_10m_${model}`] = [10, 12];
    hourly[`wind_gusts_10m_${model}`] = [20, 25];
    hourly[`wind_direction_10m_${model}`] = [270, 280];
    hourly[`surface_pressure_${model}`] = [940, 941];
  }
  return { hourly: { ...hourly, ...overrides } };
}

describe("runSlot", () => {
  it("redondea hacia abajo a la franja de 6 h UTC", () => {
    expect(runSlot(new Date("2026-09-30T08:47:12Z"))).toBe("2026-09-30T06:00:00.000Z");
    expect(runSlot(new Date("2026-09-30T00:00:00Z"))).toBe("2026-09-30T00:00:00.000Z");
    expect(runSlot(new Date("2026-09-30T23:59:59Z"))).toBe("2026-09-30T18:00:00.000Z");
  });
});

describe("buildForecastUrl", () => {
  it("pide todos los lugares y modelos en una sola consulta", () => {
    const url = new URL(buildForecastUrl(places));
    expect(url.host).toBe("api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("-31.5375,-31.29362");
    expect(url.searchParams.get("models")).toBe(OPEN_METEO_MODELS.join(","));
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(url.searchParams.has("apikey")).toBe(false);
  });

  it("con clave usa el host comercial", () => {
    const url = new URL(buildForecastUrl(places, "clave"));
    expect(url.host).toBe("customer-api.open-meteo.com");
    expect(url.searchParams.get("apikey")).toBe("clave");
  });
});

describe("parseForecastResponse", () => {
  const runTime = "2026-09-30T06:00:00.000Z";

  it("arma una fila por lugar, modelo y hora", () => {
    const rows = parseForecastResponse([location(), location()], places, runTime);
    expect(rows).toHaveLength(2 * OPEN_METEO_MODELS.length * 2);
    expect(rows[1]).toEqual({
      place_id: "sj",
      source: "open-meteo",
      model: "ecmwf_ifs025",
      run_time: runTime,
      valid_time: "2026-09-30T01:00:00.000Z",
      temperature_c: 14,
      humidity_pct: 45,
      precipitation_mm: 0.2,
      wind_speed_kmh: 12,
      wind_gust_kmh: 25,
      wind_direction_deg: 280,
      pressure_hpa: 941,
    });
    expect(rows.at(-1)?.place_id).toBe("va");
  });

  it("acepta la respuesta de un solo lugar (objeto, no lista)", () => {
    const rows = parseForecastResponse(location(), [places[0]], runTime);
    expect(rows).toHaveLength(OPEN_METEO_MODELS.length * 2);
  });

  it("saltea las horas en las que un modelo no trae ningún dato", () => {
    const sinDatos = Object.fromEntries(
      [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "wind_speed_10m",
        "wind_gusts_10m",
        "wind_direction_10m",
        "surface_pressure",
      ].map((variable) => [`${variable}_meteofrance_seamless`, [15, null]]),
    );
    const rows = parseForecastResponse(location(sinDatos), [places[0]], runTime);
    expect(rows.filter((row) => row.model === "meteofrance_seamless")).toHaveLength(1);
  });

  it("falla si la cantidad de lugares no coincide", () => {
    expect(() => parseForecastResponse([location()], places, runTime)).toThrow(/lugares/);
  });
});

describe("fetchForecasts", () => {
  it("falla sin exponer la URL cuando la API responde con error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("x", { status: 429 }));
    await expect(
      fetchForecasts(places, { now: new Date(), apiKey: "clave", fetchFn }),
    ).rejects.toThrow("Open-Meteo falló: HTTP 429");
  });

  it("no consulta si no hay lugares", async () => {
    const fetchFn = vi.fn();
    expect(await fetchForecasts([], { now: new Date(), fetchFn })).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
