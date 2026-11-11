import { describe, expect, it } from "vitest";
import { coversPlace, parseCap, parseIndex } from "./cap";

const inside = { id: "estadio", lat: -31.61195, lon: -68.52818 };
const outside = { id: "cordoba", lat: -31.29362, lon: -64.29762 };
const polygon = "-32,-69 -32,-68 -31,-68 -31,-69 -32,-69";

function cap(overrides: { id?: string; status?: string; type?: string; event?: string; onset?: string; expires?: string; polygon?: string; references?: string } = {}) {
  return `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>${overrides.id ?? "cap-1"}</identifier><sender>smn@smn.gob.ar</sender>
    <sent>2026-11-11T20:55:14-03:00</sent><status>${overrides.status ?? "Actual"}</status>
    <msgType>${overrides.type ?? "Update"}</msgType><scope>Public</scope>
    ${overrides.references ? `<references>${overrides.references}</references>` : ""}
    <info><language>es-AR</language><category>Met</category><event>${overrides.event ?? "Viento Zonda"}</event>
    <onset>${overrides.onset ?? "2026-11-12T15:00:00-03:00"}</onset>
    <expires>${overrides.expires ?? "2026-11-13T02:59:59-03:00"}</expires>
    <severity>Moderate</severity><headline>Viento Zonda</headline>
    <description>Alerta de prueba</description><area><polygon>${overrides.polygon ?? polygon}</polygon></area>
    </info></alert>`;
}

describe("CAP oficial", () => {
  it("lee fechas y polígono del esquema real; incluye el Estadio y excluye Córdoba", () => {
    const message = parseCap(cap());
    expect(message.status).toBe("Actual");
    expect(message.msgType).toBe("Update");
    expect(message.info?.startsAt).toBe("2026-11-12T18:00:00.000Z");
    expect(message.info && coversPlace(message.info, inside)).toBe(true);
    expect(message.info && coversPlace(message.info, outside)).toBe(false);
  });

  it("lee referencias de actualización y rechaza DTD", () => {
    const message = parseCap(cap({ references: "smn@smn.gob.ar,cap-old,2026-11-11T12:00:00-03:00" }));
    expect(message.references).toEqual(["cap-old"]);
    expect(() => parseCap(`<!DOCTYPE alert [<!ENTITY x SYSTEM "file:///etc/passwd">]>${cap()}`)).toThrow();
  });

  it("lee RSS con fecha y enlaces únicos", () => {
    const xml = `<rss><channel><lastBuildDate>Wed, 11 Nov 2026 21:52:11 GMT</lastBuildDate>
      <item><title>Viento</title><link>https://ssl.smn.gob.ar/feeds/CAP/a.xml</link></item>
      <item><title>Viento</title><link>https://ssl.smn.gob.ar/feeds/CAP/a.xml</link></item>
    </channel></rss>`;
    expect(parseIndex(xml)).toEqual({ publishedAt: "2026-11-11T21:52:11.000Z", urls: ["https://ssl.smn.gob.ar/feeds/CAP/a.xml"] });
  });
});

export { cap, inside, outside, polygon };
