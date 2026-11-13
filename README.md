# MasAlto Clima

Pronóstico del lugar donde MasAlto arma. Arriba dice si está **todo bien** o si hay que mirar viento, lluvia o Zonda. El detalle de la vuelta de rosca está en [PROPUESTA.md](PROPUESTA.md).

## Correr

```bash
pnpm install
pnpm dev
```

`pnpm lint`, `pnpm typecheck` y `pnpm test` antes de cerrar un cambio.

La página `/` consulta las fuentes en vivo y se cachea 10 minutos. No hace falta Supabase para verla. Si la base está configurada, suma el WRF del SMN que ya carga el worker.

## Fuentes

Sin clave: Open-Meteo (ECMWF, GFS, ICON, GEM, Météo-France), MET Norway, observaciones y alertas del SMN, METAR de SANU y SACO.

Con clave, opcionales:

| Variable | Para qué |
| --- | --- |
| `OPEN_METEO_API_KEY` o `CLIMA_OPEN_METEO_API_KEY` | Plan comercial de Open-Meteo. Sin ella se usa el host gratuito, que no es para uso comercial. |
| `OPENWEATHER_API_KEY` | Pronóstico cada 3 horas. |
| `WEATHERAPI_KEY` | Pronóstico horario, 3 días en el plan gratis. |
| `TOMORROW_API_KEY` | Pronóstico horario. |

El viento de OpenWeather y de Tomorrow.io viene en m/s y acá se pasa a km/h.

## Registro de aciertos

El cron `GET /api/cron/precision` (todos los días a las 12:00 UTC) guarda pronósticos a 1, 3, 6, 12 y 24 horas y los compara con el METAR cuando la hora ya pasó. En Vercel Hobby el cron no puede ser más seguido. En Pro se puede cambiar el schedule de `vercel.json` a `0 * * * *`.

Hace falta un lugar donde guardar el JSON. Alcanza con uno:

| Variable | Dónde |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob. Se escribe `clima/ledger.json` con acceso privado. |
| `KV_REST_API_URL` y `KV_REST_API_TOKEN` | Upstash, el KV del marketplace de Vercel. Se usa solo si no hay Blob. |

Sin esas variables la página sigue funcionando: todas las fuentes pesan igual y el ranking lo aclara. No se crea ninguna tabla en la base de Handy.

En producción el route exige `CRON_SECRET` (header `Authorization: Bearer …`). Vercel Cron lo envía solo cuando esa variable existe. Sin secreto, en producción responde 401 y no escribe.

## Cortes del semáforo

Valores iniciales en `lib/clima/thresholds.ts`. Se pisan con `CLIMA_GUST_ATENCION_KMH`, `CLIMA_GUST_ALERTA_KMH`, `CLIMA_WIND_ALERTA_KMH`, `CLIMA_RAIN_ATENCION_MM`, `CLIMA_RAIN_ALERTA_MM`, `CLIMA_RAIN_HOUR_ALERTA_MM` y las `CLIMA_ZONDA_*` que están comentadas en `.env.example`.

Son cortes operativos para la pantalla. No reemplazan el umbral de una estructura: ese CSV sigue vacío.

## Atribución

Open-Meteo (CC BY 4.0), MET Norway, Servicio Meteorológico Nacional (CC BY 2.5 AR) y METAR de aeropuerto. Donde se muestra un dato del SMN, la pantalla dice «Fuente: SMN».
