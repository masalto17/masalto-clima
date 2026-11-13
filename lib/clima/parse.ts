import type { PublicPlace } from "./places";
import { OPEN_METEO_MODELS } from "./sources";
import { finite, hourIso } from "./time";
import type { HourPoint, Observation } from "./types";

const KT_TO_KMH = 1.852;
const MS_TO_KMH = 3.6;

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function blank(placeId: string, source: string, validTime: string): HourPoint {
  return {
    placeId,
    source,
    validTime,
    temperature_c: null,
    humidity_pct: null,
    precipitation_mm: null,
    wind_speed_kmh: null,
    wind_gust_kmh: null,
    wind_direction_deg: null,
    pressure_hpa: null,
  };
}

function hasValue(point: HourPoint): boolean {
  return (
    point.temperature_c !== null ||
    point.humidity_pct !== null ||
    point.precipitation_mm !== null ||
    point.wind_speed_kmh !== null ||
    point.wind_gust_kmh !== null
  );
}

function at(series: unknown, hour: number): number | null {
  return Array.isArray(series) ? finite(series[hour]) : null;
}

export function relativeHumidity(tempC: number, dewC: number): number {
  const magnus = (temp: number) => Math.exp((17.625 * temp) / (temp + 243.04));
  return Math.min(100, Math.max(0, (100 * magnus(dewC)) / magnus(tempC)));
}

export function parseOpenMeteo(body: unknown, places: Pick<PublicPlace, "id">[]): HourPoint[] {
  if (obj(body)?.error === true) throw new Error("Open-Meteo rechazó la consulta");
  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== places.length) throw new Error(`Open-Meteo devolvió ${locations.length} lugares`);
  const points: HourPoint[] = [];
  locations.forEach((location, index) => {
    const place = places[index];
    const hourly = obj(obj(location)?.hourly);
    const times = hourly?.time;
    if (!place || !hourly || !Array.isArray(times)) throw new Error("Open-Meteo sin datos horarios");
    for (const [model, source] of OPEN_METEO_MODELS) {
      times.forEach((time, hour) => {
        const validTime = hourIso(typeof time === "number" ? time : String(time));
        if (!validTime) return;
        const point = blank(place.id, source, validTime);
        point.temperature_c = at(hourly[`temperature_2m_${model}`], hour);
        point.humidity_pct = at(hourly[`relative_humidity_2m_${model}`], hour);
        point.precipitation_mm = at(hourly[`precipitation_${model}`], hour);
        point.wind_speed_kmh = at(hourly[`wind_speed_10m_${model}`], hour);
        point.wind_gust_kmh = at(hourly[`wind_gusts_10m_${model}`], hour);
        point.wind_direction_deg = at(hourly[`wind_direction_10m_${model}`], hour);
        point.pressure_hpa = at(hourly[`surface_pressure_${model}`], hour);
        if (hasValue(point)) points.push(point);
      });
    }
  });
  return points;
}

/** Locationforecast compact. El viento viene en m/s. La presión es a nivel del mar. */
export function parseMetNorway(body: unknown, placeId: string): HourPoint[] {
  const list = obj(obj(body)?.properties)?.timeseries;
  if (!Array.isArray(list)) throw new Error("MET Norway sin serie");
  const points: HourPoint[] = [];
  for (const entry of list) {
    const row = obj(entry);
    const validTime = hourIso(String(row?.time ?? ""));
    const details = obj(obj(obj(row?.data)?.instant)?.details);
    if (!validTime || !details) continue;
    const point = blank(placeId, "met-norway", validTime);
    const speed = finite(details.wind_speed);
    const gust = finite(details.wind_speed_of_gust);
    point.temperature_c = finite(details.air_temperature);
    point.humidity_pct = finite(details.relative_humidity);
    point.wind_speed_kmh = speed !== null ? speed * MS_TO_KMH : null;
    point.wind_gust_kmh = gust !== null ? gust * MS_TO_KMH : null;
    point.wind_direction_deg = finite(details.wind_from_direction);
    point.pressure_hpa = finite(details.air_pressure_at_sea_level);
    point.pressureIsMsl = point.pressure_hpa !== null;
    point.precipitation_mm = finite(obj(obj(obj(row?.data)?.next_1_hours)?.details)?.precipitation_amount);
    if (hasValue(point)) points.push(point);
  }
  return points;
}

