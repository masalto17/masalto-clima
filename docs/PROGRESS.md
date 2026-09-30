# PROGRESS — masalto-clima

Actualizar al cerrar cada sesión. Máximo 40 líneas: lo viejo se resume.

## Estado

- Hito en curso: **Hito 0 — Setup** (código listo; falta aplicar en Supabase, token de Telegram y deploy)
- Último cambio: 2026-09-30
- Rama activa: `hito-0-setup`

## Hecho

- Scaffold Next.js 15 + Tailwind + pnpm; vitest; CI (lint + typecheck + test).
- Repo privado `masalto17/masalto-clima`; proyecto Vercel `masalto-clima` conectado al repo.
- Migración `0001_clima_base.sql`: `organizations`, `profiles`, `places`, `channels`, `channel_link_codes`, `system_health`, RLS en todas.
- Bot: `/api/telegram` (valida token secreto), `/start` → link a `/vincular` (código de un solo uso, 10 min), chat vinculado recibe "hola, <nombre>", no vinculado se ignora.
- `/vincular`: ingreso por link al mail (Supabase Auth), solo mails de `ALLOWED_EMAILS`.

## Pendiente / bloqueos

- OK de Hugo para tocar el proyecto `handy`: aplicar migración, exponer esquema `clima` en la API, sumar URL de redirección de Auth.
- Token del bot de Telegram (Hugo lo crea con @BotFather) → `.env.local`.
- Variables en Vercel, deploy a producción, `setWebhook`, verificar "Listo cuando".
- ¿Handy acepta webhook? (define si las alertas a Handy entran al Core).
- Umbrales de viento por estructura → `docs/refs/umbrales_estructuras.csv`.
- Eventos y días de Zonda para el backtest → `docs/refs/backtest_eventos.csv`.

## Decisiones

- 2026-09-30: stack Next.js + Supabase + Vercel; Telegram primero, WhatsApp en Fase 2; marca primaria MasAlto (nombre final pendiente).
- 2026-09-30: plan gratuito de Supabase lleno (2 proyectos) → clima vive en el esquema `clima` del proyecto `handy` (ref `ootloeyokctgqonxqwon`). Comparte Auth, cuota y claves con Handy.
- 2026-09-30: **nunca correr `supabase db push` ni `supabase config push` desde este repo**: pisarían el historial y la configuración de Handy. Migraciones con `pnpm db:migrate` (registro en `clima.schema_migrations`).
- 2026-09-30: acceso a `/vincular` por lista de mails (`ALLOWED_EMAILS`); el primer ingreso crea el perfil en la organización inicial "MasAlto".
