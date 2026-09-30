import { describe, expect, it } from "vitest";
import { formatAgo, formatDayLabel } from "./format";

describe("formato", () => {
  it("arma la etiqueta del día", () => {
    expect(formatDayLabel("2026-09-30")).toBe("mié 30");
    expect(formatDayLabel("2026-10-04")).toBe("dom 4");
  });

  it("dice hace cuánto se actualizó", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(formatAgo(new Date("2026-09-30T11:59:50Z"), now)).toBe("recién");
    expect(formatAgo(new Date("2026-09-30T11:48:00Z"), now)).toBe("hace 12 min");
    expect(formatAgo(new Date("2026-09-30T09:00:00Z"), now)).toBe("hace 3 h");
    expect(formatAgo(new Date("2026-09-27T12:00:00Z"), now)).toBe("hace 3 días");
  });
});
