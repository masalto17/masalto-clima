import {
  coversPlace,
  hasGeometry,
  parseCap,
  parseIndex,
  relevantEvent,
  type CapMessage,
  type OfficialAlert,
  type PlacePoint,
} from "./cap";

const INDEX_URL = "https://ssl.smn.gob.ar/CAP/AR.php";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_XML_LENGTH = 1_500_000;
// El RSS puede traer decenas de polígonos. Acotar la lectura por visita evita
// ráfagas de solicitudes al SMN; el estado parcial prohíbe inferir ausencia.
const MAX_DOCUMENTS = 16;
const CONCURRENT = 2;

export type OfficialAlertsResult = {
  state: "ok" | "partial" | "unavailable";
  checkedAt: string;
  indexPublishedAt: string | null;
  byPlace: Record<string, OfficialAlert[]>;
};

type CachedRequest = RequestInit & { next?: { revalidate: number } };

async function xmlFrom(url: string, fetchFn: typeof fetch): Promise<string> {
  const options: CachedRequest = {
    redirect: "error",
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 300 },
  };
  const response = await fetchFn(url, options);
  if (!response.ok) throw new Error(`SMN HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_XML_LENGTH) throw new Error("XML demasiado grande");
  const xml = await response.text();
  if (xml.length > MAX_XML_LENGTH) throw new Error("XML demasiado grande");
  return xml;
}

/** Los enlaces del RSS son datos externos: no seguir dominios ni rutas arbitrarias. */
function allowedDocumentUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!['ssl.smn.gob.ar', 'forms.smn.gob.ar'].includes(url.hostname)) return null;
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.port) return null;
    if (!url.pathname.startsWith('/feeds/CAP/') || !url.pathname.endsWith('.xml')) return null;
    url.protocol = 'https:';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function empty(places: PlacePoint[], now: Date, state: OfficialAlertsResult["state"]): OfficialAlertsResult {
  return {
    state,
    checkedAt: now.toISOString(),
    indexPublishedAt: null,
    byPlace: Object.fromEntries(places.map((place) => [place.id, []])),
  };
}

function prioritizedUrls(urls: string[], places: PlacePoint[]): string[] {
  const northern = places.length > 0 && places.every((place) => place.lat > -40);
  const southern = places.length > 0 && places.every((place) => place.lat <= -40);
  const score = (url: string) => {
    if (/_Patagonia_/i.test(url)) return southern ? 0 : northern ? 2 : 1;
    if (/_Llanura_/i.test(url)) return northern ? 0 : southern ? 2 : 1;
    return 1;
  };
  return urls.map((url, index) => ({ url, index })).sort((a, b) => score(a.url) - score(b.url) || a.index - b.index)
    .map(({ url }) => url);
}

/** Consulta sólo para la web; el bot no espera el feed CAP en cada respuesta. */
export async function loadOfficialAlerts(
  places: PlacePoint[],
  now: Date,
  fetchFn: typeof fetch = fetch,
): Promise<OfficialAlertsResult> {
  const result = empty(places, now, "unavailable");
  let index: ReturnType<typeof parseIndex>;
  try {
    index = parseIndex(await xmlFrom(INDEX_URL, fetchFn));
  } catch {
    return result;
  }
  result.indexPublishedAt = index.publishedAt;
  const age = now.getTime() - Date.parse(index.publishedAt);
  if (age > MAX_AGE_MS || age < -10 * 60 * 1000) return result;

  let partial = index.urls.length > MAX_DOCUMENTS;
  const urls = prioritizedUrls(index.urls, places).slice(0, MAX_DOCUMENTS);
  const parsed: { message: CapMessage; sourceUrl: string }[] = [];
  for (let start = 0; start < urls.length; start += CONCURRENT) {
    const batch = await Promise.all(urls.slice(start, start + CONCURRENT).map(async (raw) => {
      const sourceUrl = allowedDocumentUrl(raw);
      if (!sourceUrl) return null;
      try {
        return { message: parseCap(await xmlFrom(sourceUrl, fetchFn)), sourceUrl };
      } catch {
        return null;
      }
    }));
    for (const item of batch) {
      if (item) parsed.push(item);
      else partial = true;
    }
  }

  // Update y Cancel invalidan identificadores anteriores aunque su polígono
  // ya no cubra el lugar. El RSS puede incluir ambas versiones.
  const superseded = new Set<string>();
  for (const { message } of parsed) {
    if (message.status === "Actual" && message.scope === "Public"
      && (message.msgType === "Update" || message.msgType === "Cancel")
      && Date.parse(message.sentAt) <= now.getTime() + 10 * 60 * 1000) {
      message.references.forEach((id) => superseded.add(id));
    }
  }

  const seen = new Set<string>();
  for (const { message, sourceUrl } of parsed.sort((a, b) => b.message.sentAt.localeCompare(a.message.sentAt))) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    if (message.status !== "Actual" || message.scope !== "Public"
      || !["Alert", "Update"].includes(message.msgType) || superseded.has(message.id)) continue;
    if (Date.parse(message.sentAt) > now.getTime() + 10 * 60 * 1000) {
      partial = true;
      continue;
    }
    const info = message.info;
    if (!info || !relevantEvent(info.event)) continue;
    if (!info.expiresAt || !info.startsAt || Date.parse(info.expiresAt) <= now.getTime()
      || Date.parse(info.startsAt) > Date.parse(info.expiresAt)) continue;
    if (!hasGeometry(info)) {
      partial = true;
      continue;
    }
    for (const place of places) {
      if (!coversPlace(info, place)) continue;
      result.byPlace[place.id].push({
        id: message.id,
        event: info.event,
        headline: info.headline || info.event,
        description: info.description,
        severity: info.severity,
        sentAt: message.sentAt,
        startsAt: info.startsAt,
        expiresAt: info.expiresAt,
        sourceUrl,
      });
    }
  }
  result.state = partial ? "partial" : "ok";
  return result;
}
