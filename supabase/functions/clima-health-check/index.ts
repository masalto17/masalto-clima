// Latido: si una fuente no actualiza en 6 h, avisa por Telegram a los chats
// vinculados. Un aviso por caída y uno cuando vuelve. La dispara pg_cron cada 30 min.
import { evaluateHealth } from "../../../lib/health/check.ts";
import { createAdminClient, errorMessage, isCronRequest, requireEnv } from "../_shared/cron.ts";

const SEND_TIMEOUT_MS = 15_000;

async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = requireEnv("CLIMA_TELEGRAM_BOT_TOKEN");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Telegram sendMessage falló: tiempo de espera agotado");
    }
    throw error;
  }
  // Sin la URL en el error: contiene el token.
  if (!response.ok) throw new Error(`Telegram sendMessage falló: HTTP ${response.status}`);
}

Deno.serve(async (request) => {
  if (!isCronRequest(request)) return new Response(null, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();

  try {
    const { data: sourcesData, error: sourcesError } = await supabase
      .from("system_health")
      .select("source, last_ok_at, alerted_at");
    if (sourcesError) throw sourcesError;
    const sources = sourcesData ?? [];

    const actions = evaluateHealth(sources, now);
    if (actions.length === 0) return Response.json({ ok: true, actions: [] });

    const { data: channelsData, error: channelsError } = await supabase
      .from("channels")
      .select("external_id")
      .eq("kind", "telegram")
      .eq("active", true);
    if (channelsError) throw channelsError;
    const channels = channelsData ?? [];

    const done: string[] = [];
    for (const action of actions) {
      const results = await Promise.allSettled(
        channels.map((channel) => sendMessage(channel.external_id, action.message)),
      );
      // Si no le llegó a nadie, no se marca: el próximo latido reintenta.
      if (channels.length > 0 && results.every((result) => result.status === "rejected")) {
        console.error("health-check: no se pudo avisar", action.source);
        continue;
      }
      const { error } = await supabase
        .from("system_health")
        .update({ alerted_at: action.kind === "down" ? now.toISOString() : null })
        .eq("source", action.source);
      if (error) throw error;
      done.push(`${action.source}:${action.kind}`);
    }

    return Response.json({ ok: true, actions: done });
  } catch (error) {
    const message = errorMessage(error);
    console.error("health-check:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