/** Pronóstico cada 3 horas. Con `units=metric` el viento sigue en m/s. */
export function parseOpenWeather(body: unknown, placeId: string): HourPoint[] {
  const list = obj(body)?.list;
  if (!Array.isArray(list)) throw new Error("OpenWeather sin lista");
  const points: HourPoint[] = [];
  for (const entry of list) {
    const row = obj(entry);
    const validTime = hourIso(finite(row?.dt) ?? NaN);
    if (!row || !validTime) continue;
    const main = obj(row.main);
    const wind = obj(row.wind);
    const rain = obj(row.rain);
    const speed = finite(wind?.speed);
    const gust = finite(wind?.gust);
    const point = blank(placeId, "openweather", validTime);
    const rain3h = finite(rain?.["3h"]);
    point.temperature_c = finite(main?.temp);
    point.humidity_pct = finite(main?.humidity);
    point.pressure_hpa = finite(main?.pressure);
    point.pressureIsMsl = point.pressure_hpa !== null;
    point.wind_speed_kmh = speed !== null ? speed * MS_TO_KMH : null;
    point.wind_gust_kmh = gust !== null ? gust * MS_TO_KMH : null;
    point.wind_direction_deg = finite(wind?.deg);
    // `rain.3h` es el acumulado de tres horas. El consenso lo lee como una hora.
    point.precipitation_mm = finite(rain?.["1h"]) ?? (rain3h !== null ? rain3h / 3 : null);
    if (hasValue(point)) points.push(point);
  }
  return points;
}

export function parseWeatherApi(body: unknown, placeId: string): HourPoint[] {
  const days = obj(obj(body)?.forecast)?.forecastday;
  if (!Array.isArray(days)) throw new Error("WeatherAPI sin pronóstico");
  const points: HourPoint[] = [];
  for (const day of days) {
    const hours = obj(day)?.hour;
    if (!Array.isArray(hours)) continue;
    for (const entry of hours) {
      const row = obj(entry);
      const validTime = hourIso(finite(row?.time_epoch) ?? NaN);
      if (!row || !validTime) continue;
      const point = blank(placeId, "weatherapi", validTime);
      point.temperature_c = finite(row.temp_c);
      point.humidity_pct = finite(row.humidity);
      point.precipitation_mm = finite(row.precip_mm);
      point.wind_speed_kmh = finite(row.wind_kph);
      point.wind_gust_kmh = finite(row.gust_kph);
      point.wind_direction_deg = finite(row.wind_degree);
      point.pressure_hpa = finite(row.pressure_mb);
      point.pressureIsMsl = point.pressure_hpa !== null;
      if (hasValue(point)) points.push(point);
    }
  }
  return points;
}

