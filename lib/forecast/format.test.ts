import { describe, expect, it } from "vitest";
import type { DaySummary } from "./combine";
import {
  compass,
  formatAgo,
  formatDayLabel,
  formatDayLine,
  formatGust,
  formatPrecipitation,
} from "./format";

const day: DaySummary = {
  date: "2026-09-30",
  temperatureMin: 8.6,
  temperatureMax: 24.2,
  precipitation: 0,
  precipitationHigh: 0.04,
  windMax: 27.6,
  windDirection: 265,
  gustMax: 61.7,
  gustLow: 40,
  gustHour: 16,
  models: 5,
};

describe("formato del pronóstico", () => {
  it("arma la etiqueta del día", () => {
    expect(formatDayLabel("2026-09-30")).toBe("mié 30");
    expect(formatDayLabel("2026-10-04")).toBe("dom 4");
  });

  it("convierte grados en punto cardinal", () => {
    expect(compass(0)).toBe("N");
    expect(compass(265)).toBe("O");
    expect(compass(350)).toBe("N");
    expect(compass(135)).toBe("SE");
  });

  it("dice hace cuánto se actualizó", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(formatAgo(new Date("2026-09-30T11:59:50Z"), now)).toBe("recién");
    expect(formatAgo(new Date("2026-09-30T11:48:00Z"), now)).toBe("hace 12 min");
    expect(formatAgo(new Date("2026-09-30T09:00:00Z"), now)).toBe("hace 3 h");
    expect(formatAgo(new Date("2026-09-27T12:00:00Z"), now)).toBe("hace 3 días");
  });

  it("muestra el rango de lluvia cuando los modelos no coinciden", () => {
    expect(formatPrecipitation(day)).toBe("sin lluvia");
    expect(formatPrecipitation({ ...day, precipitation: 0, precipitationHigh: 4.26 })).toBe(
      "0 a 4,3 mm",
    );
    expect(formatPrecipitation({ ...day, precipitation: 12.4, precipitationHigh: 12.4 })).toBe(
      "12 mm",
    );
    expect(formatPrecipitation({ ...day, precipitation: null })).toBe("sin dato");
  });

  it("arma la línea del día con la ráfaga más alta y su hora", () => {
    expect(formatDayLine(day)).toBe(
      "mié 30: 9 a 24 °C · sin lluvia · viento 28 km/h del O · ráfagas hasta 62 km/h (16 h)",
    );
    expect(formatGust({ ...day, gustMax: null })).toBe("sin dato");
  });
});
