import { describe, expect, it } from "vitest";
import { parseMetarObs, parseMetNorway, parseOpenMeteo, parseOpenWeather, parseSmnTiepre, parseWeatherApi, pickSmnStation, relativeHumidity } from "./parse";

describe("lectores de fuentes", () => {
  it("lee una hora de Open-Meteo por modelo", () => {
    const points = parseOpenMeteo(
      {
        hourly: {
          time: [1794528000],
          temperature_2m_ecmwf_ifs025: [31.5],
          wind_gusts_10m_ecmwf_ifs025: [44],
          wind_speed_10m_gfs_seamless: [12],
        },
      },
      [{ id: "estadio-san-juan" }],
    );
    expect(points.map((point) => point.source).sort()).toEqual(["om-ecmwf", "om-gfs"]);
    expect(points.find((point) => point.source === "om-ecmwf")).toMatchObject({
      temperature_c: 31.5,
      wind_gust_kmh: 44,
      validTime: "2026-11-13T00:00:00.000Z",
    });
  });

  it("pasa el viento de MET Norway de m/s a km/h y no inventa lluvia de 6 horas", () => {
    const [point] = parseMetNorway(
      {
        properties: {
          timeseries: [
            {
              time: "2026-11-13T18:00:00Z",
              data: {
                instant: { details: { air_temperature: 29, wind_speed: 5, wind_from_direction: 270, air_pressure_at_sea_level: 1008 } },
                next_6_hours: { details: { precipitation_amount: 6 } },
              },
            },
          ],
        },
      },
      "estadio-san-juan",
    );
    expect(point.wind_speed_kmh).toBe(18);
    expect(point.precipitation_mm).toBeNull();
    expect(point.pressureIsMsl).toBe(true);
  });

  it("convierte el viento de OpenWeather, que sigue en m/s", () => {
    const [point] = parseOpenWeather(
      { list: [{ dt: 1794592800, main: { temp: 27, humidity: 30, pressure: 1010 }, wind: { speed: 10, gust: 15, deg: 300 }, rain: { "3h": 1.2 } }] },
      "san-juan-ciudad",
    );
    expect(point.wind_speed_kmh).toBe(36);
    expect(point.wind_gust_kmh).toBe(54);
    expect(point.precipitation_mm).toBeCloseTo(0.4);
    expect(point.pressureIsMsl).toBe(true);
  });

  it("no mezcla la presión de WeatherAPI, que es a nivel del mar", () => {
    const [point] = parseWeatherApi(
      { forecast: { forecastday: [{ hour: [{ time_epoch: 1794592800, temp_c: 22, pressure_mb: 1012, precip_mm: 0.2 }] }] } },
      "villa-allende",
    );
    expect(point.pressureIsMsl).toBe(true);
    expect(point.precipitation_mm).toBe(0.2);
  });

  it("elige Córdoba exacta y, si no está, el observatorio", () => {
    const rows = parseSmnTiepre(
      [
        "Córdoba Observatorio;12-noviembre-2026;21:00;Despejado;10 km;29.5;30.7; 52;Noreste  7;963.8 /",
        "Córdoba;12-noviembre-2026;22:00;Despejado;15 km;22.8;No se calcula; 78;Norte  9;956.5 /",
      ].join("\n"),
    );
    expect(pickSmnStation(rows, "Córdoba")?.temperature_c).toBe(22.8);
    expect(pickSmnStation(rows.filter((row) => row.station !== "Córdoba"), "Córdoba")?.station).toBe("Córdoba Observatorio");
  });

  it("lee la fila del SMN en hora de Argentina", () => {
    const [row] = parseSmnTiepre("San Juan;12-noviembre-2026;22:00;Despejado;15 km;30.3;No se calcula; 23;Sur  5;939 / \n");
    expect(row).toMatchObject({
      station: "San Juan",
      time: "2026-11-13T01:00:00.000Z",
      temperature_c: 30.3,
      humidity_pct: 23,
      wind_speed_kmh: 5,
      wind_direction_deg: 180,
      pressure_hpa: 939,
    });
  });

  it("pasa el METAR de nudos a km/h y calcula la humedad", () => {
    const [row] = parseMetarObs([
      { icaoId: "SANU", obsTime: 1794592800, temp: 31, dewp: 8, wdir: 270, wspd: 10, wgst: 20, altim: 1006 },
    ]);
    expect(row.icao).toBe("SANU");
    expect(row.wind_speed_kmh).toBeCloseTo(18.5, 1);
    expect(row.wind_gust_kmh).toBeCloseTo(37, 0);
    expect(row.humidity_pct).toBeCloseTo(relativeHumidity(31, 8), 1);
    expect(row.wind_direction_deg).toBe(270);
  });
});
