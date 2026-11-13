import { describe, expect, it } from "vitest";
import { emptyPreferences } from "./prefs";
import { mergeChannels, mergePlaceList } from "./prefs-store";

describe("preferencias", () => {
  it("cambiar lugares no pisa el mail ni el WhatsApp", () => {
    const current = { ...emptyPreferences(), emailOn: true, email: "hugo@masalto.com.ar", whatsapp: "+5492640000000" };
    const incoming = { ...emptyPreferences(), disabledIds: ["estadio-san-juan"], email: "otro@ejemplo.com" };
    const merged = mergePlaceList(current, incoming);
    expect(merged.disabledIds).toEqual(["estadio-san-juan"]);
    expect(merged.email).toBe("hugo@masalto.com.ar");
    expect(merged.whatsapp).toBe("+5492640000000");
  });

  it("cambiar destinos no apaga los lugares", () => {
    const current = { ...emptyPreferences(), disabledIds: ["san-juan-ciudad"], custom: [] };
    const incoming = { ...emptyPreferences(), emailOn: true, email: "obra@masalto.com.ar", disabledIds: ["estadio-san-juan"] };
    const merged = mergeChannels(current, incoming);
    expect(merged.email).toBe("obra@masalto.com.ar");
    expect(merged.disabledIds).toEqual(["san-juan-ciudad"]);
  });
});
