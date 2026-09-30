# Pasos para Hugo

## 1. Instalar (Terminal, una sola vez)
brew install node pnpm gh supabase/tap/supabase
npm i -g vercel
claude mcp add context7 -- npx -y @upstash/context7-mcp

## 2. Iniciar sesión (una sola vez)
gh auth login
supabase login
vercel login

## 3. Crear el bot de Telegram
Telegram → @BotFather → /newbot → guardar el token (no pegarlo en ningún chat).

## 4. Abrir Claude Code en esta carpeta
cd ~/Developer/masalto-clima-kickoff
claude

## 5. Pegar este prompt
Leé CLAUDE.md, docs/PROGRESS.md y de docs/PLAN.md solo "Hito 0". Ejecutá el Hito 0 completo siguiendo el Paso 3 de KICKOFF.md. Primero verificá herramientas y logins, después mostrame el plan en 10 líneas o menos y esperá mi OK.

## 6. Durante el Hito 0
- Aprobar el plan.
- Cuando te pida un secreto: pegarlo en .env.local y responder "listo".
- Al final: revisar el PR y responder "merge".

## 7. Cada hito siguiente
/clear → pegar el prompt del Paso 4 de KICKOFF.md cambiando N.

## 8. Antes del Hito 2
Completar docs/refs/backtest_eventos.csv (3 a 5 eventos o días de Zonda).

## 9. Antes del Hito 3
Completar docs/refs/umbrales_estructuras.csv (umbral de viento por estructura y su fuente).
