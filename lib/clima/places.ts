export type PublicPlace = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  timezone: string;
  /** El detector propio de Zonda corre en Cuyo. Una alerta oficial del SMN se muestra igual. */
  zonda: boolean;
  smnStation: string;
  metar: string;
};

/**
 * Los tres lugares guardados de MasAlto. Mismas coordenadas que la migración
 * `0002_forecasts.sql`. La página pública no depende de Supabase para listarlos.
 */
export const PUBLIC_PLACES: PublicPlace[] = [
  {
    id: "estadio-san-juan",
    name: "Estadio San Juan del Bicentenario",
    region: "San Juan",
    lat: -31.61195,
    lon: -68.52818,
    timezone: "America/Argentina/San_Juan",
    zonda: true,
    smnStation: "San Juan",
    metar: "SANU",
  },
  {
    id: "san-juan-ciudad",
    name: "San Juan Ciudad",
    region: "San Juan",
    lat: -31.5375,
    lon: -68.5364,
    timezone: "America/Argentina/San_Juan",
    zonda: true,
    smnStation: "San Juan",
    metar: "SANU",
  },
  {
    id: "villa-allende",
    name: "Córdoba Villa Allende",
    region: "Córdoba",
    lat: -31.29362,
    lon: -64.29762,
    timezone: "America/Argentina/Cordoba",
    zonda: false,
    smnStation: "Córdoba",
    metar: "SACO",
  },
];
