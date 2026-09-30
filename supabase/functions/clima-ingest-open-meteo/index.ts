// Baja el pronóstico multimodelo de Open-Meteo para todos los lugares y lo guarda
// en clima.forecasts. La dispara pg_cron cada hora.
import { fetchForecasts } from "../../../lib/open-meteo/client.ts";
import { createAdminClient, errorMessage, isCronRequest } from "../_shared/cron.ts";

const SOURCE = "open-meteo";
const CHUNK = 1000;

Deno.serve(async (request) => {
  if (!isCronRequest(request)) return new Response(null, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();

  try {
    const { data: places, error: placesError } = await supabase
      .from("places")
      .select("id, lat, lon");
    if (placesError) throw placesError;

    const rows = await fetchForecasts(places, {
      now,
      apiKey: Deno.env.get("CLIMA_OPEN_METEO_API_KEY") || undefined,
    });
    if (places.length > 0 && rows.length === 0) throw new Error("Open-Meteo no devolvió datos");

    for (let start = 0; start < rows.length; start += CHUNK) {
      const { error } = await supabase
        .from("forecasts")
        .upsert(rows.slice(start, start + CHUNK), {
          onConflict: "place_id,model,valid_time,run_time",
        });
      if (error) throw error;
    }

    const { error: healthError } = await supabase.from("system_health").upsert({
      source: SOURCE,
      last_ok_at: now.toISOString(),
      last_error: null,
      updated_at: now.toISOString(),
    });
    if (healthError) throw healthError;

    return Response.json({ ok: true, places: places.length, rows: rows.length });
  } catch (error) {
    const message = errorMessage(error);
    console.error("ingest-open-meteo:", message);
    // Sin last_ok_at: el latido sigue contando desde la última vez que anduvo.
    await supabase
      .from("system_health")
      .upsert({ source: SOURCE, last_error: message, updated_at: now.toISOString() });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