/** `units=metric`: temperatura en °C, viento en m/s, lluvia en mm/h. */
export function parseTomorrow(body: unknown, placeId: string): HourPoint[] {
  const timelines = obj(obj(body)?.timelines) ?? obj(body);
  const hourly = timelines?.hourly;
  if (!Array.isArray(hourly)) throw new Error("Tomorrow.io sin horas");
  const points: HourPoint[] = [];
  for (const entry of hourly) {
    const row = obj(entry);
    const values = obj(row?.values);
    const validTime = hourIso(String(row?.time ?? ""));
    if (!values || !validTime) continue;
    const speed = finite(values.windSpeed);
    const gust = finite(values.windGust);
    const point = blank(placeId, "tomorrow", validTime);
    point.temperature_c = finite(values.temperature);
    point.humidity_pct = finite(values.humidity);
    point.precipitation_mm = finite(values.precipitationIntensity);
    point.wind_speed_kmh = speed !== null ? speed * MS_TO_KMH : null;
    point.wind_gust_kmh = gust !== null ? gust * MS_TO_KMH : null;
    point.wind_direction_deg = finite(values.windDirection);
    point.pressure_hpa = finite(values.pressureSurfaceLevel);
    if (hasValue(point)) points.push(point);
  }
  return points;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const WIND_DIRS: Record<string, number> = {
  norte: 0,
  n: 0,
  noreste: 45,
  ne: 45,
  este: 90,
  e: 90,
  sudeste: 135,
  sureste: 135,
  se: 135,
  sur: 180,
  s: 180,
  sudoeste: 225,
  suroeste: 225,
  so: 225,
  oeste: 270,
  o: 270,
  noroeste: 315,
  no: 315,
};

export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefiere el nombre exacto. Si el SMN solo publica «Córdoba Observatorio», igual lo toma. */
export function pickSmnStation(rows: SmnRow[], station: string): SmnRow | undefined {
  const wanted = foldName(station);
  const exact = rows.filter((row) => foldName(row.station) === wanted);
  const pool = exact.length > 0 ? exact : rows.filter((row) => foldName(row.station).startsWith(`${wanted} `));
  return [...pool].sort((a, b) => b.time.localeCompare(a.time))[0];
}

export type SmnRow = {
  station: string;
  time: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  pressure_hpa: number | null;
};

function parseSmnWind(field: string): { speed: number | null; direction: number | null } {
  const text = foldName(field);
  if (!text || text === "-" || text.startsWith("calma")) return { speed: 0, direction: null };
  const match = text.match(/^([a-z]+)\s+([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return { speed: null, direction: null };
  const speed = Number(match[2].replace(",", "."));
  return { speed: Number.isFinite(speed) ? speed : null, direction: WIND_DIRS[match[1]] ?? null };
}

/** Archivo `tiepre` del SMN. Una fila por estación, hora local de Argentina (UTC−3). */
export function parseSmnTiepre(text: string): SmnRow[] {
  const rows: SmnRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes(";") || line.includes("El archivo no existe")) continue;
    const parts = line.split(";");
    if (parts.length < 9) continue;
    const station = parts[0].trim();
    const dateMatch = foldName(parts[1]).match(/^(\d{1,2})-([a-z]+)-(\d{4})$/);
    const timeMatch = parts[2].trim().match(/^(\d{1,2}):(\d{2})$/);
    const month = dateMatch ? MONTHS[dateMatch[2]] : undefined;
    if (!station || !dateMatch || !month || !timeMatch) continue;
    const iso = `${dateMatch[3]}-${String(month).padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00-03:00`;
    const time = hourIso(iso);
    if (!time) continue;
    const wind = parseSmnWind(parts[8] ?? "");
    const pressure = Number(String(parts[9] ?? "").trim().split(/\s+/)[0]?.replace(",", "."));
    const humidity = Number(String(parts[7] ?? "").trim().replace(",", "."));
    const temperature = Number(String(parts[5] ?? "").trim().replace(",", "."));
    rows.push({
      station,
      time,
      temperature_c: Number.isFinite(temperature) ? temperature : null,
      humidity_pct: Number.isFinite(humidity) ? humidity : null,
      wind_speed_kmh: wind.speed,
      wind_direction_deg: wind.direction,
      pressure_hpa: Number.isFinite(pressure) ? pressure : null,
    });
  }
  return rows;
}

export type MetarObs = Omit<Observation, "placeId" | "label"> & { icao: string };

/** METAR horario. Viento en nudos; la ráfaga solo viene cuando el informe la trae. */
export function parseMetarObs(body: unknown): MetarObs[] {
  if (!Array.isArray(body)) throw new Error("METAR inválido");
  const rows: MetarObs[] = [];
  for (const entry of body) {
    const item = obj(entry);
    const icao = typeof item?.icaoId === "string" ? item.icaoId.toUpperCase() : "";
    const time = hourIso(finite(item?.obsTime) ?? NaN);
    if (!icao || !time) continue;
    const windKt = finite(item?.wspd);
    const gustKt = finite(item?.wgst);
    const temp = finite(item?.temp);
    const dew = finite(item?.dewp);
    const precipIn = finite(item?.precip);
    rows.push({
      icao,
      source: "metar",
      time,
      temperature_c: temp,
      humidity_pct: temp !== null && dew !== null ? Math.round(relativeHumidity(temp, dew) * 10) / 10 : null,
      precipitation_mm: precipIn !== null ? precipIn * 25.4 : null,
      wind_speed_kmh: windKt !== null ? Math.round(windKt * KT_TO_KMH * 10) / 10 : null,
      wind_gust_kmh: gustKt !== null ? Math.round(gustKt * KT_TO_KMH * 10) / 10 : null,
      wind_direction_deg: windKt !== null && windKt >= 1 ? finite(item?.wdir) : null,
      pressure_hpa: finite(item?.altim),
    });
  }
  return rows;
}
