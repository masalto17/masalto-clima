import { describe, expect, it } from "vitest";
import type { DaySummary } from "./combine";
import { dayPhrase, dayStatus, directionName, windSentence, windWord } from "./phrases";

const day: DaySummary = {
  date: "2026-09-30",
  temperatureMin: 11.6,
  temperatureMax: 26.2,
  precipitation: 0,
  precipitationHigh: 0.2,
  windMax: 24,
  windDirection: 180,
  gustMax: 45.4,
  gustLow: 30,
  gustHour: 16,
  models: 5,
};

describe("frases del día", () => {
  it("usa la escala de Beaufort para nombrar el viento", () => {
    expect(windWord(10)).toBe("poco viento");
    expect(windWord(20)).toBe("viento moderado");
    expect(windWord(39)).toBe("viento intenso");
    expect(windWord(50)).toBe("viento fuerte");
    expect(windWord(62)).toBe("viento muy fuerte");
  });

  it("nombra la dirección completa", () => {
    expect(directionName(180)).toBe("sur");
    expect(directionName(225)).toBe("suroeste");
    expect(directionName(355)).toBe("norte");
  });

  it("arma el día en frases simples", () => {
    expect(dayPhrase(day)).toBe(
      "Sin lluvia. De 12 a 26 °C. Viento moderado del sur, ráfagas de hasta 45 km/h a las 16 h.",
    );
    expect(dayPhrase({ ...day, precipitation: 2, precipitationHigh: 11.6 })).toMatch(
      /^Lluvia de 2 a 12 mm\./,
    );
    expect(dayPhrase({ ...day, precipitation: 0.3, precipitationHigh: 4 })).toMatch(
      /^Puede llover hasta 4 mm\./,
    );
    expect(windSentence({ ...day, gustMax: null })).toBe("Viento moderado del sur.");
    expect(windSentence({ ...day, gustHour: 0 })).toMatch(/45 km\/h a la medianoche\.$/);
  });

  it("elige el estado por el fenómeno más importante", () => {
    expect(dayStatus(day)).toEqual({ label: "Tranquilo", tone: "calm" });
    expect(dayStatus({ ...day, precipitationHigh: 3 })).toEqual({ label: "Puede llover", tone: "info" });
    expect(dayStatus({ ...day, precipitation: 3 })).toEqual({ label: "Lluvia", tone: "info" });
    expect(dayStatus({ ...day, gustMax: 70 })).toEqual({ label: "Ventoso", tone: "info" });
    expect(dayStatus({ ...day, windMax: 52, precipitation: 5 })).toEqual({
      label: "Viento fuerte y lluvia",
      tone: "warning",
    });
    expect(dayStatus({ ...day, windMax: 65 }).label).toBe("Viento muy fuerte");
    expect(dayStatus({ ...day, windMax: null, temperatureMax: null }).label).toBe("Sin datos");
  });
});
