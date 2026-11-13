/** Hora UTC redondeada hacia abajo, en ISO. Acepta ISO, Date o unix (s o ms). */
export function hourIso(input: string | number | Date): string | null {
  const ms =
    input instanceof Date
      ? input.getTime()
      : typeof input === "number"
        ? input < 1e12
          ? input * 1000
          : input
        : Date.parse(input);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
