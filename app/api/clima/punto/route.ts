import { unstable_cache } from "next/cache";
import { reportForPlace } from "@/lib/clima/load";
import type { PublicPlace } from "@/lib/clima/places";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function inArgentina(lat: number, lon: number): boolean {
  return lat <= -21 && lat >= -56 && lon <= -53 && lon >= -74;
}

const cachedPlace = unstable_cache(
  async (id: string, name: string, region: string, lat: number, lon: number, timezone: string, zonda: boolean) => {
    const place: PublicPlace = {
      id, name, region, lat, lon, timezone, zonda,
      smnStation: /mendoza/i.test(region) ? "Mendoza" : /c[oó]rdoba/i.test(region) ? "Córdoba" : "San Juan",
      metar: /mendoza/i.test(region) ? "SAME" : /san juan/i.test(`${region} ${name}`) ? "SANU" : "SACO",
    };
    const report = await reportForPlace(place);
    return { place: report.places[0] ?? null, officialNote: report.officialNote, checkedAt: report.checkedAt };
  },
  ["clima-punto-ar"],
  { revalidate: 600 },
);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "Origen no permitido" }, { status: 403 });
    } catch {
      return Response.json({ error: "Origen no permitido" }, { status: 403 });
    }
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Demasiadas consultas" }, { status: 429 });

  const body = await request.json().catch(() => null) as { id?: string; name?: string; region?: string; lat?: number; lon?: number; timezone?: string; zonda?: boolean } | null;
  if (!body || typeof body.lat !== "number" || typeof body.lon !== "number" || typeof body.name !== "string") {
    return Response.json({ error: "Falta el lugar" }, { status: 400 });
  }
  if (!inArgentina(body.lat, body.lon)) return Response.json({ error: "El lugar tiene que estar en Argentina" }, { status: 400 });

  const lat = Math.round(body.lat * 100) / 100;
  const lon = Math.round(body.lon * 100) / 100;
  try {
    const result = await cachedPlace(
      typeof body.id === "string" ? body.id.slice(0, 80) : `lugar-${lat}-${lon}`,
      body.name.slice(0, 80),
      typeof body.region === "string" ? body.region.slice(0, 40) : "Argentina",
      lat,
      lon,
      typeof body.timezone === "string" ? body.timezone.slice(0, 60) : "America/Argentina/Buenos_Aires",
      Boolean(body.zonda),
    );
    return Response.json(result);
  } catch {
    return Response.json({ place: null }, { status: 200 });
  }
}
