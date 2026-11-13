import { USER_AGENT } from "@/lib/clima/sources";

export const dynamic = "force-dynamic";

type Hit = { name: string; region: string; lat: number; lon: number; timezone: string };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return Response.json({ results: [] });
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=es`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return Response.json({ results: [] });
    const body = await response.json() as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }[] };
    const results: Hit[] = (body.results ?? [])
      .filter((item) => !item.country || /argentina/i.test(item.country))
      .map((item) => ({
        name: item.name,
        region: item.admin1 || "Argentina",
        lat: item.latitude,
        lon: item.longitude,
        timezone: item.timezone || "America/Argentina/Buenos_Aires",
      }));
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
