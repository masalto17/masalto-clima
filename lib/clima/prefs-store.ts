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

export async function writePreferences(prefs: Preferences): Promise<boolean> {
  if (storageKind() === "none") return false;
  return writeStored("preferencias", JSON.stringify(parsePreferences(prefs)));
}
