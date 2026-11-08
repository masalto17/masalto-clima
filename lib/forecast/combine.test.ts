import { describe, expect, it } from "vitest";
import { localDateParts, summarizeDays } from "./combine";

const TZ = "America/Argentina/San_Juan"; // UTC-3
const NOW = new Date("2026-09-30T15:00:00Z"); // 12:00 local del 30

type Values = {
  temperature_c?: number | null;
  precipitation_mm?: number | null;
  wind_speed_kmh?: number | null;
  wind_gust_kmh?: number | null;
  wind_direction_deg?: number | null;
};

function row(model: string, localDay: number, localHour: number, values: Values) {
  return {
    model,
    valid_time: new Date(Date.UTC(2026, 8, localDay, localHour + 3)).toISOString(),
    temperature_c: null,
    precipitation_mm: null,
    wind_speed_kmh: null,
    wind_gust_kmh: null,
    wind_direction_deg: null,
    ...values,
  };
}

describe("localDateParts", () => {
  it("pasa de UTC al día y la hora del lugar", () => {
    expect(localDateParts(new Date("2026-10-01T02:30:00Z"), TZ)).toEqual({
      date: "2026-09-30",
      hour: 23,
    });
    expect(localDateParts(new Date("2026-10-01T03:00:00Z"), TZ)).toEqual({
      date: "2026-10-01",
      hour: 0,
    });
  });
});

describe("summarizeDays", () => {
  it("usa la mediana para temperatura y lluvia", () => {
    const rows = [
      ...["a", "b", "c"].flatMap((model, i) => [
        row(model, 30, 6, { temperature_c: 8 + i, precipitation_mm: i === 2 ? 6 : 0 }),
        row(model, 30, 16, { temperature_c: 22 + i * 2, precipitation_mm: i === 1 ? 1 : 0 }),
      ]),
    ];
    const [day] = summarizeDays(rows, TZ, NOW);
    expect(day.date).toBe("2026-09-30");
    expect(day.temperatureMin).toBe(9);
    expect(day.temperatureMax).toBe(24);
    expect(day.precipitation).toBe(1); // totales por modelo: 0, 1, 6
    expect(day.precipitationHigh).toBe(6);
    expect(day.models).toBe(3);
  });

  it("para viento y ráfaga toma el valor más alto entre modelos, no el promedio", () => {
    const rows = [
      row("a", 30, 15, { wind_speed_kmh: 20, wind_gust_kmh: 35, wind_direction_deg: 180 }),
      row("a", 30, 16, { wind_speed_kmh: 22, wind_gust_kmh: 40, wind_direction_deg: 200 }),
      row("b", 30, 15, { wind_speed_kmh: 38, wind_gust_kmh: 70, wind_direction_deg: 270 }),
      row("b", 30, 16, { wind_speed_kmh: 30, wind_gust_kmh: 62, wind_direction_deg: 260 }),
    ];
    const [day] = summarizeDays(rows, TZ, NOW);
    expect(day.windMax).toBe(38);
    expect(day.windDirection).toBe(270);
    expect(day.gustMax).toBe(70);
    expect(day.gustHour).toBe(15);
    expect(day.gustLow).toBe(40);
  });

  it("un modelo que cubre parte del día no entra en mínimas ni acumulados, sí en el viento", () => {
    const rows = [
      row("global", 30, 6, { temperature_c: 8, precipitation_mm: 2 }),
      row("global", 30, 16, { temperature_c: 24, precipitation_mm: 3, wind_speed_kmh: 20 }),
      row("wrf", 30, 6, { temperature_c: 14, precipitation_mm: 0, wind_speed_kmh: 45 }),
    ];
    const [day] = summarizeDays(rows, TZ, NOW);
    expect(day.temperatureMin).toBe(8);
    expect(day.temperatureMax).toBe(24);
    expect(day.precipitation).toBe(5);
    expect(day.windMax).toBe(45);
    expect(day.models).toBe(1);
  });

  it("descarta los días anteriores a hoy y corta en la cantidad pedida", () => {
    const rows = [
      row("a", 29, 22, { temperature_c: 10 }),
      row("a", 30, 10, { temperature_c: 15 }),
      row("a", 31, 10, { temperature_c: 16 }), // 1 de octubre
      row("a", 32, 10, { temperature_c: 17 }),
    ];
    const days = summarizeDays(rows, TZ, NOW, 2);
    expect(days.map((day) => day.date)).toEqual(["2026-09-30", "2026-10-01"]);
  });

  it("deja nulos cuando ningún modelo trae la variable", () => {
    const [day] = summarizeDays([row("wrf", 30, 10, { temperature_c: 15 })], TZ, NOW);
    expect(day.gustMax).toBeNull();
    expect(day.gustLow).toBeNull();
    expect(day.gustHour).toBeNull();
    expect(day.precipitation).toBeNull();
  });

  it("ignora filas con valid_time inválido", () => {
    const days = summarizeDays(
      [
        { ...row("a", 30, 10, { temperature_c: 15 }), valid_time: "no-es-fecha" },
        row("a", 30, 12, { temperature_c: 18 }),
      ],
      TZ,
      NOW,
    );
    expect(days).toHaveLength(1);
    expect(days[0].temperatureMax).toBe(18);
  });
});
