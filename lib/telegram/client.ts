import "server-only";
import { requireEnv } from "@/lib/env";

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) {
    // Sin el cuerpo de la URL: contiene el token.
    throw new Error(`Telegram sendMessage falló: HTTP ${response.status}`);
  }
}
