import { describe, expect, it } from "vitest";
import { evaluateHealth, isStale } from "./check";

const NOW = new Date("2026-09-30T12:00:00Z");
const FRESH = "2026-09-30T11:30:00Z";
const OLD = "2026-09-30T05:59:00Z";

describe("evaluateHealth", () => {
  it("avisa cuando una fuente lleva más de 6 h sin actualizar", () => {
    const actions = evaluateHealth(
      [
        { source: "open-meteo", last_ok_at: FRESH, alerted_at: null },
        { source: "smn-wrf", last_ok_at: OLD, alerted_at: null },
      ],
      NOW,
    );
    expect(actions).toEqual([
      {
        source: "smn-wrf",
        kind: "down",
        message: "Sistema sin datos, usar SMN. Fuente sin actualizar hace más de 6 h: WRF SMN.",
      },
    ]);
  });

  it("no repite el aviso mientras la fuente sigue caída", () => {
    const sources = [{ source: "smn-wrf", last_ok_at: OLD, alerted_at: "2026-09-30T06:30:00Z" }];
    expect(evaluateHealth(sources, NOW)).toEqual([]);
  });

  it("avisa una vez cuando la fuente vuelve", () => {
    const sources = [{ source: "open-meteo", last_ok_at: FRESH, alerted_at: "2026-09-30T06:30:00Z" }];
    expect(evaluateHealth(sources, NOW)).toEqual([
      expect.objectContaining({ source: "open-meteo", kind: "recovered" }),
    ]);
  });

  it("una fuente que nunca anduvo cuenta como caída", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale("2026-09-30T06:00:00Z", NOW)).toBe(false);
    expect(evaluateHealth([{ source: "x", last_ok_at: null, alerted_at: null }], NOW)).toHaveLength(1);
  });
});
