import type { DaySummary } from "@/lib/forecast/combine";
import { localDateParts } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import {
  dayPhrase,
  dayStatus,
  rainSentence,
  temperatureSentence,
  windSentence,
} from "@/lib/forecast/phrases";
import { isStale, sourceLabel } from "@/lib/health/check";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { matchPlace, type Intent, type Topic } from "./intents";

/** Con más lugares que esto, la semana de todos no entra cómoda en un mensaje. */
const MAX_PLACES_PER_MESSAGE = 4;

const DAY_NAMES = ["hoy", "mañana", "pasado mañana"];

export function helpText(name: string): string {
  return [
    `hola, ${name}`,
    "",
    "Probá:",
    "/semana — la semana de tus lugares guardados",
    "/semana San Juan — la semana de un lugar",
    "/web — abrir la web sin poner el mail",
    "O preguntame: ¿viento mañana en el estadio? ¿llueve hoy en Córdoba?",
  ].join("\n");
}

/** Pie de todas las respuestas: qué tan fresco es el dato y de dónde sale. */
export function footer(overview: Overview, now: Date): string {
  const lines: string[] = [];
  const updated = overview.health
    .filter((status) => status.last_ok_at)
    .map((status) => `${sourceLabel(status.source)} ${formatAgo(new Date(status.last_ok_at!), now)}`);
  if (updated.length) lines.push(`Actualizado: ${updated.join(", ")}.`);

  const stale = overview.health.filter((status) => isStale(status.last_ok_at, now));
  if (stale.length) {
    lines.push(
      `Atención: ${stale.map((status) => sourceLabel(status.source)).join(" y ")} sin actualizar hace más de 6 h.`,
    );
  }

  const sources = new Set(overview.places.flatMap((place) => place.sources));
  const labels = [sources.has("open-meteo") && "Open-Meteo", sources.has("smn-wrf") && "SMN"].filter(Boolean);
  lines.push(`Fuente: ${labels.join(" y ") || "sin datos recientes"}.`);
  return lines.join("\n");
}

/** El estado y las frases del día; para un tema, solo esa frase. */
export function dayText(day: DaySummary, topic: Topic = "general"): string {
  switch (topic) {
    case "viento":
      return windSentence(day);
    case "lluvia":
      return rainSentence(day);
    case "temperatura":
      return temperatureSentence(day);
    default:
      return `${dayStatus(day).label}. ${dayPhrase(day)}`;
  }
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekBlock({ place, days }: PlaceForecast): string {
  return [
    place.name,
    ...days.map((day) => `${formatDayLabel(day.date)} · ${dayText(day)}`),
  ].join("\n");
}

function dayBlock({ place, days }: PlaceForecast, offset: number, topic: Topic, now: Date): string {
  const date = addDays(localDateParts(now, place.timezone).date, offset);
  const day = days.find((candidate) => candidate.date === date);
  const label = `${place.name}, ${DAY_NAMES[offset]} (${formatDayLabel(date)})`;
  return day ? `${label}: ${dayText(day, topic)}` : `${label}: sin dato.`;
}

/** Texto de respuesta para un chat vinculado. */
export function buildReply(intent: Intent, overview: Overview, name: string, now: Date): string {
  if (intent.kind === "help" || intent.kind === "web") return helpText(name);

  if (overview.places.length === 0) return "Todavía no hay lugares guardados.";
  const withData = overview.places.filter((place) => place.days.length > 0);
  if (withData.length === 0) return "Sistema sin datos, usar SMN.";

  const names = overview.places.map((place) => place.place.name).join(", ");
  const matched = matchPlace(
    withData.map((place) => ({ ...place, name: place.place.name })),
    intent.placeQuery,
  );

  if (intent.kind === "week") {
    // `/semana algo` con un lugar que no existe: no adivinar.
    if (!matched && intent.explicitPlace) {
      return `No encontré ese lugar. Lugares guardados: ${names}.`;
    }
    if (!matched && withData.length > MAX_PLACES_PER_MESSAGE) {
      return `¿De qué lugar? Mandame /semana y el nombre. Lugares guardados: ${names}.`;
    }
    const blocks = (matched ? [matched] : withData).map(weekBlock);
    return [...blocks, footer(overview, now)].join("\n\n");
  }

  const lines = (matched ? [matched] : withData).map((place) =>
    dayBlock(place, intent.offset, intent.topic, now),
  );
  return [lines.join("\n"), footer(overview, now)].join("\n\n");
}
