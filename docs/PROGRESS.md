# PROGRESS — masalto-clima

Actualizar al cerrar cada sesión. Máximo 40 líneas: lo viejo se resume.

## Estado

- Hito en curso: **Hito 2 — Backtest**, diagnóstico y vista horaria de prueba; todavía sin medir aciertos. PR #7 en borrador, con página pública propuesta.
- Última revisión: 2026-11-11. Rama: `hito-2-backtest`, basada en `origin/main` (`6618364`, PR #5).
- Producción READY y página pública HTTP 200; falta probar la sesión de Hugo en su celular. Demo ficticia sólo en vista previa, comprobada a 390 px.

## Hecho

- Hito 0 (mergeado): scaffold, CI, esquema base con RLS, bot con vinculación por código, `/vincular`, producción en https://masalto-clima.vercel.app (`@MasAlto_Clima_Bot`).
- Migración `0002_forecasts.sql` (aplicada en `handy`): `forecasts` particionada por mes (retención 90 días), vista `forecasts_latest`, `places` con `is_saved_place`/`smn_station`/`notes`, `system_health.alerted_at`, pg_cron + pg_net, 3 lugares: San Juan Ciudad, Estadio San Juan del Bicentenario, Córdoba Villa Allende.
- Datos: Open-Meteo (5 modelos, Edge Function `clima-ingest-open-meteo`, cada hora) y WRF SMN 4 km (`workers/wrf`, GitHub Actions cada 3 h, 72 h). Combinado por día en `lib/forecast/combine`: mediana en temperatura y lluvia; viento y ráfaga = el más alto.
- Producción: web `/` con ingreso por mail o `/web`; rama del PR: lectura pública sin ingreso, restringida en servidor a lugares guardados de MasAlto y actualizada cada 5 min. Bot: `/semana [lugar]`, `/web` y preguntas por reglas.
- Hito 1b: web en tarjetas con frases (estado + hoy + mañana + semana plegada, lo más urgente arriba); bot en frases; `/web` manda link de un solo uso (10 min) → `/entrar` → botón "Entrar" abre sesión sin mail (migración `0003_web_login.sql`, aplicada).
- Latido: Edge Function `clima-health-check` cada 30 min; fuente sin actualizar en 6 h → Telegram "Sistema sin datos, usar SMN" (un aviso por caída y uno al volver). Probado de punta a punta con una fuente de prueba.

## Disponibilidad de fuentes (verificado 2026-09-30)

- **Alertas SMN: sí.** Índice en `https://ssl.smn.gob.ar/CAP/AR.php` con links a XML CAP (evento, severidad, inicio, fin, polígono). Sin clave. La API `ws1.smn.gob.ar` pide token (401): no usarla.
- **Observaciones: sí, horarias.** `https://ssl.smn.gob.ar/dpd/descarga_opendata.php?file=observaciones/tiepre<AAAAMMDD>.txt` (último dato por estación; incluye San Juan, Córdoba, Mendoza, Jáchal). Trae viento medio, **no ráfagas**. `ws.smn.gob.ar` responde 503.
- **Histórico WRF: sí.** Bucket `smn-ar-wrf` desde 2022, 4 corridas por día, horario a 72 h (~34 MB por hora, 2,5 GB por corrida). **No trae ráfagas** (solo viento a 10 m): para ráfagas el WRF no suma al peor caso.

## Pendiente / bloqueos

- Estadio: hay versiones guardadas a 24 y 48 h para las 168 horas previas al 11/11. Primer contraste con 120 horas de viento medido en SANU (a 11,3 km) en cinco días; error y límites en `docs/backtest.md`, observaciones en `docs/refs/`. La rama muestra detalle horario de mañana y excluye fuentes con más de 6 h sin actualizar.
- La rama incorpora lectura CAP del SMN para lugares guardados: punto contra polígono/círculo, vigencia, actualización/cancelación y fuente original. Consulta acotada a 16 XML por visita y 2 simultáneos por respuestas 429 del SMN; si hay documentos sin revisar, la web indica cobertura parcial y remite al SMN. No usarla como garantía de ausencia de alertas ni para avisos automáticos hasta resolver la cobertura.
- WRF llevaba 8 h 14 min sin actualizar a las 21:12 UTC del 11/11; aviso registrado a las 19:00 UTC. Se recuperó a las 21:35 UTC con la corrida de las 18:00 UTC. Vigilar intervalos largos entre ejecuciones.
- Plan gratuito de Open-Meteo es no comercial: contratar el plan y cargar `CLIMA_OPEN_METEO_API_KEY` antes de uso comercial.
- Confirmar inicio y fin de los episodios y obtener observaciones del predio, lluvia y Zonda. Sin bitácora de alertas no se pueden medir avisos reales ni falsas alarmas. Falta probar la nueva página pública en celular, completar cobertura CAP y desarrollar detector Zonda.
## Decisiones
- 2026-11-11: prioridad Fiesta del Sol: avisos meteorológicos por lugar y hora para organizar personal y asegurar materiales sueltos. Umbrales de estructuras no bloquean esta etapa. Futuro: varios eventos con ubicación, calendario y avisos separados. Medir antes de ajustar la combinación; usar `ingested_at` para anticipación real.
- 2026-11-11: Hugo pidió una página pública de solo lectura, accesible con el enlace y sin mail/Telegram. Los mensajes pueden resolverse luego con una automatización externa; se pospone integrar WhatsApp y no hubo envíos ni contratación.
- 2026-09-30: Hugo quiere app simple en lenguaje natural. Suma al MVP: frases en lugar de tablas, ingreso sin mail desde el bot (Hito 1b) y elegir qué seguir (Hito 3). Push en app y web → Fase 2. Vocabulario de viento: escala de Beaufort (OMM), no es umbral de riesgo.
- 2026-09-30: clima vive en el esquema `clima` del proyecto Supabase `handy`. **Nunca `supabase db push` ni `supabase pull`**; migraciones con `pnpm db:migrate`.
- 2026-09-30: Edge Functions y secretos usan prefijo `clima-`/`CLIMA_` y validan `x-clima-cron-secret`; Open-Meteo no informa corrida por modelo → `run_time` = franja de 6 h UTC.
- 2026-09-30: `observations` y alertas de zona en pantalla quedan para los hitos que las usan (2 a 4); en el Hito 1 solo se verificó disponibilidad.
- 2026-09-30: un modelo sin corrida en 24 h sale del combinado; WRF en error si su última corrida tiene más de 12 h.
