import { describe, expect, it } from "vitest";
import { loadOfficialAlerts } from "./load";
import { cap, inside, outside } from "./cap.test";

const now = new Date("2026-11-12T00:00:00Z");
const base = "https://ssl.smn.gob.ar/feeds/CAP/";

function rss(names: string[], published = "Wed, 11 Nov 2026 21:52:11 GMT") {
  return `<rss><channel><lastBuildDate>${published}</lastBuildDate>${names.map((name) =>
    `<item><title>Viento</title><link>${base}${name}.xml</link></item>`).join("")}</channel></rss>`;
}

function fetcher(files: Record<string, string | number>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const value = files[String(input)];
    return typeof value === "string" ? new Response(value, { status: 200 })
      : new Response("error", { status: value ?? 404 });
  }) as typeof fetch;
}

describe("consulta de alertas SMN", () => {
  it("muestra una alerta futura sólo en el punto cubierto; descarta fuera de zona y expirada", async () => {
    const result = await loadOfficialAlerts([inside, outside], now, fetcher({
      "https://ssl.smn.gob.ar/CAP/AR.php": rss(["applicable", "outside", "expired"]),
      [`${base}applicable.xml`]: cap({ id: "a" }),
      [`${base}outside.xml`]: cap({ id: "b", polygon: "-32,-65 -32,-64 -31,-64 -31,-65 -32,-65" }),
      [`${base}expired.xml`]: cap({ id: "c", expires: "2026-11-11T17:00:00-03:00" }),
    }));
    expect(result.state).toBe("ok");
    expect(result.byPlace.estadio.map((alert) => alert.id)).toEqual(["a"]);
    expect(result.byPlace.cordoba.map((alert) => alert.id)).toEqual(["b"]);
    expect(result.byPlace.estadio[0].startsAt).toBe("2026-11-12T18:00:00.000Z");
  });

  it("una cancelación o actualización suprime la versión anterior", async () => {
    const result = await loadOfficialAlerts([inside], now, fetcher({
      "https://ssl.smn.gob.ar/CAP/AR.php": rss(["old", "update", "cancelled", "cancel"]),
      [`${base}old.xml`]: cap({ id: "old", type: "Alert" }),
      [`${base}update.xml`]: cap({ id: "new", type: "Update", references: "smn@smn.gob.ar,old,2026-11-11T12:00:00-03:00" }),
      [`${base}cancelled.xml`]: cap({ id: "cancelled", type: "Alert" }),
      [`${base}cancel.xml`]: cap({ id: "cancel", type: "Cancel", references: "smn@smn.gob.ar,cancelled,2026-11-11T12:00:00-03:00" }),
    }));
    expect(result.byPlace.estadio.map((alert) => alert.id)).toEqual(["new"]);
  });

  it("fallo o índice viejo nunca se presenta como ausencia de alertas", async () => {
    const unavailable = await loadOfficialAlerts([inside], now, fetcher({ "https://ssl.smn.gob.ar/CAP/AR.php": 503 }));
    expect(unavailable.state).toBe("unavailable");
    const old = await loadOfficialAlerts([inside], now, fetcher({
      "https://ssl.smn.gob.ar/CAP/AR.php": rss([], "Wed, 11 Nov 2026 12:00:00 GMT"),
    }));
    expect(old.state).toBe("unavailable");
    const partial = await loadOfficialAlerts([inside], now, fetcher({
      "https://ssl.smn.gob.ar/CAP/AR.php": rss(["missing"]),
    }));
    expect(partial.state).toBe("partial");
  });

  it("acota las solicitudes cuando el índice tiene muchos polígonos y declara cobertura parcial", async () => {
    const names = Array.from({ length: 30 }, (_, i) => `CAP_Tormenta_Patagonia_${i}`)
      .concat(Array.from({ length: 30 }, (_, i) => `CAP_Tormenta_Llanura_${i}`));
    const requested: string[] = [];
    const mock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      return new Response(url.endsWith("AR.php") ? rss(names) : cap({ id: url }), { status: 200 });
    }) as typeof fetch;
    const result = await loadOfficialAlerts([inside], now, mock);
    expect(result.state).toBe("partial");
    expect(requested).toHaveLength(17);
    expect(requested.slice(1).every((url) => url.includes("Llanura"))).toBe(true);
  });
});
