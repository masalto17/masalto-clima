"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyPreferences, type Preferences } from "@/lib/clima/prefs";

type Status = { email: boolean; whatsapp: boolean; push: boolean; publicKey: string | null; storage: boolean };

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const value = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

export default function AvisosPage() {
  const [prefs, setPrefs] = useState<Preferences>(emptyPreferences);
  const [channels, setChannels] = useState<Status | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    void fetch("/api/avisos").then((response) => response.json()).then((body: { prefs: Preferences; channels: Status }) => {
      setPrefs(body.prefs);
      setChannels(body.channels);
    });
  }, []);

  async function save(next: Preferences, test = false) {
    setPrefs(next);
    const response = await fetch("/api/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs: next, test }),
    });
    const body = await response.json() as { sent?: number; storage?: string };
    setNote(test ? (body.sent ? "Se mandó una prueba." : "No se pudo mandar. Revisá el canal y las claves.") : "Guardado en este teléfono.");
  }

  async function enablePush(next: Preferences) {
    if (!channels?.publicKey) return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(channels.publicKey),
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
    await save({ ...next, pushOn: true, subscriptions: [...next.subscriptions, { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }] });
  }

  return (
    <main className="modo-obra mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-6">
      <Link className="toque w-fit" href="/">Volver</Link>
      <h1 className="text-3xl font-extrabold">Avisos</h1>
      <p className="text-base">Se mandan cuando el nivel sube. Si el envío no está configurado, el interruptor queda guardado pero no sale nada.</p>
      {!channels?.storage && <p className="rounded-xl border-2 px-3 py-3">Sin Blob ni KV los avisos quedan solo en este teléfono y el cron no los puede mandar.</p>}
      <label className="flex min-h-11 items-center gap-3 text-lg font-bold">
        <input type="checkbox" className="h-6 w-6" checked={prefs.emailOn} onChange={(event) => setPrefs({ ...prefs, emailOn: event.target.checked })} />
        Mail {channels && !channels.email && <span className="text-sm font-normal">· falta Resend</span>}
      </label>
      <input className="toque" type="email" placeholder="mail" value={prefs.email} onChange={(event) => setPrefs({ ...prefs, email: event.target.value })} />
      <label className="flex min-h-11 items-center gap-3 text-lg font-bold">
        <input type="checkbox" className="h-6 w-6" checked={prefs.whatsappOn} onChange={(event) => setPrefs({ ...prefs, whatsappOn: event.target.checked })} />
        WhatsApp {channels && !channels.whatsapp && <span className="text-sm font-normal">· falta la API</span>}
      </label>
      <input className="toque" inputMode="tel" placeholder="+549..." value={prefs.whatsapp} onChange={(event) => setPrefs({ ...prefs, whatsapp: event.target.value })} />
      <label className="flex min-h-11 items-center gap-3 text-lg font-bold">
        <input type="checkbox" className="h-6 w-6" checked={prefs.pushOn} onChange={(event) => { if (event.target.checked) void enablePush(prefs); else setPrefs({ ...prefs, pushOn: false }); }} />
        Aviso en el teléfono {channels && !channels.push && <span className="text-sm font-normal">· faltan las claves VAPID</span>}
      </label>
      <div className="flex gap-2">
        <button type="button" className="toque" onClick={() => void save(prefs)}>Guardar</button>
        <button type="button" className="toque" onClick={() => void save(prefs, true)}>Probar</button>
      </div>
      {note && <p>{note}</p>}
    </main>
  );
}
