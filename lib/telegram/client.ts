import "server-only";
import { requireEnv } from "@/lib/env";

const SEND_TIMEOUT_MS = 15_000;

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
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
  if (!response.ok) {
    // Sin el cuerpo de la URL: contiene el token.
    throw new Error(`Telegram sendMessage falló: HTTP ${response.status}`);
  }
}
