import { describe, expect, it } from "vitest";
import { rainWindows, summarizeHours } from "./hourly";

const timezone = "America/Argentina/San_Juan";
const row = (model: string, utc: string, wind: number | null, gust: number | null, rain: number | null) => ({
  model,
  valid_time: utc,
  wind_speed_kmh: wind,
  wind_direction_deg: model === "b" ? 180 : 270,
  wind_gust_kmh: gust,
  precipitation_mm: rain,
});

describe("pronóstico horario", () => {
  it("usa horas locales y conserva el rango entre modelos", () => {
    const hours = summarizeHours([
      row("a", "2026-11-12T22:00:00Z", 30, 48, 0),
      row("b", "2026-11-12T22:00:00Z", 55, 75, 2),
      row("wrf", "2026-11-12T22:00:00Z", 45, null, 0),
    ], timezone, "2026-11-12");
    expect(hours).toEqual([{
      hour: 19, models: 3, windLow: 30, windHigh: 55, windDirection: 180, gustLow: 48, gustHigh: 75,
      rainHigh: 2, rainModels: 1, rainDataModels: 3,
    }]);
  });

  it("no inventa lluvia ni ráfagas cuando faltan esos datos", () => {
    const [hour] = summarizeHours([row("wrf", "2026-11-12T22:00:00Z", 40, null, null)], timezone, "2026-11-12");
    expect(hour.rainDataModels).toBe(0);
    expect(hour.rainHigh).toBeNull();
    expect(hour.gustHigh).toBeNull();
  });

  it("agrupa sólo horas consecutivas con lluvia prevista", () => {
    const rows = [16, 17, 19].map((hour) => row("a", `2026-11-13T${String(hour + 3).padStart(2, "0")}:00:00Z`, 20, 30, 1));
    const hours = summarizeHours(rows, timezone, "2026-11-13");
    expect(rainWindows(hours)).toEqual([{ start: 16, end: 17 }, { start: 19, end: 19 }]);
  });
});
