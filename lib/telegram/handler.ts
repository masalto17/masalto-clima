import { timingSafeEqual } from "node:crypto";
import type { Overview } from "@/lib/forecast/queries";
import { parseIntent } from "./intents";
import { buildReply, helpText } from "./replies";

export type TelegramUpdate = {
  message?: {
    text?: string;
    chat: { id: number; type: string };
    from?: { first_name?: string };
  };
};

export type LinkedChat = { name: string; organizationId: string; profileId: string };

export type TelegramDeps = {
  /** Perfil vinculado al chat, o null si el chat no está vinculado. */
  findLinked: (chatId: string) => Promise<LinkedChat | null>;
  /** Pronóstico combinado de los lugares guardados de la organización. */
  loadOverview: (organizationId: string, now: Date) => Promise<Overview>;
  /** Crea un código de un solo uso para el chat y devuelve el código en claro. */
  createLinkCode: (chatId: string, displayName: string | null) => Promise<string>;
  /** Crea un token de ingreso a la web de un solo uso y devuelve el token en claro. */
  createWebLogin: (profileId: string) => Promise<string>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  appUrl: string;
};

export function isValidSecret(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleUpdate(update: TelegramUpdate, deps: TelegramDeps): Promise<void> {
  const message = update.message;
  // Solo chats privados: un grupo no se vincula a una persona.
  if (!message || message.chat.type !== "private") return;

  const chatId = String(message.chat.id);
  const linked = await deps.findLinked(chatId);

  if (linked) {
    const intent = parseIntent(message.text ?? "");
    if (intent.kind === "web") {
      const token = await deps.createWebLogin(linked.profileId);
      const link = `${deps.appUrl}/entrar?t=${encodeURIComponent(token)}`;
      await deps.sendMessage(
        chatId,
        `Abrí este link para entrar a la web sin poner el mail (vale 10 minutos, un solo uso):\n${link}`,
      );
      return;
    }
    if (intent.kind === "help") {
      await deps.sendMessage(chatId, helpText(linked.name));
      return;
    }
    const now = new Date();
    const overview = await deps.loadOverview(linked.organizationId, now);
    await deps.sendMessage(chatId, buildReply(intent, overview, linked.name, now));
    return;
  }

  // Chat no vinculado: lo único que se atiende es /start.
  const isStart = /^\/start(@\w+)?(\s|$)/.test(message.text ?? "");
  if (!isStart) return;

  const code = await deps.createLinkCode(chatId, message.from?.first_name ?? null);
  const link = `${deps.appUrl}/vincular?codigo=${encodeURIComponent(code)}`;
  await deps.sendMessage(
    chatId,
    `Para vincular este chat con MasAlto Clima abrí este link (vale 10 minutos, un solo uso):\n${link}`,
  );
}
