import "server-only";
import { readPreferences, writePreferences } from "./prefs-store";
import type { ClimateReport } from "./types";
import type { Preferences } from "./prefs";

const LEVEL = { ok: 0, atencion: 1, alerta: 2 } as const;

export function channelStatus(env: NodeJS.ProcessEnv = process.env) {
  return {
    email: Boolean(env.RESEND_API_KEY && env.RESEND_FROM),
    whatsapp: Boolean(
      (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID) ||
      (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM),
    ),
    push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
    storage: Boolean(env.BLOB_READ_WRITE_TOKEN || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)),
  };
}

function messageFor(report: ClimateReport, placeId: string): { title: string; body: string } | null {
  const place = report.places.find((item) => item.id === placeId);
  if (!place || place.level === "ok") return null;
  const despues = place.despues ? `Después, ${place.despues.cuando}: ${place.despues.texto}` : "";
  return {
    title: `${place.headline} · ${place.name}`,
    body: [place.ahora.texto, despues, place.sugerencia].filter(Boolean).join("\n"),
  };
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  return response.ok;
}

async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (token && phoneId) {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: text },
      }),
    });
    return response.ok;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !auth || !from) return false;
  const body = new URLSearchParams({ From: from, To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`, Body: text });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}` },
    body,
  });
  return response.ok;
}

async function sendPush(prefs: Preferences, title: string, body: string): Promise<number> {
  if (!channelStatus().push || prefs.subscriptions.length === 0) return 0;
  const webpush = await import("web-push");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  let sent = 0;
  for (const subscription of prefs.subscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      sent += 1;
    } catch {
      // Una suscripción vencida no frena al resto.
    }
  }
  return sent;
}

export async function dispatchAlerts(report: ClimateReport, options?: { test?: boolean }): Promise<{ sent: number; skipped?: string }> {
  const { prefs, storage } = await readPreferences();
  if (storage === "none") return { sent: 0, skipped: "sin almacenamiento" };
  const channels = channelStatus();
  let sent = 0;
  const sentKeys = [...prefs.sent];
  const today = report.checkedAt.slice(0, 10);
  for (const place of report.places) {
    if (prefs.disabledIds.includes(place.id) || place.level === "ok") continue;
    const note = messageFor(report, place.id);
    if (!note) continue;
    const key = `${place.id}|${place.level}|${today}`;
    const covered = sentKeys.some((item) => {
      const [id, level, day] = item.key.split("|");
      return id === place.id && day === today && (LEVEL[level as keyof typeof LEVEL] ?? 0) >= LEVEL[place.level];
    });
    if (covered && !options?.test) continue;
    const text = `${note.title}\n${note.body}`;
    if (prefs.emailOn && channels.email && prefs.email) sent += (await sendEmail(prefs.email, note.title, text)) ? 1 : 0;
    if (prefs.whatsappOn && channels.whatsapp && prefs.whatsapp) sent += (await sendWhatsApp(prefs.whatsapp, text)) ? 1 : 0;
    if (prefs.pushOn && channels.push) sent += await sendPush(prefs, note.title, note.body);
    if (!options?.test) sentKeys.push({ key, at: new Date().toISOString() });
  }
  if (!options?.test && sent > 0) await writePreferences({ ...prefs, sent: sentKeys.slice(-200) });
  return { sent };
}
