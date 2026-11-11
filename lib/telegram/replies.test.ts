import { describe, expect, it } from "vitest";
import type { DaySummary } from "@/lib/forecast/combine";
import type { Overview } from "@/lib/forecast/queries";
import { parseIntent } from "./intents";
import { buildReply } from "./replies";

const NOW = new Date("2026-09-30T15:00:00Z"); // 12:00 del 30 en Argentina

function day(date: string, overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    date,
    temperatureMin: 9,
    temperatureMax: 24,
    precipitation: 0,
    precipitationHigh: 0,
    windMax: 28,
    windDirection: 270,
    gustMax: 62,
    gustLow: 40,
    gustHour: 16,
    models: 5,
    ...overrides,
  };
}

const overview: Overview = {
  places: [
    {
      place: { id: "sj", name: "San Juan Ciudad", timezone: "America/Argentina/San_Juan" },
      sources: ["open-meteo", "smn-wrf"],
      hourlyToday: [],
      hourlyTomorrow: [],
      days: [day("2026-09-30"), day("2026-10-01", { gustMax: 80, gustHour: 15 })],
    },
    {
      place: { id: "va", name: "Córdoba Villa Allende", timezone: "America/Argentina/Cordoba" },
      sources: ["open-meteo"],
      hourlyToday: [],
      hourlyTomorrow: [],
      days: [day("2026-09-30", { precipitation: 2, precipitationHigh: 11.6 })],
    },
  ],
  health: [
    { source: "open-meteo", last_ok_at: "2026-09-30T14:48:00Z" },
    { source: "smn-wrf", last_ok_at: "2026-09-30T06:00:00Z" },
  ],
};

const reply = (text: string, data = overview) => buildReply(parseIntent(text), data, "Hugo", NOW);

describe("buildReply", () => {
  it("/semana sin lugar manda todos los lugares", () => {
    const text = reply("/semana");
    expect(text).toContain("San Juan Ciudad\nmié 30 · Ventoso.");
    expect(text).toContain("Córdoba Villa Allende\nmié 30 · Ventoso y lluvia. Lluvia de 2 a 12 mm.");
  });

  it("/semana con lugar manda solo ese", () => {
    const text = reply("/semana cordoba");
    expect(text).toContain("Córdoba Villa Allende");
    expect(text).not.toContain("San Juan Ciudad");
  });

  it("/semana con un lugar desconocido no adivina", () => {
    expect(reply("/semana mendoza")).toBe(
      "No encontré ese lugar. Lugares guardados: San Juan Ciudad, Córdoba Villa Allende.",
    );
  });

  it("responde una pregunta de viento para mañana con la ráfaga más alta", () => {
    expect(reply("viento mañana en san juan")).toContain(
      "San Juan Ciudad, mañana (jue 1): Viento moderado del oeste, ráfagas de hasta 80 km/h a las 15 h.",
    );
  });

  it("sin lugar responde para todos, y avisa si falta el dato", () => {
    const text = reply("llueve mañana?");
    expect(text).toContain("San Juan Ciudad, mañana (jue 1): Sin lluvia.");
    expect(text).toContain("Córdoba Villa Allende, mañana (jue 1): sin dato.");
    expect(reply("lluvia hoy en cordoba")).toContain("hoy (mié 30): Lluvia de 2 a 12 mm.");
  });

  it("el pie dice la frescura, avisa fuentes caídas y atribuye al SMN", () => {
    const text = reply("/semana");
    expect(text).toContain("Actualizado: Open-Meteo hace 12 min, WRF SMN hace 9 h.");
    expect(text).toContain("Atención: WRF SMN sin actualizar hace más de 6 h.");
    expect(text).toContain("Fuente: Open-Meteo y SMN.");
  });

  it("sin datos manda a usar el SMN", () => {
    const empty = { ...overview, places: overview.places.map((p) => ({ ...p, days: [] })) };
    expect(reply("/semana", empty)).toBe("Sistema sin datos, usar SMN.");
    expect(reply("/semana", { places: [], health: [] })).toBe("Todavía no hay lugares guardados.");
  });
});
