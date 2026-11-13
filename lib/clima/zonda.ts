import { directionName } from "@/lib/forecast/phrases";
import type { Thresholds } from "./thresholds";
import type { ConsensusHour, ZondaLevel } from "./types";

export type ZondaAssessment = {
  level: ZondaLevel;
  title: string;
  detail: string;
  reasons: string[];
  /** Horas UTC del episodio de modelo, para no duplicar el aviso de ráfaga. */
  times: string[];
};

const NONE: ZondaAssessment = { level: "none", title: "", detail: "", reasons: [], times: [] };

/** Oeste a noroeste, de WSW a NNW. El Zonda baja de la cordillera por ese sector. */
export function isWesterly(degrees: number | null): boolean {
  if (degrees === null || !Number.isFinite(degrees)) return false;
  const direction = ((degrees % 360) + 360) % 360;
  return direction >= 247.5 && direction <= 337.5;
}

function hourAt(hours: ConsensusHour[], time: string, offsetHours: number): ConsensusHour | undefined {
  const target = new Date(Date.parse(time) + offsetHours * 3_600_000).toISOString();
  return hours.find((hour) => hour.validTime === target);
}

type Mark = { time: string; level: "vigilancia" | "probable"; reasons: string[]; gust: number };

/**
 * Zonda en el pronóstico: viento del oeste/noroeste, ráfagas, y aire cálido y seco
 * (humedad baja, o una suba de temperatura / caída de humedad en 3 horas).
 * La presión que baja suma como explicación, no alcanza sola.
 * Una tarde seca de San Juan sin viento fuerte no dispara el aviso.
 */
export function detectZonda(
  hours: ConsensusHour[],
  options: {
    enabled: boolean;
    official: boolean;
    officialDetail?: string;
    thresholds: Thresholds;
    from: Date;
    until: Date;
  },
): ZondaAssessment {
  const marks: Mark[] = [];
  if (options.enabled) {
    for (const hour of hours) {
      const when = Date.parse(hour.validTime);
      if (when < options.from.getTime() || when > options.until.getTime()) continue;
      if (!isWesterly(hour.wind_direction_deg)) continue;
      const gust = hour.wind_gust_kmh ?? 0;
      const wind = hour.wind_speed_kmh ?? 0;
      const strength = Math.max(gust, wind);
      const moderate = strength >= options.thresholds.zondaGustVigilancia;
      const strong = strength >= options.thresholds.zondaGust;
      if (!moderate) continue;

      const reasons: string[] = [];
      if (hour.wind_direction_deg !== null) reasons.push(`viento del ${directionName(hour.wind_direction_deg)}`);
      if (gust > 0) reasons.push(`ráfagas de ${Math.round(gust)} km/h`);
      else if (wind > 0) reasons.push(`viento de ${Math.round(wind)} km/h`);

      const humidity = hour.humidity_pct;
      const dry = humidity !== null && humidity <= options.thresholds.zondaHumidity;
      const dryish = humidity !== null && humidity <= options.thresholds.zondaHumidityVigilancia;
      if (dry && humidity !== null) reasons.push(`humedad de ${Math.round(humidity)} %`);

      const previous = hourAt(hours, hour.validTime, -3);
      let jump = false;
      if (previous) {
        if (hour.temperature_c !== null && previous.temperature_c !== null) {
          const rise = hour.temperature_c - previous.temperature_c;
          if (rise >= options.thresholds.zondaTempRise) {
            jump = true;
            reasons.push(`la temperatura sube ${Math.round(rise)} °C en 3 h`);
          }
        }
        if (hour.humidity_pct !== null && previous.humidity_pct !== null) {
          const drop = previous.humidity_pct - hour.humidity_pct;
          if (drop >= options.thresholds.zondaHumidityDrop) {
            jump = true;
            reasons.push(`la humedad baja ${Math.round(drop)} puntos en 3 h`);
          }
        }
        if (hour.pressure_hpa !== null && previous.pressure_hpa !== null) {
          const drop = previous.pressure_hpa - hour.pressure_hpa;
          if (drop >= options.thresholds.zondaPressureDrop) {
            reasons.push(`la presión baja ${Math.round(drop * 10) / 10} hPa en 3 h`);
          }
        }
      }

      if (strong && (dry || jump)) marks.push({ time: hour.validTime, level: "probable", reasons, gust });
      else if (dryish || jump) marks.push({ time: hour.validTime, level: "vigilancia", reasons, gust });
    }
  }

  const probable = marks.filter((mark) => mark.level === "probable");
  const chosen = probable.length > 0 ? probable : marks;
  const modelLevel: ZondaLevel = probable.length > 0 ? "probable" : marks.length > 0 ? "vigilancia" : "none";
  const peak = [...chosen].sort((a, b) => b.gust - a.gust)[0];

  if (options.official) {
    const reasons = ["hay un aviso oficial del SMN", ...(peak?.reasons ?? [])];
    return {
      level: "oficial",
      title: "Alerta oficial de Zonda",
      detail: options.officialDetail?.trim() || "El SMN publicó un aviso de viento Zonda para este lugar.",
      reasons,
      times: chosen.map((mark) => mark.time),
    };
  }

  if (modelLevel === "none" || !peak) return NONE;
  return {
    level: modelLevel,
    title: modelLevel === "probable" ? "Posible Zonda" : "Vigilancia de Zonda",
    detail:
      modelLevel === "probable"
        ? "El pronóstico junta viento del oeste o noroeste, ráfagas y aire seco. Conviene mirar lonas y material suelto."
        : "Hay señal de Zonda, todavía incompleta. Conviene seguirla: puede crecer en las próximas horas.",
    reasons: peak.reasons,
    times: chosen.map((mark) => mark.time),
  };
}
