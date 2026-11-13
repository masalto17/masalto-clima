import type { PublicPlace } from "./places";
import {
  parseMetNorway,
  parseMetarObs,
  parseOpenMeteo,
  parseOpenWeather,
  parseSmnTiepre,
  parseTomorrow,
  parseWeatherApi,
} from "./parse";
import { OPEN_METEO_MODELS, SOURCE_LABELS, USER_AGENT, sourceLabel } from "./sources";
import { hourIso } from "./time";
import type { HourPoint, Observation, SourceStatus } from "./types";

const OPEN_METEO_HOURLY = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "surface_pressure",
].join(",");

export type LiveForecast = { points: HourPoint[]; sources: SourceStatus[] };

async function getJson(url: string, timeoutMs: number, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function openMeteoUrl(places: PublicPlace[], days: number, apiKey?: string): string {
  const host = apiKey ? "customer-api.open-meteo.com" : "api.open-meteo.com";
  const params = new URLSearchParams({
    latitude: places.map((place) => place.lat).join(","),
    longitude: places.map((place) => place.lon).join(","),
    hourly: OPEN_METEO_HOURLY,
    models: OPEN_METEO_MODELS.map(([model]) => model).join(","),
    forecast_days: String(days),
    timezone: "UTC",
    timeformat: "unixtime",
    wind_speed_unit: "kmh",
  });
  if (apiKey) params.set("apikey", apiKey);
  return `https://${host}/v1/forecast?${params}`;
}

function failed(ids: string[]): SourceStatus[] {
  return ids.map((id) => ({ id, label: sourceLabel(id), ok: false }));
}

export async function fetchForecasts(
  places: PublicPlace[],
  options: { days: number; apiKey?: string; openWeatherKey?: string; weatherApiKey?: string; tomorrowKey?: string },
): Promise<LiveForecast> {
  const points: HourPoint[] = [];
  const sources: SourceStatus[] = [];
  const modelIds = OPEN_METEO_MODELS.map(([, source]) => source);

  const tasks: Promise<void>[] = [
    (async () => {
      try {
        const body = await getJson(openMeteoUrl(places, options.days, options.apiKey), 12_000);
        const parsed = parseOpenMeteo(body, places);
        points.push(...parsed);
        for (const id of modelIds) sources.push({ id, label: sourceLabel(id), ok: parsed.some((point) => point.source === id) });
      } catch {
        sources.push(...failed(modelIds));
      }
    })(),
    (async () => {
      const results = await Promise.all(
        places.map(async (place) => {
          try {
            const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.lat}&lon=${place.lon}`;
            return parseMetNorway(await getJson(url, 8_000), place.id);
          } catch {
            return null;
          }
        }),
      );
      const ok = results.some((result) => result && result.length > 0);
      for (const result of results) if (result) points.push(...result);
      sources.push({ id: "met-norway", label: SOURCE_LABELS["met-norway"], ok });
    })(),
  ];

  if (options.openWeatherKey) {
    tasks.push(
      (async () => {
        const results = await Promise.all(
          places.map(async (place) => {
            try {
              const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${place.lat}&lon=${place.lon}&units=metric&lang=es&appid=${encodeURIComponent(options.openWeatherKey!)}`;
              return parseOpenWeather(await getJson(url, 8_000), place.id);
            } catch {
              return null;
            }
          }),
        );
        const ok = results.some((result) => result && result.length > 0);
        for (const result of results) if (result) points.push(...result);
        sources.push({ id: "openweather", label: SOURCE_LABELS.openweather, ok });
      })(),
    );
  }

  if (options.weatherApiKey) {
    tasks.push(
      (async () => {
        const results = await Promise.all(
          places.map(async (place) => {
            try {
              const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(options.weatherApiKey!)}&q=${place.lat},${place.lon}&days=3&aqi=no&alerts=no`;
              return parseWeatherApi(await getJson(url, 8_000), place.id);
            } catch {
              return null;
            }
          }),
        );
        const ok = results.some((result) => result && result.length > 0);
        for (const result of results) if (result) points.push(...result);
        sources.push({ id: "weatherapi", label: SOURCE_LABELS.weatherapi, ok });
      })(),
    );
  }

  if (options.tomorrowKey) {
    tasks.push(
      (async () => {
        const results = await Promise.all(
          places.map(async (place) => {
            try {
              const url = `https://api.tomorrow.io/v4/weather/forecast?location=${place.lat},${place.lon}&timesteps=1h&units=metric&apikey=${encodeURIComponent(options.tomorrowKey!)}`;
              return parseTomorrow(await getJson(url, 8_000), place.id);
            } catch {
              return null;
            }
          }),
        );
        const ok = results.some((result) => result && result.length > 0);
        for (const result of results) if (result) points.push(...result);
        sources.push({ id: "tomorrow", label: SOURCE_LABELS.tomorrow, ok });
      })(),
    );
  }

  await Promise.all(tasks);
  return { points, sources };
}

