import { timingSafeEqual } from "node:crypto";

export type TelegramUpdate = {
  message?: {
    text?: string;
    chat: { id: number; type: string };
    from?: { first_name?: string };
  };
};

export type TelegramDeps = {
  /** Nombre del perfil vinculado al chat, o null si el chat no está vinculado. */
  findLinkedName: (chatId: string) => Promise<string | null>;
  /** Crea un código de un solo uso para el chat y devuelve el código en claro. */
  createLinkCode: (chatId: string, displayName: string | null) => Promise<string>;
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
  const linkedName = await deps.findLinkedName(chatId);

  if (linkedName) {
    await deps.sendMessage(chatId, `hola, ${linkedName}`);
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
