import { reportForPlace } from "@/lib/clima/load";
import type { PublicPlace } from "@/lib/clima/places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Partial<PublicPlace> | null;
  if (!body || typeof body.lat !== "number" || typeof body.lon !== "number" || typeof body.name !== "string") {
    return Response.json({ error: "Falta el lugar" }, { status: 400 });
  }
  const place: PublicPlace = {
    id: typeof body.id === "string" ? body.id : `lugar-${body.lat}-${body.lon}`,
    name: body.name.slice(0, 80),
    region: typeof body.region === "string" ? body.region : "Argentina",
    lat: body.lat,
    lon: body.lon,
    timezone: typeof body.timezone === "string" ? body.timezone : "America/Argentina/Buenos_Aires",
    zonda: Boolean(body.zonda),
    smnStation: "San Juan",
    metar: /san juan|mendoza/i.test(`${body.region} ${body.name}`) ? "SANU" : "SACO",
  };
  try {
    const report = await reportForPlace(place);
    return Response.json({ place: report.places[0] ?? null, officialNote: report.officialNote, checkedAt: report.checkedAt });
  } catch {
    return Response.json({ place: null }, { status: 200 });
  }
}
