import { USER_AGENT } from "@/lib/clima/sources";

export const dynamic = "force-dynamic";

type Row = { year: number; rain: number | null; gust: number | null; wind: number | null; tmax: number | null };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const month = Number(url.searchParams.get("month"));
  const day = Number(url.searchParams.get("day"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || month < 1 || month > 12 || day < 1 || day > 31) {
    return Response.json({ rows: [] }, { status: 400 });
  }
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 5);
  const startYear = end.getUTCFullYear() - 12;
    const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const stamp = (year: number) => `${year}-${monthDay}`;
  try {
    const archive = new URL("https://archive-api.open-meteo.com/v1/archive");
    archive.searchParams.set("latitude", String(lat));
    archive.searchParams.set("longitude", String(lon));
    archive.searchParams.set("start_date", stamp(startYear));
    archive.searchParams.set("end_date", end.toISOString().slice(0, 10));
    archive.searchParams.set("daily", "precipitation_sum,temperature_2m_max,wind_speed_10m_max,wind_gusts_10m_max");
    archive.searchParams.set("wind_speed_unit", "kmh");
    archive.searchParams.set("timezone", "UTC");
    const response = await fetch(archive, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return Response.json({ rows: [] });
    const body = await response.json() as { daily?: Record<string, (number | null)[]> & { time?: string[] } };
    const daily = body.daily;
    const rows: Row[] = [];
    daily?.time?.forEach((time, index) => {
      if (time.slice(5) !== monthDay) return;
      rows.push({
        year: Number(time.slice(0, 4)),
        rain: daily.precipitation_sum?.[index] ?? null,
        gust: daily.wind_gusts_10m_max?.[index] ?? null,
        wind: daily.wind_speed_10m_max?.[index] ?? null,
        tmax: daily.temperature_2m_max?.[index] ?? null,
      });
    });
    return Response.json({ rows });
  } catch {
    return Response.json({ rows: [] });
  }
}
