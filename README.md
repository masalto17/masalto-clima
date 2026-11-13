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

De arranque: ráfaga de alerta 65 km/h, viento desde 50 km/h para tener en cuenta, lluvia de 10 mm en alerta y desde 2 mm se anuncia «ojo que hay lluvia». Si los días previos ya sumaron lluvia, el piso del armado pesa en el grado. Se pisan con las `CLIMA_*` de `.env.example`.

No reemplazan el umbral de una estructura: ese CSV sigue vacío.

## Lugares, modo obra y estadísticas

En la home se elige un lugar. Se pueden sumar otros y cargar fecha de armado y de evento. **Modo obra** saca el video para leer al sol. El ranking y el archivo de otros años están en `/estadisticas`.

La lista de lugares queda en el teléfono. Si hay Blob o KV, también se guarda en el servidor (`clima/preferencias.json`).

## Avisos

En `/avisos` se prenden mail, WhatsApp y push. Sin estas variables el interruptor no envía nada:

| Variable | Para qué |
| --- | --- |
| `RESEND_API_KEY` y `RESEND_FROM` | Mail con Resend. |
| `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` | WhatsApp Cloud API. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp por Twilio, si no está la Cloud API. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push del navegador. `VAPID_SUBJECT` es un mail `mailto:alguien@masalto.com.ar`. |

El cron manda solo cuando el nivel sube. Hace falta Blob o KV para que el servidor conozca el destino.

`GET /api/estado` es el JSON para un widget nativo futuro. La web se puede instalar, pero el widget de la pantalla de inicio no sale de esta PWA. El plan está en `PROPUESTA.md`.

## Atribución

Open-Meteo (CC BY 4.0), MET Norway, Servicio Meteorológico Nacional (CC BY 2.5 AR) y METAR de aeropuerto. Donde se muestra un dato del SMN, la pantalla dice «Fuente: SMN».
