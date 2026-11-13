import { readStored, storageKind, writeStored } from "./storage";
import { emptyPreferences, parsePreferences, type Preferences } from "./prefs";

export async function readPreferences(): Promise<{ prefs: Preferences; storage: ReturnType<typeof storageKind> }> {
  const storage = storageKind();
  if (storage === "none") return { prefs: emptyPreferences(), storage };
  try {
    const raw = await readStored("preferencias");
    return { prefs: parsePreferences(raw ? JSON.parse(raw) : null), storage };
  } catch {
    return { prefs: emptyPreferences(), storage };
  }
}

/** La lista de lugares no pisa mail, WhatsApp ni suscripciones. */
export function mergePlaceList(current: Preferences, incoming: Preferences): Preferences {
  return { ...current, disabledIds: incoming.disabledIds, dates: incoming.dates, custom: incoming.custom };
}

/** Los destinos no pisan la lista de lugares. */
export function mergeChannels(current: Preferences, incoming: Preferences): Preferences {
  return {
    ...current,
    emailOn: incoming.emailOn,
    email: incoming.email,
    whatsappOn: incoming.whatsappOn,
    whatsapp: incoming.whatsapp,
    pushOn: incoming.pushOn,
    subscriptions: incoming.subscriptions,
  };
}

export async function writePreferences(prefs: Preferences): Promise<boolean> {
  if (storageKind() === "none") return false;
  return writeStored("preferencias", JSON.stringify(parsePreferences(prefs)));
}
