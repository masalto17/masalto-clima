import type { DaySummary } from "./combine";

/**
 * Vocabulario de viento según la escala de Beaufort (Organización Meteorológica
 * Mundial), sobre el viento medio en km/h. Es lenguaje, no umbral de estructura:
 * los umbrales de riesgo vienen de docs/refs/umbrales_estructuras.csv (Hito 3).
 */
const BEAUFORT = [
  { from: 62, word: "viento muy fuerte" }, // fuerza 8 o más (temporal)
  { from: 50, word: "viento fuerte" }, // fuerza 7
  { from: 39, word: "viento intenso" }, // fuerza 6
  { from: 20, word: "viento moderado" }, // fuerzas 4 y 5
  { from: 0, word: "poco viento" }, // fuerzas 0 a 3
];

/** Día con lluvia según la OMM: 1 mm o más. */
const RAIN_DAY_MM = 1;

const DIRECTIONS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];

export type Tone = "calm" | "info" | "warning";
export type DayStatus = { label: string; tone: Tone };

export function windWord(kmh: number): string {
  return BEAUFORT.find((level) => kmh >= level.from)!.word;
}

/** Nombre completo del punto desde el que sopla el viento. */
export function directionName(degrees: number): string {
  return DIRECTIONS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function millimeters(value: number): string {
  return value < 10 ? String(Math.round(value * 10) / 10).replace(".", ",") : String(Math.round(value));
}

/** Estado del día en una o dos palabras, del fenómeno más importante al menos. */
export function dayStatus(day: DaySummary): DayStatus {
  if (day.windMax === null && day.temperatureMax === null) return { label: "Sin datos", tone: "info" };

  const wind = day.windMax ?? 0;
  const gust = day.gustMax ?? 0;
  const rain = (day.precipitation ?? 0) >= RAIN_DAY_MM;
  const maybeRain = (day.precipitationHigh ?? 0) >= RAIN_DAY_MM;
  const andRain = rain ? " y lluvia" : "";

  if (wind >= 62) return { label: `Viento muy fuerte${andRain}`, tone: "warning" };
  if (wind >= 50) return { label: `Viento fuerte${andRain}`, tone: "warning" };
  // Ráfagas que llegan a fuerza 8 aunque el viento medio sea menor: no es un día tranquilo.
  if (wind >= 39 || gust >= 62) return { label: `Ventoso${andRain}`, tone: "info" };
  if (rain) return { label: "Lluvia", tone: "info" };
  if (maybeRain) return { label: "Puede llover", tone: "info" };
  return { label: "Tranquilo", tone: "calm" };
}

export function rainSentence(day: DaySummary): string {
  if (day.precipitation === null) return "Lluvia sin dato.";
  if (day.precipitation >= RAIN_DAY_MM) {
    const high = day.precipitationHigh ?? day.precipitation;
    const range =
      millimeters(high) === millimeters(day.precipitation)
        ? millimeters(day.precipitation)
        : `${millimeters(day.precipitation)} a ${millimeters(high)}`;
    return `Lluvia de ${range} mm.`;
  }
  if ((day.precipitationHigh ?? 0) >= RAIN_DAY_MM) {
    return `Puede llover hasta ${millimeters(day.precipitationHigh!)} mm.`;
  }
  return "Sin lluvia.";
}

export function temperatureSentence(day: DaySummary): string {
  if (day.temperatureMin === null || day.temperatureMax === null) return "Temperatura sin dato.";
  return `De ${Math.round(day.temperatureMin)} a ${Math.round(day.temperatureMax)} °C.`;
}

export function windSentence(day: DaySummary): string {
  if (day.windMax === null) return "Viento sin dato.";
  const direction = day.windDirection === null ? "" : ` del ${directionName(day.windDirection)}`;
  const base = `${capitalize(windWord(day.windMax))}${direction}`;
  if (day.gustMax === null) return `${base}.`;
  const hour =
    day.gustHour === null ? "" : day.gustHour === 0 ? " a la medianoche" : ` a las ${day.gustHour} h`;
  return `${base}, ráfagas de hasta ${Math.round(day.gustMax)} km/h${hour}.`;
}

/** El día en tres frases cortas: lluvia, temperatura y viento. */
export function dayPhrase(day: DaySummary): string {
  return [rainSentence(day), temperatureSentence(day), windSentence(day)].join(" ");
}
