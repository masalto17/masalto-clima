/**
 * Cortes operativos para el semáforo de la vista.
 * No son límites de diseño de una estructura: `docs/refs/umbrales_estructuras.csv`
 * sigue vacío. El viento usa la escala de Beaufort (OMM) como lenguaje, igual
 * que el resto de la app, y estos números se cambian con variables de entorno.
 */
export type Thresholds = {
  gustAtencion: number;
  gustAlerta: number;
  /** Viento medio para tener en cuenta. No sube solo a alerta. */
  windAtencion: number;
  windAlerta: number;
  rainAtencionMm: number;
  rainAlertaMm: number;
  rainHourAlertaMm: number;
  /** Lluvia de los días previos que deja el piso del armado blando. */
  recentRainWetMm: number;
  zondaGust: number;
  zondaGustVigilancia: number;
  zondaHumidity: number;
  zondaHumidityVigilancia: number;
  zondaTempRise: number;
  zondaHumidityDrop: number;
  zondaPressureDrop: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  gustAtencion: 50,
  gustAlerta: 65,
  windAtencion: 50,
  windAlerta: 50,
  rainAtencionMm: 2,
  rainAlertaMm: 10,
  rainHourAlertaMm: 5,
  recentRainWetMm: 10,
  zondaGust: 50,
  zondaGustVigilancia: 40,
  zondaHumidity: 25,
  zondaHumidityVigilancia: 35,
  zondaTempRise: 8,
  zondaHumidityDrop: 20,
  zondaPressureDrop: 3,
};

function num(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function loadThresholds(env: NodeJS.ProcessEnv = process.env): Thresholds {
  return {
    gustAtencion: num(env, "CLIMA_GUST_ATENCION_KMH", DEFAULT_THRESHOLDS.gustAtencion),
    gustAlerta: num(env, "CLIMA_GUST_ALERTA_KMH", DEFAULT_THRESHOLDS.gustAlerta),
    windAtencion: num(env, "CLIMA_WIND_ATENCION_KMH", DEFAULT_THRESHOLDS.windAtencion),
    windAlerta: num(env, "CLIMA_WIND_ALERTA_KMH", DEFAULT_THRESHOLDS.windAlerta),
    rainAtencionMm: num(env, "CLIMA_RAIN_ATENCION_MM", DEFAULT_THRESHOLDS.rainAtencionMm),
    rainAlertaMm: num(env, "CLIMA_RAIN_ALERTA_MM", DEFAULT_THRESHOLDS.rainAlertaMm),
    rainHourAlertaMm: num(env, "CLIMA_RAIN_HOUR_ALERTA_MM", DEFAULT_THRESHOLDS.rainHourAlertaMm),
    recentRainWetMm: num(env, "CLIMA_RAIN_RECENT_MM", DEFAULT_THRESHOLDS.recentRainWetMm),
    zondaGust: num(env, "CLIMA_ZONDA_GUST_KMH", DEFAULT_THRESHOLDS.zondaGust),
    zondaGustVigilancia: num(env, "CLIMA_ZONDA_GUST_VIGILANCIA_KMH", DEFAULT_THRESHOLDS.zondaGustVigilancia),
    zondaHumidity: num(env, "CLIMA_ZONDA_HUMIDITY_PCT", DEFAULT_THRESHOLDS.zondaHumidity),
    zondaHumidityVigilancia: num(env, "CLIMA_ZONDA_HUMIDITY_VIGILANCIA_PCT", DEFAULT_THRESHOLDS.zondaHumidityVigilancia),
    zondaTempRise: num(env, "CLIMA_ZONDA_TEMP_RISE_C", DEFAULT_THRESHOLDS.zondaTempRise),
    zondaHumidityDrop: num(env, "CLIMA_ZONDA_HUMIDITY_DROP", DEFAULT_THRESHOLDS.zondaHumidityDrop),
    zondaPressureDrop: num(env, "CLIMA_ZONDA_PRESSURE_DROP_HPA", DEFAULT_THRESHOLDS.zondaPressureDrop),
  };
}
