import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Overview } from "@/lib/forecast/queries";
import { handleUpdate, isValidSecret, type TelegramDeps, type TelegramUpdate } from "./handler";
import { generateLinkCode, hashLinkCode } from "./link-codes";

const NOW = new Date("2026-09-30T15:00:00Z");

const overview: Overview = {
  places: [
    {
      place: { id: "sj", name: "San Juan Ciudad", timezone: "America/Argentina/San_Juan", lat: -31.5375, lon: -68.5364 },
      sources: ["open-meteo", "smn-wrf"],
      hourlyToday: [],
      hourlyTomorrow: [],
      days: [
        {
          date: "2026-09-30",
          temperatureMin: 9,
          temperatureMax: 24,
          precipitation: 0,
          precipitationHigh: 0,
          windMax: 28,
          windDirection: 270,
          gustMax: 62,
          gustLow: 40,
          gustHour: 16,
          models: 5,
        },
      ],
    },
  ],
  health: [{ source: "open-meteo", last_ok_at: "2026-09-30T14:48:00Z" }],
};

function deps(linkedName: string | null) {
  return {
    appUrl: "https://clima.test",
    findLinked: vi
      .fn()
      .mockResolvedValue(
        linkedName ? { name: linkedName, organizationId: "org-1" } : null,
      ),
    loadOverview: vi.fn().mockResolvedValue(overview),
    createLinkCode: vi.fn().mockResolvedValue("codigo-1"),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  } satisfies TelegramDeps;
}

function update(text: string, type = "private"): TelegramUpdate {
  return { message: { text, chat: { id: 42, type }, from: { first_name: "Hugo" } } };
}

describe("handleUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saluda por nombre a un chat vinculado", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("buenas"), d);
    expect(d.sendMessage).toHaveBeenCalledWith("42", expect.stringMatching(/^hola, Hugo\n/));
    expect(d.createLinkCode).not.toHaveBeenCalled();
    expect(d.loadOverview).not.toHaveBeenCalled();
  });

  it("con /semana manda la semana de los lugares de su organización", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("/semana"), d);
    expect(d.loadOverview).toHaveBeenCalledWith("org-1", NOW);
    const text = d.sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(
      "San Juan Ciudad\nmié 30 · Ventoso. Sin lluvia. De 9 a 24 °C. Viento moderado del oeste, ráfagas de hasta 62 km/h a las 16 h.",
    );
    expect(text).toContain("Actualizado: Open-Meteo hace 12 min.");
    expect(text).toContain("Fuente: Open-Meteo y SMN.");
  });

  it("un chat no vinculado no recibe pronóstico ni link a la web", async () => {
    const d = deps(null);
    await handleUpdate(update("/semana"), d);
    await handleUpdate(update("/web"), d);
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.loadOverview).not.toHaveBeenCalled();
  });

  it("con /web manda la página pública sin token", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("/web"), d);
    expect(d.sendMessage).toHaveBeenCalledWith(
      "42",
      expect.stringContaining("https://clima.test"),
    );
  });

  it("ignora a un chat no vinculado", async () => {
    const d = deps(null);
    await handleUpdate(update("buenas"), d);
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.createLinkCode).not.toHaveBeenCalled();
  });

  it("con /start manda el link de vinculación a un chat no vinculado", async () => {
    const d = deps(null);
    await handleUpdate(update("/start"), d);
    expect(d.createLinkCode).toHaveBeenCalledWith("42", "Hugo");
    expect(d.sendMessage).toHaveBeenCalledWith(
      "42",
      expect.stringContaining("https://clima.test/vincular?codigo=codigo-1"),
    );
  });

  it("ignora grupos y updates sin mensaje", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("/start", "group"), d);
    await handleUpdate({}, d);
    expect(d.findLinked).not.toHaveBeenCalled();
    expect(d.sendMessage).not.toHaveBeenCalled();
  });
});

describe("isValidSecret", () => {
  it("acepta solo el secreto exacto", () => {
    expect(isValidSecret("abc", "abc")).toBe(true);
    expect(isValidSecret("abd", "abc")).toBe(false);
    expect(isValidSecret("abcd", "abc")).toBe(false);
    expect(isValidSecret(null, "abc")).toBe(false);
    expect(isValidSecret("", "")).toBe(false);
  });
});

describe("link codes", () => {
  it("genera códigos distintos y hashea de forma estable", () => {
    const a = generateLinkCode();
    expect(a).not.toBe(generateLinkCode());
    expect(hashLinkCode(a)).toBe(hashLinkCode(a));
    expect(hashLinkCode(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
