# PROGRESS — masalto-clima

Actualizar al cerrar cada sesión. Máximo 40 líneas: lo viejo se resume.

## Estado

- Hito en curso: **Hito 1 — Datos + vista general** (Hito 0 cerrado y mergeado el 2026-09-30)
- Último cambio: 2026-09-30
- Rama activa: — (próxima: `hito-1-<slug>`)

## Hecho

- Scaffold Next.js 15 + Tailwind + pnpm; vitest; CI (lint + typecheck + test).
- Repo privado `masalto17/masalto-clima`; proyecto Vercel `masalto-clima` conectado al repo.
- Migración `0001_clima_base.sql`: `organizations`, `profiles`, `places`, `channels`, `channel_link_codes`, `system_health`, RLS en todas.
- Bot: `/api/telegram` (valida token secreto), `/start` → link a `/vincular` (código de un solo uso, 10 min), chat vinculado recibe "hola, <nombre>", no vinculado se ignora.
- `/vincular`: ingreso por link al mail (Supabase Auth), solo mails de `ALLOWED_EMAILS`.
- Aplicado en `handy`: migración, esquema `clima` expuesto en la API, URLs de redirección de Auth.
- Producción en https://masalto-clima.vercel.app; bot `@MasAlto_Clima_Bot` con webhook y secreto.
- "Listo cuando" verificado: chat vinculado recibe "hola, Hugo", no vinculado se ignora, la URL carga.

## Pendiente / bloqueos

- Deploy a producción: lo corre Hugo (`vercel deploy --prod --yes`) o sale con el merge a `main`; Claude no tiene permiso.
- ¿Handy acepta webhook? (define si las alertas a Handy entran al Core).
- Umbrales de viento por estructura → `docs/refs/umbrales_estructuras.csv`.
- Eventos y días de Zonda para el backtest → `docs/refs/backtest_eventos.csv`.

## Decisiones

- 2026-09-30: stack Next.js + Supabase + Vercel; Telegram primero, WhatsApp en Fase 2; marca primaria MasAlto (nombre final pendiente).
- 2026-09-30: plan gratuito de Supabase lleno (2 proyectos) → clima vive en el esquema `clima` del proyecto `handy` (ref `ootloeyokctgqonxqwon`). Comparte Auth, cuota y claves con Handy.
- 2026-09-30: **nunca correr `supabase db push` ni `supabase pull` desde este repo**: pisarían el historial de Handy. `supabase config push` solo tras revisar `supabase config diff`. Migraciones con `pnpm db:migrate` (registro en `clima.schema_migrations`).
- 2026-09-30: acceso a `/vincular` por lista de mails (`ALLOWED_EMAILS`); el primer ingreso crea el perfil en la organización inicial "MasAlto".
