/** Tipos compartidos del consenso en vivo. Sin I/O. */

export type Level = "ok" | "atencion" | "alerta";

export type Variable =
  | "temperature_c"
  | "humidity_pct"
  | "precipitation_mm"
  | "wind_speed_kmh"
  | "wind_gust_kmh"
  | "wind_direction_deg"
  | "pressure_hpa";

/** Una hora de una fuente, ya en unidades comunes (km/h, °C, mm, hPa). */
export type HourPoint = {
  placeId: string;
  source: string;
  validTime: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_direction_deg: number | null;
  pressure_hpa: number | null;
  /** Presión a nivel del mar. No se mezcla con la presión de superficie. */
  pressureIsMsl?: boolean;
};

export type ConsensusHour = {
  validTime: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  rainHigh_mm: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  wind_gust_kmh: number | null;
  /** Ráfaga más alta de cualquier fuente, aunque pese poco. */
  gustPeak_kmh: number | null;
  gustPeakSource: string | null;
  pressure_hpa: number | null;
  sources: number;
};

export type Observation = {
  placeId: string;
  time: string;
  source: "metar" | "smn";
  label: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_direction_deg: number | null;
  pressure_hpa: number | null;
};

export type Reason = {
  level: Level;
  code: string;
  title: string;
  detail: string;
  href?: string;
};

export type ZondaLevel = "none" | "vigilancia" | "probable" | "oficial";

export type ZondaView = {
  level: ZondaLevel;
  title: string;
  detail: string;
  reasons: string[];
};

export type DayView = {
  date: string;
  label: string;
  level: Level;
  status: string;
  tempMin: number | null;
  tempMax: number | null;
  rainMm: number | null;
  windMax: number | null;
  gustMax: number | null;
};

export type PlaceView = {
  id: string;
  name: string;
  region: string;
  level: Level;
  headline: string;
  summary: string;
  nowLabel: string | null;
  now: {
    temperature: number | null;
    humidity: number | null;
    wind: number | null;
    gust: number | null;
    /** La ráfaga no viene en el SMN y a veces tampoco en el METAR: en ese caso es del consenso. */
    gustIsForecast: boolean;
    direction: number | null;
  } | null;
  reasons: Reason[];
  zonda: ZondaView;
  days: DayView[];
  sourceLabels: string[];
};

export type RankingEntry = {
  source: string;
  label: string;
  mae: number;
  samples: number;
};

export type RankingRow = {
  variable: Variable;
  label: string;
  unit: string;
  entries: RankingEntry[];
};

export type SourceStatus = { id: string; label: string; ok: boolean };

export type ClimateReport = {
  checkedAt: string;
  level: Level;
  headline: string;
  summary: string;
  places: PlaceView[];
  ranking: RankingRow[];
  rankingNote: string;
  storage: "blob" | "kv" | "none";
  degraded: boolean;
  /** Aviso cuando el índice CAP del SMN no se pudo leer entero. No cambia el semáforo. */
  officialNote: string | null;
  sources: SourceStatus[];
  thresholds: {
    gustAtencion: number;
    gustAlerta: number;
    windAlerta: number;
    rainAtencionMm: number;
    rainAlertaMm: number;
  };
};
