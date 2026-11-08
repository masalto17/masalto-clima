# PROGRESS — masalto-clima

Actualizar al cerrar cada sesión. Máximo 40 líneas: lo viejo se resume.

## Estado

- Hito en curso: **Hito 1b — Frases e ingreso sin mail** (mergeado). Hito 1 mergeado; falta la prueba de Hugo en producción.
- Último cambio: 2026-11-08
- Rama activa: `main`

## Hecho

- Hito 0 (mergeado): scaffold, CI, esquema base con RLS, bot con vinculación por código, `/vincular`, producción en https://masalto-clima.vercel.app (`@MasAlto_Clima_Bot`).
- Migración `0002_forecasts.sql` (aplicada en `handy`): `forecasts` particionada por mes (retención 90 días), vista `forecasts_latest`, `places` con `is_saved_place`/`smn_station`/`notes`, `system_health.alerted_at`, pg_cron + pg_net, 3 lugares: San Juan Ciudad, Estadio San Juan del Bicentenario, Córdoba Villa Allende.
- Datos: Open-Meteo (5 modelos, Edge Function `clima-ingest-open-meteo`, cada hora) y WRF SMN 4 km (`workers/wrf`, GitHub Actions cada 3 h, 72 h). Combinado por día en `lib/forecast/combine`: mediana en temperatura y lluvia; viento y ráfaga = el más alto.
- Web `/` (ingreso por mail o `/web`, `ALLOWED_EMAILS`), "actualizado hace X", aviso de fuente caída, atribución SMN. Bot: `/semana [lugar]`, `/web` y preguntas por reglas (hoy, mañana, pasado; viento, lluvia, temperatura).
- Hito 1b: web en tarjetas con frases (estado + hoy + mañana + semana plegada, lo más urgente arriba); bot en frases; `/web` manda link de un solo uso (10 min) → `/entrar` → botón "Entrar" abre sesión sin mail (migración `0003_web_login.sql`, aplicada).
- Latido: Edge Function `clima-health-check` cada 30 min; fuente sin actualizar en 6 h → Telegram "Sistema sin datos, usar SMN" (un aviso por caída y uno al volver). Probado de punta a punta con una fuente de prueba.

## Disponibilidad de fuentes (verificado 2026-09-30)

- **Alertas SMN: sí.** Índice en `https://ssl.smn.gob.ar/CAP/AR.php` con links a XML CAP (evento, severidad, inicio, fin, polígono). Sin clave. La API `ws1.smn.gob.ar` pide token (401): no usarla.
- **Observaciones: sí, horarias.** `https://ssl.smn.gob.ar/dpd/descarga_opendata.php?file=observaciones/tiepre<AAAAMMDD>.txt` (último dato por estación; incluye San Juan, Córdoba, Mendoza, Jáchal). Trae viento medio, **no ráfagas**. `ws.smn.gob.ar` responde 503.
- **Histórico WRF: sí.** Bucket `smn-ar-wrf` desde 2022, 4 corridas por día, horario a 72 h (~34 MB por hora, 2,5 GB por corrida). **No trae ráfagas** (solo viento a 10 m): para ráfagas el WRF no suma al peor caso.

## Pendiente / bloqueos

- Hugo: probar en producción después del merge (`/semana` en el bot y la web con su mail). `wrf.yml` recién corre programado cuando está en `main`.
- Plan gratuito de Open-Meteo es no comercial: contratar el plan y cargar `CLIMA_OPEN_METEO_API_KEY` antes de uso comercial.
- ¿Handy acepta webhook? · Umbrales por estructura (`umbrales_estructuras.csv`) · Eventos para el backtest (`backtest_eventos.csv`).

## Decisiones

- 2026-09-30: Hugo quiere app simple en lenguaje natural. Suma al MVP: frases en lugar de tablas, ingreso sin mail desde el bot (Hito 1b) y elegir qué seguir (Hito 3). Push en app y web → Fase 2. Vocabulario de viento: escala de Beaufort (OMM), no es umbral de riesgo.

- 2026-09-30: clima vive en el esquema `clima` del proyecto Supabase `handy`. **Nunca `supabase db push` ni `supabase pull`**; migraciones con `pnpm db:migrate`.
- 2026-09-30: Edge Functions y secretos con prefijo `clima-`/`CLIMA_` (proyecto compartido). Se publican sin JWT y validan `x-clima-cron-secret` (Vault + secreto de función).
- 2026-09-30: Open-Meteo no informa la corrida por modelo → `run_time` = franja de 6 h UTC de la consulta (unas 10.000 filas por día con 3 lugares).
- 2026-09-30: `observations` y alertas de zona en pantalla quedan para los hitos que las usan (2 a 4); en el Hito 1 solo se verificó disponibilidad.
- 2026-09-30: un modelo sin corrida en 24 h sale del combinado; WRF en error si su última corrida tiene más de 12 h.
