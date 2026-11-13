import { localDateParts } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import type { PublicPlace } from "./places";
import { sourceLabel } from "./sources";
import { consensusHours } from "./consensus";
import { detectZonda } from "./zonda";
import { ERROR_FLOOR, RANKED_VARIABLES, maeOf, weightFor, type ScoreBucket } from "./accuracy";
import type { Thresholds } from "./thresholds";
import { addDays } from "./time";
import type {
  ClimateReport,
  ConsensusHour,
  DayView,
  HourPoint,
  Level,
  Momento,
  Observation,
  PlaceView,
  RankingRow,
  Reason,
  SourceStatus,
  Variable,
  ZondaView,
} from "./types";

export type AlertInput = {
  placeId: string;
  event: string;
  headline: string;
  description: string;
  severity: string;
  startsAt: string;
  expiresAt: string;
  sourceUrl: string;
};

export type ScoreMap = Record<string, Partial<Record<Variable, ScoreBucket>>>;

const LEVEL_RANK: Record<Level, number> = { ok: 0, atencion: 1, alerta: 2 };

function maxLevel(levels: Level[]): Level {
  return levels.reduce((best, level) => (LEVEL_RANK[level] > LEVEL_RANK[best] ? level : best), "ok");
}

/** La app avisa. La frase dice qué mirar, no si se puede trabajar. */
export function suggestionFor(level: Level): string | null {
  if (level === "alerta") return "Revisar estructura. Cuidar lonas y cartelería, que no haya nada suelto.";
  if (level === "atencion") return "Ajustar contrapesos. Cuidar lonas y cartelería, que no haya nada suelto.";
  return null;
}

function momentoTexto(hour: ConsensusHour): string {
  const gust = hour.wind_gust_kmh ?? 0;
  const wind = hour.wind_speed_kmh ?? 0;
  const rain = Math.max(hour.precipitation_mm ?? 0, hour.rainHigh_mm ?? 0);
  const parts: string[] = [];
  if (gust >= 50 || wind >= 50) parts.push(`Ráfagas ${kmh(Math.max(gust, wind))}`);
  if (rain >= 2) parts.push(`Ojo que hay lluvia, ${mm(rain)}`);
  return parts.join(". ") || "Sin alerta en esa hora.";
}

function hourRisk(hour: ConsensusHour | undefined, thresholds: Thresholds): Level {
  if (!hour) return "ok";
  const gust = hour.wind_gust_kmh ?? 0;
  const wind = hour.wind_speed_kmh ?? 0;
  const peak = hour.gustPeak_kmh ?? 0;
  const rain = Math.max(hour.precipitation_mm ?? 0, hour.rainHigh_mm ?? 0);
  if (gust >= thresholds.gustAlerta || rain >= thresholds.rainHourAlertaMm) return "alerta";
  if (gust >= thresholds.gustAtencion || wind >= thresholds.windAtencion || peak >= thresholds.gustAlerta || rain >= thresholds.rainAtencionMm) {
    return "atencion";
  }
  return "ok";
}

function inRange(iso: string, from: number, until: number): boolean {
  const time = Date.parse(iso);
  return time >= from && time <= until;
}

function localHour(iso: string, timeZone: string): number {
  return localDateParts(new Date(iso), timeZone).hour;
}

function whenPhrase(iso: string, timeZone: string, now: Date): string {
  const delta = Date.parse(iso) - now.getTime();
  if (delta <= 90 * 60_000 && delta >= -30 * 60_000) return "en la próxima hora";
  const hour = localHour(iso, timeZone);
  const clock = hour === 0 ? "a la medianoche" : `a las ${hour} h`;
  const day = localDateParts(new Date(iso), timeZone).date;
  const today = localDateParts(now, timeZone).date;
  if (day === today) return clock;
  if (day === addDays(today, 1)) return `mañana ${clock}`;
  return `el ${formatDayLabel(day)} ${clock}`;
}

function kmh(value: number): string {
  return `${Math.round(value)} km/h`;
}

