import { describe, expect, it } from "vitest";
import { matchPlace, normalize, parseIntent } from "./intents";

const places = [
  { name: "San Juan Ciudad" },
  { name: "Estadio San Juan del Bicentenario" },
  { name: "Córdoba Villa Allende" },
];

describe("parseIntent", () => {
  it("reconoce /semana con y sin lugar", () => {
    expect(parseIntent("/semana")).toEqual({ kind: "week", placeQuery: "", explicitPlace: false });
    expect(parseIntent("/semana@MasAlto_Clima_Bot Córdoba")).toEqual({
      kind: "week",
      placeQuery: "cordoba",
      explicitPlace: true,
    });
  });

  it("reconoce preguntas simples por día y tema", () => {
    expect(parseIntent("¿Viento mañana en el estadio?")).toMatchObject({
      kind: "day",
      offset: 1,
      topic: "viento",
    });
    expect(parseIntent("llueve hoy en Córdoba?")).toMatchObject({ offset: 0, topic: "lluvia" });
    expect(parseIntent("ráfagas pasado mañana")).toMatchObject({ offset: 2, topic: "viento" });
    expect(parseIntent("temperatura en San Juan")).toMatchObject({ offset: 0, topic: "temperatura" });
    expect(parseIntent("cómo viene mañana")).toMatchObject({ offset: 1, topic: "general" });
    expect(parseIntent("cómo viene la semana en san juan")).toMatchObject({
      kind: "week",
      explicitPlace: false,
    });
  });

  it("lo que no reconoce cae en la ayuda", () => {
    expect(parseIntent("buenas")).toEqual({ kind: "help" });
    expect(parseIntent("/start")).toEqual({ kind: "help" });
    expect(parseIntent("")).toEqual({ kind: "help" });
  });
});

describe("matchPlace", () => {
  it("encuentra el lugar por palabras del nombre, sin acentos", () => {
    expect(matchPlace(places, "viento mañana en el estadio")?.name).toBe(
      "Estadio San Juan del Bicentenario",
    );
    expect(matchPlace(places, "cordoba")?.name).toBe("Córdoba Villa Allende");
    expect(matchPlace(places, normalize("¿Llueve en Villa Allende?"))?.name).toBe(
      "Córdoba Villa Allende",
    );
  });

  it("con 'san juan' elige la ciudad antes que el estadio", () => {
    expect(matchPlace(places, "lluvia hoy en san juan")?.name).toBe("San Juan Ciudad");
    expect(matchPlace(places, "bicentenario san juan")?.name).toBe(
      "Estadio San Juan del Bicentenario",
    );
  });

  it("devuelve null si no nombra ningún lugar", () => {
    expect(matchPlace(places, "viento mañana")).toBeNull();
    expect(matchPlace(places, "")).toBeNull();
  });
});
