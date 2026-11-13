export type SavedPlace = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  timezone: string;
  zonda: boolean;
  armadoOn: string | null;
  eventOn: string | null;
  custom: boolean;
};

export type PushKeys = { endpoint: string; keys: { p256dh: string; auth: string } };

export type DatePair = { armadoOn: string | null; eventOn: string | null };

export type Preferences = {
  version: 1;
  disabledIds: string[];
  dates: Record<string, DatePair>;
  custom: SavedPlace[];
  emailOn: boolean;
  email: string;
  whatsappOn: boolean;
  whatsapp: string;
  pushOn: boolean;
  subscriptions: PushKeys[];
  sent: { key: string; at: string }[];
};

export function emptyPreferences(): Preferences {
  return {
    version: 1,
    disabledIds: [],
    dates: {},
    custom: [],
    emailOn: false,
    email: "",
    whatsappOn: false,
    whatsapp: "",
    pushOn: false,
    subscriptions: [],
    sent: [],
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function parsePreferences(raw: unknown): Preferences {
  const base = emptyPreferences();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<Preferences>;
  const custom = Array.isArray(value.custom) ? value.custom.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const place = item as Partial<SavedPlace>;
    if (typeof place.id !== "string" || typeof place.name !== "string") return [];
    if (typeof place.lat !== "number" || typeof place.lon !== "number") return [];
    return [{
      id: place.id,
      name: place.name.slice(0, 80),
      region: text(place.region).slice(0, 40) || "Argentina",
      lat: place.lat,
      lon: place.lon,
      timezone: text(place.timezone) || "America/Argentina/Buenos_Aires",
      zonda: Boolean(place.zonda),
      armadoOn: dateOrNull(place.armadoOn),
      eventOn: dateOrNull(place.eventOn),
      custom: true,
    } satisfies SavedPlace];
  }).slice(0, 30) : [];
  const dates: Record<string, DatePair> = {};
  if (value.dates && typeof value.dates === "object") {
    for (const [id, pair] of Object.entries(value.dates)) {
      if (!pair || typeof pair !== "object") continue;
      dates[id] = { armadoOn: dateOrNull(pair.armadoOn), eventOn: dateOrNull(pair.eventOn) };
    }
  }
  return {
    ...base,
    disabledIds: Array.isArray(value.disabledIds) ? value.disabledIds.filter((id) => typeof id === "string").slice(0, 40) : [],
    dates,
    custom,
    emailOn: Boolean(value.emailOn),
    email: text(value.email).slice(0, 120),
    whatsappOn: Boolean(value.whatsappOn),
    whatsapp: text(value.whatsapp).replace(/[^\d+]/g, "").slice(0, 20),
    pushOn: Boolean(value.pushOn),
    subscriptions: Array.isArray(value.subscriptions) ? value.subscriptions.filter((item) => item?.endpoint && item.keys?.p256dh && item.keys?.auth).slice(0, 20) : [],
    sent: Array.isArray(value.sent) ? value.sent.filter((item) => item?.key && item.at).slice(-200) : [],
  };
}
