import { XMLParser, XMLValidator } from "fast-xml-parser";

export type PlacePoint = { id: string; lat: number; lon: number };
export type OfficialAlert = {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: string;
  sentAt: string;
  startsAt: string;
  expiresAt: string;
  sourceUrl: string;
  demo?: true;
};

type Point = { lat: number; lon: number };
type Area = { polygons: Point[][]; circles: { center: Point; radiusKm: number }[] };
export type CapMessage = {
  id: string;
  sentAt: string;
  status: string;
  msgType: string;
  scope: string;
  references: string[];
  info: null | {
    event: string;
    headline: string;
    description: string;
    severity: string;
    startsAt: string;
    expiresAt: string;
    areas: Area[];
  };
};

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function array(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown): string {
  const raw = string(value);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : "";
}

function safeXml(xml: string): Record<string, unknown> {
  // CAP/RSS no necesita DTD. Rechazarlo evita entidades personalizadas y
  // cualquier resolución externa si el proveedor cambia el documento.
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error("XML con DTD o entidades");
  if (XMLValidator.validate(xml) !== true) throw new Error("XML inválido");
  const parsed = object(parser.parse(xml));
  if (!parsed) throw new Error("XML vacío");
  return parsed;
}

export function parseIndex(xml: string): { publishedAt: string; urls: string[] } {
  const channel = object(object(safeXml(xml).rss)?.channel);
  if (!channel) throw new Error("RSS sin canal");
  const publishedAt = date(channel.lastBuildDate) || date(channel.pubDate);
  if (!publishedAt) throw new Error("RSS sin fecha válida");
  const urls = array(channel.item).map((item) => object(item)).filter((item): item is Record<string, unknown> => item !== null)
    .filter((item) => !/temperatura|calor|fr[ií]o/i.test(string(item.title)))
    .map((item) => string(item.link)).filter(Boolean);
  return { publishedAt, urls: [...new Set(urls)] };
}

function point(raw: string): Point | null {
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat, lon } : null;
}

function polygon(raw: string): Point[] | null {
  const vertices = raw.trim().split(/\s+/).map(point);
  return vertices.length >= 3 && vertices.length <= 10000 && vertices.every((vertex) => vertex !== null)
    ? vertices as Point[] : null;
}

function circle(raw: string): { center: Point; radiusKm: number } | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const center = point(parts[0]);
  const radiusKm = Number(parts[1]);
  return center && Number.isFinite(radiusKm) && radiusKm > 0 && radiusKm <= 2000
    ? { center, radiusKm } : null;
}

function parseAreas(info: Record<string, unknown>): Area[] {
  return array(info.area).map((item) => {
    const area = object(item);
    return {
      polygons: array(area?.polygon).map((value) => polygon(string(value))).filter((value): value is Point[] => value !== null),
      circles: array(area?.circle).map((value) => circle(string(value))).filter((value): value is { center: Point; radiusKm: number } => value !== null),
    };
  });
}

export function parseCap(xml: string): CapMessage {
  const alert = object(safeXml(xml).alert);
  if (!alert) throw new Error("CAP sin alerta");
  const id = string(alert.identifier);
  const sentAt = date(alert.sent);
  if (!id || !sentAt) throw new Error("CAP sin identificador o emisión");
  const infoCandidates = array(alert.info).map(object).filter((value): value is Record<string, unknown> => value !== null);
  const info = infoCandidates.find((candidate) => /^es(?:-|$)/i.test(string(candidate.language))) ?? infoCandidates[0];
  const refs = string(alert.references).split(",");
  const references: string[] = [];
  for (let i = 1; i < refs.length; i += 3) if (refs[i]?.trim()) references.push(refs[i].trim());
  return {
    id,
    sentAt,
    status: string(alert.status),
    msgType: string(alert.msgType),
    scope: string(alert.scope),
    references,
    info: info ? {
      event: string(info.event),
      headline: string(info.headline),
      description: string(info.description).slice(0, 800),
      severity: string(info.severity),
      startsAt: date(info.onset) || date(info.effective) || sentAt,
      expiresAt: date(info.expires),
      areas: parseAreas(info),
    } : null,
  };
}

export function relevantEvent(event: string): boolean {
  return /zonda|viento|tormenta|lluvia|precipitaci[oó]n/i.test(event);
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (p.lon - a.lon) * (b.lat - a.lat) - (p.lat - a.lat) * (b.lon - a.lon);
  return Math.abs(cross) < 1e-9 && p.lon >= Math.min(a.lon, b.lon) - 1e-9
    && p.lon <= Math.max(a.lon, b.lon) + 1e-9
    && p.lat >= Math.min(a.lat, b.lat) - 1e-9 && p.lat <= Math.max(a.lat, b.lat) + 1e-9;
}

function insidePolygon(p: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j];
    const b = vertices[i];
    if (onSegment(p, a, b)) return true;
    if ((a.lat > p.lat) !== (b.lat > p.lat)
      && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function coversPlace(info: NonNullable<CapMessage["info"]>, place: PlacePoint): boolean {
  const p = { lat: place.lat, lon: place.lon };
  return info.areas.some((area) => area.polygons.some((shape) => insidePolygon(p, shape))
    || area.circles.some((shape) => distanceKm(p, shape.center) <= shape.radiusKm));
}

export function hasGeometry(info: NonNullable<CapMessage["info"]>): boolean {
  return info.areas.some((area) => area.polygons.length > 0 || area.circles.length > 0);
}