function tiepreDates(now: Date): string[] {
  const dates = [0, 1, -1].map((offset) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + offset);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  });
  return dates;
}

export async function fetchObservations(places: PublicPlace[], options: { metarHours: number; now: Date }): Promise<Observation[]> {
  const observations: Observation[] = [];
  const icaos = [...new Set(places.map((place) => place.metar))].join(",");

  const metarTask = (async () => {
    try {
      const body = await getJson(
        `https://aviationweather.gov/api/data/metar?ids=${icaos}&format=json&hours=${options.metarHours}`,
        8_000,
      );
      const rows = parseMetarObs(body);
      for (const place of places) {
        for (const row of rows) {
          if (row.icao !== place.metar) continue;
          observations.push({
            placeId: place.id,
            label: `Aeropuerto ${place.metar}`,
            source: "metar",
            time: row.time,
            temperature_c: row.temperature_c,
            humidity_pct: row.humidity_pct,
            precipitation_mm: row.precipitation_mm,
            wind_speed_kmh: row.wind_speed_kmh,
            wind_gust_kmh: row.wind_gust_kmh,
            wind_direction_deg: row.wind_direction_deg,
            pressure_hpa: row.pressure_hpa,
          });
        }
      }
    } catch {
      // El METAR es la observación de referencia, pero la página sigue sin él.
    }
  })();

  const smnTask = (async () => {
    const files = await Promise.all(
      tiepreDates(options.now).map(async (stamp) => {
        try {
          const response = await fetch(
            `https://ssl.smn.gob.ar/dpd/descarga_opendata.php?file=observaciones/tiepre${stamp}.txt`,
            { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8_000), cache: "no-store" },
          );
          if (!response.ok) return "";
          return new TextDecoder("iso-8859-1").decode(await response.arrayBuffer());
        } catch {
          return "";
        }
      }),
    );
    const rows = files.flatMap((file) => (file.includes(";") ? parseSmnTiepre(file) : []));
    for (const place of places) {
      const station = rows
        .filter((row) => row.station.localeCompare(place.smnStation, "es", { sensitivity: "base" }) === 0)
        .sort((a, b) => b.time.localeCompare(a.time))[0];
      if (!station) continue;
      observations.push({
        placeId: place.id,
        label: `Estación SMN ${place.smnStation}`,
        source: "smn",
        time: station.time,
        temperature_c: station.temperature_c,
        humidity_pct: station.humidity_pct,
        precipitation_mm: null,
        wind_speed_kmh: station.wind_speed_kmh,
        wind_gust_kmh: null,
        wind_direction_deg: station.wind_direction_deg,
        pressure_hpa: station.pressure_hpa,
      });
    }
  })();

  await Promise.all([metarTask, smnTask]);
  return observations;
}

export function openMeteoKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.CLIMA_OPEN_METEO_API_KEY || env.OPEN_METEO_API_KEY || undefined;
}

export function truncateWrf(validTime: string): string | null {
  return hourIso(validTime);
}
