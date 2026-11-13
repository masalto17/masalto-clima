import { loadClimateReport } from "@/lib/clima/load";

export const dynamic = "force-dynamic";

/** Estado corto para un widget futuro. No reemplaza a la app. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    const report = await loadClimateReport();
    const places = (id ? report.places.filter((place) => place.id === id) : report.places).map((place) => ({
      id: place.id,
      name: place.name,
      level: place.level,
      headline: place.headline,
      ahora: place.ahora,
      despues: place.despues,
      sugerencia: place.sugerencia,
      updatedAt: report.checkedAt,
    }));
    if (id && places.length === 0) return Response.json({ error: "Lugar no encontrado" }, { status: 404 });
    return Response.json({ updatedAt: report.checkedAt, places });
  } catch {
    return Response.json({ updatedAt: null, places: [], error: "Sin datos" }, { status: 200 });
  }
}