function mm(value: number): string {
  const digits = value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} mm`;
}

function localMoment(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function textOf(alert: AlertInput): string {
  return `${alert.event} ${alert.headline} ${alert.description}`;
}

function isZondaAlert(alert: AlertInput): boolean {
  return /zonda/i.test(textOf(alert));
}

function isStorm(alert: AlertInput): boolean {
  return /tormenta|granizo/i.test(`${alert.event} ${alert.headline}`);
}

function officialLevel(alert: AlertInput): Level {
  if (isStorm(alert) || /extreme|severe|extrema|severa/i.test(alert.severity)) return "alerta";
  return "atencion";
}

function sourcesAtLeast(points: HourPoint[], time: string, min: number): number {
  const seen = new Set<string>();
  for (const point of points) {
    if (point.validTime === time && (point.wind_gust_kmh ?? -1) >= min) seen.add(point.source);
  }
  return seen.size;
}

function overlapsDay(alert: AlertInput, date: string, timeZone: string): boolean {
  const start = localDateParts(new Date(alert.startsAt), timeZone).date;
  const end = localDateParts(new Date(alert.expiresAt), timeZone).date;
  return date >= start && date <= end;
}

function statusWord(level: Level, flags: { zonda: boolean; rain: boolean; wind: boolean }, hasData: boolean): string {
  if (!hasData) return "Sin datos";
  if (level === "ok") return "Todo bien";
  if (flags.zonda && level === "alerta") return "Zonda";
  if (flags.zonda) return "Vigilar Zonda";
  if (flags.wind && level === "alerta") return "Ráfagas";
  if (flags.rain && level === "alerta") return "Lluvia";
  if (flags.wind) return "Viento";
  if (flags.rain) return "Lluvia";
  if (level === "alerta") return "Alerta";
  return "Atención";
}

function weightOf(scores: ScoreMap, source: string, variable: Variable): number {
  return weightFor(scores[source]?.[variable], ERROR_FLOOR[variable] ?? 1);
}

function presentObservation(candidates: Observation[], now: Date): Observation | null {
  const fresh = candidates
    .filter((obs) => {
      const age = now.getTime() - Date.parse(obs.time);
      return age >= -10 * 60_000 && age <= 3 * 3_600_000;
    })
    .sort((a, b) => b.time.localeCompare(a.time));
  if (fresh.length === 0) return null;
  const primary = fresh[0];
  const gust = fresh.find((obs) => obs.wind_gust_kmh !== null);
  return { ...primary, wind_gust_kmh: primary.wind_gust_kmh ?? gust?.wind_gust_kmh ?? null };
}

function buildPlace(
  place: PublicPlace,
  points: HourPoint[],
  observations: Observation[],
  alerts: AlertInput[],
  scores: ScoreMap,
  thresholds: Thresholds,
  now: Date,
  recentRainMm = 0,
): PlaceView {
  const consensus = consensusHours(points, (source, variable) => weightOf(scores, source, variable));
  const from = now.getTime() - 60 * 60_000;
  const until48 = now.getTime() + 48 * 3_600_000;
  const until24 = now.getTime() + 24 * 3_600_000;
  const officialZonda = alerts.find(isZondaAlert);
  const zonda = detectZonda(consensus, {
    enabled: place.zonda,
    official: Boolean(officialZonda),
    officialDetail: officialZonda ? `${officialZonda.headline}. ${officialZonda.description}`.trim() : undefined,
    thresholds,
    from: new Date(from),
    until: new Date(until48),
  });

  const reasons: Reason[] = [];
  if (zonda.level === "oficial" || zonda.level === "probable") {
    reasons.push({
      level: "alerta",
      code: "zonda",
      title: zonda.title,
      detail: [zonda.detail, zonda.reasons.join(". ")].filter(Boolean).join(" "),
      href: officialZonda?.sourceUrl,
    });
  } else if (zonda.level === "vigilancia") {
    reasons.push({
      level: "atencion",
      code: "zonda",
      title: zonda.title,
      detail: [zonda.detail, zonda.reasons.join(". ")].filter(Boolean).join(" "),
    });
  }

  const windHits: (Reason & { time: string })[] = [];
  for (const hour of consensus) {
    if (!inRange(hour.validTime, from, until48)) continue;
    const gust = hour.wind_gust_kmh ?? 0;
    const windSpeed = hour.wind_speed_kmh ?? 0;
    const peak = hour.gustPeak_kmh ?? 0;
    const agreeing = sourcesAtLeast(points, hour.validTime, thresholds.gustAlerta);
    const when = whenPhrase(hour.validTime, place.timezone, now);
    if (gust >= thresholds.gustAlerta || agreeing >= 2) {
      windHits.push({
        time: hour.validTime,
        level: "alerta",
        code: "rafaga",
        title: "Ráfagas fuertes",
        detail: `Ráfagas de ${kmh(Math.max(gust, peak))} ${when}. Alerta desde ${thresholds.gustAlerta} km/h.`,
      });
    } else if (gust >= thresholds.gustAtencion || windSpeed >= thresholds.windAtencion || peak >= thresholds.gustAtencion) {
      const lone = peak >= thresholds.gustAlerta && gust < thresholds.gustAlerta;
      windHits.push({
        time: hour.validTime,
        level: "atencion",
        code: lone ? "rafaga-aislada" : "rafaga",
        title: lone ? "Una fuente marca ráfagas altas" : "Ráfagas para mirar",
        detail: lone
          ? `${sourceLabel(hour.gustPeakSource ?? "")} llega a ${kmh(peak)} ${when}. El valor que usamos queda en ${kmh(gust)}.`
          : `${windSpeed >= thresholds.windAtencion && gust < thresholds.gustAtencion ? "Viento" : "Ráfagas"} de ${kmh(Math.max(gust, windSpeed, peak))} ${when}. Para tener en cuenta desde ${thresholds.windAtencion} km/h.`,
      });
    }
  }
  const zondaExplains = zonda.level === "probable" || zonda.level === "oficial";
  const wind = windHits
    .filter((hit) => !(zondaExplains && zonda.times.includes(hit.time)))
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.time.localeCompare(b.time))[0];
  if (wind) reasons.push({ level: wind.level, code: wind.code, title: wind.title, detail: wind.detail });

  const next24 = consensus.filter((hour) => inRange(hour.validTime, from, until24));
  const rainSum = next24.reduce((sum, hour) => sum + (hour.precipitation_mm ?? 0), 0);
  const rainHour = next24.reduce((max, hour) => Math.max(max, hour.rainHigh_mm ?? 0), 0);
  const wetGround = recentRainMm >= thresholds.recentRainWetMm;
  let rainLevel: Level = "ok";
  if (next24.length > 0 && (rainSum >= thresholds.rainAlertaMm || rainHour >= thresholds.rainHourAlertaMm)) rainLevel = "alerta";
  else if (next24.length > 0 && (rainSum >= thresholds.rainAtencionMm || rainHour >= thresholds.rainAtencionMm)) rainLevel = "atencion";
  if (wetGround && rainSum >= thresholds.rainAtencionMm && rainLevel === "atencion" && (rainSum >= thresholds.rainAlertaMm / 2 || rainHour >= 3)) {
    rainLevel = "alerta";
  }
  if (rainLevel !== "ok") {
    const ground = wetGround ? ` En los últimos días se acumularon ${mm(recentRainMm)}: el piso del armado puede estar blando.` : "";
    reasons.push({
      level: rainLevel,
      code: "lluvia",
      title: "Ojo que hay lluvia",
      detail: `Ojo que hay lluvia. En las próximas 24 h, ${mm(rainSum)}.${rainHour >= thresholds.rainHourAlertaMm ? ` En una hora se llega a ${mm(rainHour)}.` : ""}${ground}`,
    });
  }

  for (const alert of alerts) {
    if (isZondaAlert(alert)) continue;
    reasons.push({
      level: officialLevel(alert),
      code: isStorm(alert) ? "tormenta" : "smn",
      title: isStorm(alert) ? "Tormenta" : alert.headline || alert.event,
      detail: `Fuente: SMN. ${alert.event}. Hasta ${localMoment(alert.expiresAt, place.timezone)}.`,
      href: alert.sourceUrl,
    });
  }

  if (points.length === 0) {
    reasons.push({
      level: "atencion",
      code: "sin-datos",
      title: "Sin pronóstico",
      detail: "No llegaron modelos para este lugar. Sistema sin datos, usar SMN.",
    });
  }

  const level = maxLevel(reasons.map((reason) => reason.level));
  const headline = level === "alerta" ? "Alerta" : level === "atencion" ? "Atención" : "Todo bien";

  const today = localDateParts(now, place.timezone).date;
  const days: DayView[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const hours = consensus.filter(
      (hour) => localDateParts(new Date(hour.validTime), place.timezone).date === date && Date.parse(hour.validTime) >= from,
    );
    const flags = {
      zonda: hours.some((hour) => zonda.times.includes(hour.validTime)) || alerts.some((alert) => isZondaAlert(alert) && overlapsDay(alert, date, place.timezone)),
      rain: hours.some((hour) => (hour.precipitation_mm ?? 0) >= thresholds.rainAtencionMm || (hour.rainHigh_mm ?? 0) >= thresholds.rainHourAlertaMm),
      wind: hours.some((hour) => (hour.wind_gust_kmh ?? 0) >= thresholds.gustAtencion || (hour.wind_speed_kmh ?? 0) >= thresholds.windAtencion || (hour.gustPeak_kmh ?? 0) >= thresholds.gustAtencion),
    };
    let dayLevel: Level = "ok";
    for (const hour of hours) {
      const gust = hour.wind_gust_kmh ?? 0;
      const windSpeed = hour.wind_speed_kmh ?? 0;
      const peak = hour.gustPeak_kmh ?? 0;
      if (gust >= thresholds.gustAlerta || (hour.rainHigh_mm ?? 0) >= thresholds.rainHourAlertaMm) {
        dayLevel = "alerta";
      } else if (dayLevel === "ok" && (gust >= thresholds.gustAtencion || windSpeed >= thresholds.windAtencion || peak >= thresholds.gustAtencion || (hour.precipitation_mm ?? 0) >= thresholds.rainAtencionMm)) {
        dayLevel = "atencion";
      }
    }
    const rainTotal = hours.reduce((sum, hour) => sum + (hour.precipitation_mm ?? 0), 0);
    if (rainTotal >= thresholds.rainAlertaMm) dayLevel = "alerta";
    else if (dayLevel === "ok" && rainTotal >= thresholds.rainAtencionMm) dayLevel = "atencion";
    if (flags.zonda && zonda.level === "probable") dayLevel = maxLevel([dayLevel, "alerta"]);
    if (flags.zonda && zonda.level === "vigilancia") dayLevel = maxLevel([dayLevel, "atencion"]);
    for (const alert of alerts) {
      if (!overlapsDay(alert, date, place.timezone)) continue;
      dayLevel = maxLevel([dayLevel, isZondaAlert(alert) ? "alerta" : officialLevel(alert)]);
    }
    const temps = hours.flatMap((hour) => (hour.temperature_c === null ? [] : [hour.temperature_c]));
    const hasData = hours.length > 0;
    return {
      date,
      label: index === 0 ? "Hoy" : index === 1 ? "Mañana" : formatDayLabel(date),
      level: hasData ? dayLevel : index === 0 ? "atencion" : "ok",
      status: statusWord(hasData ? dayLevel : "ok", flags, hasData),
      tempMin: temps.length ? Math.min(...temps) : null,
      tempMax: temps.length ? Math.max(...temps) : null,
      rainMm: hasData ? rainTotal : null,
      windMax: hours.reduce<number | null>((max, hour) => (hour.wind_speed_kmh === null ? max : Math.max(max ?? 0, hour.wind_speed_kmh)), null),
      gustMax: hours.reduce<number | null>((max, hour) => (hour.wind_gust_kmh === null ? max : Math.max(max ?? 0, hour.wind_gust_kmh)), null),
    };
  });

  const observed = presentObservation(observations, now);
  const current = [...consensus].sort(
    (a, b) => Math.abs(Date.parse(a.validTime) - now.getTime()) - Math.abs(Date.parse(b.validTime) - now.getTime()),
  )[0];
  const currentClose = current && Math.abs(Date.parse(current.validTime) - now.getTime()) <= 90 * 60_000 ? current : undefined;
  const nowBlock = observed
    ? {
        temperature: observed.temperature_c,
        humidity: observed.humidity_pct,
        wind: observed.wind_speed_kmh,
        gust: observed.wind_gust_kmh ?? currentClose?.wind_gust_kmh ?? null,
        gustIsForecast: observed.wind_gust_kmh === null && currentClose?.wind_gust_kmh != null,
        direction: observed.wind_direction_deg,
      }
    : currentClose
      ? {
          temperature: currentClose.temperature_c,
          humidity: currentClose.humidity_pct,
          wind: currentClose.wind_speed_kmh,
          gust: currentClose.wind_gust_kmh,
          gustIsForecast: currentClose.wind_gust_kmh !== null,
          direction: currentClose.wind_direction_deg,
        }
      : null;

  const ids = [...new Set(points.map((point) => point.source))];
  const order = Object.keys({
    "om-ecmwf": 1,
    "om-gfs": 1,
    "om-icon": 1,
    "om-gem": 1,
    "om-meteofrance": 1,
    "met-norway": 1,
    openweather: 1,
    weatherapi: 1,
    tomorrow: 1,
    "smn-wrf": 1,
  });
  ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const zondaView: ZondaView = {
    level: zonda.level,
    title: zonda.title,
    detail: zonda.detail,
    reasons: zonda.reasons,
  };

  const ahoraHour = currentClose;
  const ahoraNivel = hourRisk(ahoraHour, thresholds);
  const ahoraTexto = !nowBlock
    ? "Sin lectura de esta hora."
    : [
        nowBlock.temperature === null ? null : `${Math.round(nowBlock.temperature)}°`,
        nowBlock.wind === null ? null : `viento ${kmh(nowBlock.wind)}`,
        nowBlock.gust === null ? null : `ráfagas ${kmh(nowBlock.gust)}${nowBlock.gustIsForecast ? " (pronóstico)" : ""}`,
        ahoraNivel === "ok" ? "Sin alerta en este momento." : null,
      ].filter(Boolean).join(" · ");
  const future = consensus
    .filter((hour) => Date.parse(hour.validTime) > now.getTime() + 30 * 60_000 && Date.parse(hour.validTime) <= until48)
    .sort((a, b) => a.validTime.localeCompare(b.validTime));
  const despuesHour = level === "ok"
    ? undefined
    : future.find((hour) => hourRisk(hour, thresholds) === level)
      ?? future.find((hour) => hourRisk(hour, thresholds) !== "ok");
  const despues: Momento | null = despuesHour
    ? {
        etiqueta: "Después",
        cuando: whenPhrase(despuesHour.validTime, place.timezone, now),
        nivel: hourRisk(despuesHour, thresholds),
        texto: momentoTexto(despuesHour),
      }
    : null;
  const ahora: Momento = { etiqueta: "Ahora", cuando: "Ahora", nivel: ahoraNivel, texto: ahoraTexto };
  const summary = level === "ok"
    ? "Ahora y en las próximas horas no hay viento, lluvia ni Zonda para marcar."
    : [ahora.texto, despues ? `Después, ${despues.cuando}: ${despues.texto}` : null].filter(Boolean).join(" ");

  return {
    id: place.id,
    name: place.name,
    region: place.region,
    level,
    headline,
    summary,
    sugerencia: suggestionFor(level),
    ahora,
    despues,
    lluviaRecienteMm: recentRainMm,
    nowLabel: observed ? `${observed.label}, ${formatAgo(new Date(observed.time), now)}` : nowBlock ? "Pronóstico de esta hora" : null,
    now: nowBlock,
    reasons,
    zonda: zondaView,
    days,
    sourceLabels: ids.map(sourceLabel),
  };
}

function rankingNote(storage: ClimateReport["storage"], rows: RankingRow[]): string {
  const samples = rows.reduce((sum, row) => sum + row.entries.reduce((inner, entry) => inner + entry.samples, 0), 0);
  if (storage === "none") {
    return "El historial de aciertos todavía no está guardado. Hasta entonces todas las fuentes pesan igual: en viento y ráfagas se toma el valor alto.";
  }
  if (samples === 0) {
    return "El registro está listo y todavía no hay horas vencidas para comparar. El cron diario las va a ir cerrando contra el METAR.";
  }
  return "Error medio absoluto contra el METAR del aeropuerto más cercano (si no hay METAR, contra la estación SMN). Con menos de 8 comparaciones la fuente sigue pesando igual. Ciudad y estadio de San Juan comparten la estación: el ranking es de la zona, no del predio.";
}

/** Lluvia de los días ya pasados, de una sola fuente, para el piso del armado. */
export function recentRainMm(points: HourPoint[], placeId: string, timeZone: string, now: Date): number {
  const today = localDateParts(now, timeZone).date;
  const source = points.some((point) => point.placeId === placeId && point.source === "om-ecmwf")
    ? "om-ecmwf"
    : points.find((point) => point.placeId === placeId)?.source;
  if (!source) return 0;
  const sum = points.reduce((total, point) => {
    if (point.placeId !== placeId || point.source !== source || point.precipitation_mm === null) return total;
    return localDateParts(new Date(point.validTime), timeZone).date < today ? total + point.precipitation_mm : total;
  }, 0);
  return Math.round(sum * 10) / 10;
}

export function buildReport(input: {
  now: Date;
  places: PublicPlace[];
  points: HourPoint[];
  observations: Observation[];
  alerts: AlertInput[];
  alertsState: "ok" | "partial" | "unavailable";
  scores: ScoreMap;
  thresholds: Thresholds;
  sources: SourceStatus[];
  storage: ClimateReport["storage"];
  recentRain?: Record<string, number>;
}): ClimateReport {
  const placeViews = input.places.map((place) =>
    buildPlace(
      place,
      input.points.filter((point) => point.placeId === place.id),
      input.observations.filter((obs) => obs.placeId === place.id),
      input.alerts.filter((alert) => alert.placeId === place.id),
      input.scores,
      input.thresholds,
      input.now,
      input.recentRain?.[place.id] ?? 0,
    ),
  );
  placeViews.sort((a, b) => {
    const pin = (place: PlaceView) => (/bicentenario/i.test(place.name) ? 0 : 1);
    if (pin(a) !== pin(b)) return pin(a) - pin(b);
    return LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
  });

  const degraded = placeViews.every((place) => place.sourceLabels.length === 0);
  const level = degraded ? "atencion" : maxLevel(placeViews.map((place) => place.level));
  const headline = degraded ? "Sin datos" : level === "ok" ? "Todo bien" : level === "alerta" ? "Alerta" : "Atención";
  const summary = degraded
    ? "Sistema sin datos, usar SMN."
    : level === "ok"
      ? "En los lugares que seguimos no hay viento, lluvia ni Zonda por encima de los umbrales."
      : placeViews
          .filter((place) => place.level === level)
          .map((place) => `${place.name}: ${place.headline.toLowerCase()}`)
          .join(" · ");

  const ranking = RANKED_VARIABLES.map(({ variable, label, unit }) => ({
    variable,
    label,
    unit,
    entries: Object.entries(input.scores)
      .flatMap(([source, byVariable]) => {
        const bucket = byVariable?.[variable];
        const mae = maeOf(bucket);
        if (!bucket || mae === null) return [];
        return [{ source, label: sourceLabel(source), mae, samples: bucket.samples }];
      })
      .sort((a, b) => a.mae - b.mae || b.samples - a.samples),
  }));

  return {
    checkedAt: input.now.toISOString(),
    level,
    headline,
    summary,
    places: placeViews,
    ranking,
    rankingNote: rankingNote(input.storage, ranking),
    storage: input.storage,
    degraded,
    officialNote:
      input.alertsState === "ok"
        ? null
        : input.alertsState === "unavailable"
          ? "No se pudieron verificar las alertas oficiales ahora. Consultá el SMN."
          : "La consulta oficial fue parcial: pueden faltar alertas. Consultá el SMN.",
    sources: input.sources,
    thresholds: {
      gustAtencion: input.thresholds.gustAtencion,
      gustAlerta: input.thresholds.gustAlerta,
      windAlerta: input.thresholds.windAlerta,
      rainAtencionMm: input.thresholds.rainAtencionMm,
      rainAlertaMm: input.thresholds.rainAlertaMm,
    },
  };
}
