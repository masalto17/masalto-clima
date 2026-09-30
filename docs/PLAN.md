# PLAN — masalto-clima (MVP)

Versión condensada de la Propuesta MVP (30/09/2026). Leer solo la sección del hito en curso.

## 1. Hipótesis y métricas

- **Hipótesis:** con datos públicos (sin sensor propio) el sistema avisa viento peligroso y Zonda con 3 h o más de margen, sin saturar de falsas alarmas.
- **Control 1 (Hito 2, backtest):** en 3 a 5 eventos o días de Zonda pasados, habría avisado con 3 h o más de margen en la mayoría.
- **Control 2 (piloto de 8 semanas):** cero vientos fuertes sin aviso y como máximo 1 falsa alarma Crítica por mes.
- **Métricas en la bitácora:** margen real, falsas alarmas, avisos faltantes (botón "no avisó"), tiempo de respuesta a alertas, consultas al bot.

## 2. Alcance

**Core**

- Vista general sin evento: lugares guardados, pronóstico combinado a 7 días, alertas de zona (SMN y Zonda).
- Alta de evento: predio en mapa, fases (armado, show, desarme) con horario, público estimado.
- Catálogo de estructuras con umbral de ráfaga por estado (con o sin lonas), acción de mitigación y horas que lleva hacerla.
- Motor multimodelo (Open-Meteo + WRF SMN) con consenso y dispersión.
- Semáforo por hora: Informa, Atención, Acción, Crítico.
- Detector de Zonda por reglas.
- Horarios sugeridos para el armado (sensación térmica, UV, lluvia, viento).
- Bot de Telegram: alertas, resumen diario y preguntas rápidas (con o sin evento).
- Alertas Críticas a Handy (si Handy acepta webhook; si no, Fase 2).
- Bitácora de alertas y decisiones. Backtest. Verificación diaria y ranking de modelos (versión simple).

**Fase 2:** WhatsApp, rosa de vientos y orientación de escenario (StagePlot/Layout), anemómetro, integración con ACCRED, PDF de respaldo, radar y tormentas eléctricas.

**Descartado:** modelo o ML propio, app nativa, app de clima masiva.

## 3. Modelo de datos (tablas)

`organizations`, `profiles` (rol: admin, jefe_armado, lectura), `places` (predio o lugar guardado: lat, lon, altitud, estación SMN más cercana, notas, `is_saved_place`), `events`, `event_phases` (tipo, inicio, fin), `structures` (catálogo: tipo, umbral_con_lonas_kmh, umbral_sin_lonas_kmh, acción, horas_mitigación, fuente_umbral), `event_structures` (estructura, fases, estado), `forecasts` (fuente, modelo, corrida, place_id, hora_valida, variables; particionada por mes, retención de 90 días de corridas completas), `observations` (estación, hora, variables), `model_scores` (modelo, variable, zona, horizonte, error medio), `alerts` (evento o lugar, estructura, nivel, hora_impacto, margen, mensaje, estado, clave_episodio única), `decisions` (alerta, acción, usuario, hora), `channels` (usuario, telegram_chat_id, handy_id, código de vinculación), `system_health` (fuente, última actualización).

RLS por organización en todas las tablas.

## 4. Motor de riesgo (pg_cron cada 15 min → Edge Function)

1. Combinar modelos ponderando por su puntaje reciente (zona y variable). Dispersión = confianza.
2. Viento: tomar el valor alto del rango.
3. Nivel = ráfaga esperada contra el umbral de cada estructura armada en esa hora. Cortes iniciales como % del umbral, a calibrar en el backtest.
4. Margen = hora de impacto − horas de mitigación. Margen chico → sube el nivel.
5. Deduplicar por episodio. Crítico → Handy + Telegram; el resto, al resumen diario.
6. Lugares guardados sin evento: sin semáforo por estructura; solo alertas SMN, Zonda y umbrales genéricos.

**Zonda:** reglas sobre la diferencia de presión entre Chile central y Cuyo, caída de humedad, suba de temperatura, viento del oeste en el WRF, cruzadas con la alerta del SMN. Los valores se ajustan con episodios pasados; no se fijan de antemano.

## 5. Hitos

### Hito 0 — Setup
- Next.js + Tailwind + pnpm, repo privado `masalto17/masalto-clima` en GitHub, CI (lint + typecheck) en GitHub Actions.
- Supabase vinculado; primera migración con `organizations`, `profiles`, `places`, `channels`, `system_health` y RLS.
- Vercel vinculado con variables de entorno.
- Bot de Telegram: webhook con token secreto, `/start` genera la vinculación con código de un solo uso, ignora chats no vinculados.
- **Listo cuando:** el bot responde "hola, Hugo" a un chat vinculado, ignora a uno no vinculado y la URL de Vercel carga.

### Hito 1 — Datos + vista general
- Cliente de Open-Meteo (varios modelos) y worker del WRF para 3 lugares reales.
- Tabla `forecasts` poblada; control de latido en `system_health`.
- Vista general: lugares guardados, pronóstico combinado a 7 días, "actualizado hace X min".
- Bot: `/semana` y preguntas simples sobre un lugar guardado.
- Confirmar disponibilidad real de: alertas SMN, observaciones en tiempo real, histórico del WRF. Anotar resultado en PROGRESS.
- **Listo cuando:** Hugo ve la semana de San Juan en la web y en el bot, y el latido avisa si una fuente se cae.

### Hito 2 — Backtest
- Input: `docs/refs/backtest_eventos.csv`.
- Reconstruir pronósticos de esas fechas (Historical Forecast API de Open-Meteo o histórico del WRF) contra lo observado.
- Informe en `docs/backtest.md`: margen que habría tenido cada aviso.
- **Control 1.** Si falla, revisar fuentes y reglas antes de seguir.

### Hito 3 — Eventos y semáforo
- Alta de evento, fases, catálogo de estructuras (cargado desde `docs/refs/umbrales_estructuras.csv`), semáforo por hora.
- **Listo cuando:** un evento real muestra el semáforo correcto para cada estructura en cada fase.

### Hito 4 — Alertas
- Alertas por Telegram con formato fijo y botones Hecho/Ignorar, resumen diario, horarios sugeridos, bitácora, botón "no avisó".
- **Listo para mostrar.** Arranca el piloto interno.

### Hito 5 — Inteligencia
- Chatbot con Claude (acceso solo de lectura a los datos del usuario, límite de consultas), verificación diaria y ranking de modelos, webhook a Handy.

### Etapas siguientes
- Cercanos: nombre y marca final, varias organizaciones, anemómetro, WhatsApp, política de privacidad (Ley 25.326), descargo legal.
- Pública: sección de apps de masalto.com.ar, términos revisados por abogado, plan de Open-Meteo según volumen, tope gratuito por organización.

## 6. Costos y licencias

- Open-Meteo gratis solo para uso no comercial: sirve para desarrollo. Contratar el plan Standard antes del piloto; Professional un mes si se usa su Historical Forecast API para el backtest.
- WRF SMN: gratis, CC BY 2.5 AR (atribuir).
- Telegram: gratis. Claude: centavos por mes con uso interno.
