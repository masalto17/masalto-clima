export const SOURCE_LABELS: Record<string, string> = {
  "om-ecmwf": "ECMWF",
  "om-gfs": "GFS",
  "om-icon": "ICON",
  "om-gem": "GEM",
  "om-meteofrance": "Météo-France",
  "met-norway": "MET Norway",
  openweather: "OpenWeather",
  weatherapi: "WeatherAPI",
  tomorrow: "Tomorrow.io",
  "smn-wrf": "WRF SMN",
};

export function sourceLabel(id: string): string {
  return SOURCE_LABELS[id] ?? id;
}

/** Modelos de Open-Meteo que cubren Argentina sin clave. MET Norway va por su API. */
export const OPEN_METEO_MODELS: readonly (readonly [model: string, source: string])[] = [
  ["ecmwf_ifs025", "om-ecmwf"],
  ["gfs_seamless", "om-gfs"],
  ["icon_seamless", "om-icon"],
  ["gem_seamless", "om-gem"],
  ["meteofrance_seamless", "om-meteofrance"],
];

export const USER_AGENT = "masalto-clima/0.2 (+https://github.com/masalto17/masalto-clima)";
