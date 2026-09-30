import type { DaySummary } from "./combine";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/** "mié 30" a partir de un día local `YYYY-MM-DD`. */
export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day}`;
}

/** Punto cardinal desde el que sopla el viento. */
export function compass(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function formatAgo(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function millimeters(value: number): string {
  return value < 10 ? String(Math.round(value * 10) / 10).replace(".", ",") : String(Math.round(value));
}

export function formatTemperature(day: DaySummary): string {
  if (day.temperatureMin === null || day.temperatureMax === null) return "sin dato";
  return `${Math.round(day.temperatureMin)} a ${Math.round(day.temperatureMax)} °C`;
}

/** Mediana entre modelos y, si alguno da bastante más, el valor alto. */
export function formatPrecipitation(day: DaySummary): string {
  if (day.precipitation === null) return "sin dato";
  const typical = millimeters(day.precipitation);
  const high = millimeters(day.precipitationHigh ?? day.precipitation);
  if (high === "0") return "sin lluvia";
  return typical === high ? `${typical} mm` : `${typical} a ${high} mm`;
}

export function formatWind(day: DaySummary): string {
  if (day.windMax === null) return "sin dato";
  const direction = day.windDirection === null ? "" : ` del ${compass(day.windDirection)}`;
  return `${Math.round(day.windMax)} km/h${direction}`;
}

export function formatGust(day: DaySummary): string {
  if (day.gustMax === null) return "sin dato";
  const hour = day.gustHour === null ? "" : ` (${day.gustHour} h)`;
  return `hasta ${Math.round(day.gustMax)} km/h${hour}`;
}

/** Una línea por día para el bot. */
export function formatDayLine(day: DaySummary): string {
  const rain = formatPrecipitation(day);
  return [
    `${formatDayLabel(day.date)}: ${formatTemperature(day)}`,
    rain === "sin lluvia" ? rain : `lluvia ${rain}`,
    `viento ${formatWind(day)}`,
    `ráfagas ${formatGust(day)}`,
  ].join(" · ");
}
