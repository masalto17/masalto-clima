export type Topic = "general" | "viento" | "lluvia" | "temperatura";

export type Intent =
  /** `explicitPlace`: vino como `/semana <lugar>`, así que el texto es solo el lugar. */
  | { kind: "week"; placeQuery: string; explicitPlace: boolean }
  | { kind: "day"; offset: number; topic: Topic; placeQuery: string }
  | { kind: "web" }
  | { kind: "help" };

const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "en", "y"]);

/** Minúsculas, sin acentos ni signos. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

const TOPICS: [Topic, RegExp][] = [
  ["viento", /\b(viento|vientos|rafaga|rafagas|zonda|sopla)\b/],
  ["lluvia", /\b(lluvia|lluvias|llueve|llover|llovera|llovizna|tormenta|tormentas|agua)\b/],
  ["temperatura", /\b(temperatura|calor|frio|grados|maxima|minima)\b/],
];
const GENERAL = /\b(clima|tiempo|pronostico|como esta|como viene)\b/;

/** Interpreta un mensaje con reglas simples. Lo que no reconoce cae en la ayuda. */
export function parseIntent(text: string): Intent {
  const command = /^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (command) {
    const name = command[1].toLowerCase();
    if (name === "web") return { kind: "web" };
    if (name !== "semana") return { kind: "help" };
    const placeQuery = normalize(command[2] ?? "");
    return { kind: "week", placeQuery, explicitPlace: placeQuery !== "" };
  }

  const normalized = normalize(text);
  if (/\bsemana\b/.test(normalized)) return { kind: "week", placeQuery: normalized, explicitPlace: false };

  const topic = TOPICS.find(([, pattern]) => pattern.test(normalized))?.[0];
  const offset = /\bpasado manana\b/.test(normalized)
    ? 2
    : /\bmanana\b/.test(normalized)
      ? 1
      : /\b(hoy|ahora)\b/.test(normalized)
        ? 0
        : null;
  if (!topic && offset === null && !GENERAL.test(normalized)) return { kind: "help" };

  return { kind: "day", offset: offset ?? 0, topic: topic ?? "general", placeQuery: normalized };
}

/**
 * Busca en el texto el lugar guardado que mejor coincide por palabras del nombre.
 * Si empatan, gana el que tiene más parte de su nombre en el texto
 * ("san juan" → "San Juan Ciudad" antes que "Estadio San Juan del Bicentenario").
 */
export function matchPlace<T extends { name: string }>(places: T[], text: string): T | null {
  const words = new Set(normalize(text).split(" "));
  let best: { place: T; hits: number; ratio: number } | null = null;
  for (const place of places) {
    const tokens = normalize(place.name)
      .split(" ")
      .filter((token) => !STOPWORDS.has(token));
    const hits = tokens.filter((token) => words.has(token)).length;
    if (hits === 0) continue;
    const ratio = hits / tokens.length;
    if (!best || hits > best.hits || (hits === best.hits && ratio > best.ratio)) {
      best = { place, hits, ratio };
    }
  }
  return best?.place ?? null;
}
