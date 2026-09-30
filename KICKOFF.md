# Arranque de masalto-clima con Claude Code

Guía para Hugo. Tiempo total del Paso 1 al 3: unos 30 minutos, casi todo automático.

## Qué hay en este paquete

| Archivo | Para qué sirve |
| --- | --- |
| `CLAUDE.md` | Memoria del proyecto. Claude Code lo lee solo en cada sesión: stack, reglas, flujo y ahorro de tokens. |
| `docs/PLAN.md` | Plan del MVP condensado, con criterio de "listo" por hito. |
| `docs/PROGRESS.md` | Estado entre sesiones. Evita volver a explicar todo cada vez. |
| `docs/refs/umbrales_estructuras.csv` | Plantilla vacía: la completás vos antes del Hito 3. |
| `docs/refs/backtest_eventos.csv` | Plantilla vacía: la completás vos antes del Hito 2. |
| `.env.example` | Lista de variables secretas (sin valores). |

## Paso 1 — Preparación única (manual, unos 15 min)

Esto no se puede automatizar porque requiere tu login o tu teléfono.

1. **Herramientas.** En la Terminal de la Mac:
   ```bash
   brew install node pnpm gh supabase/tap/supabase
   npm i -g vercel
   ```
   Si preferís, abrí Claude Code y pedile: "verificá e instalá node, pnpm, gh, supabase CLI y vercel CLI".
2. **Logins** (cada uno abre el navegador):
   ```bash
   gh auth login
   supabase login
   vercel login
   ```
3. **Bot de Telegram.** En Telegram, abrí @BotFather, mandá `/newbot` y elegí un nombre y un usuario que termine en `bot`. Guardá el token: lo vas a pegar en `.env.local` cuando Claude Code te lo pida. Nunca lo pegues en el chat.
4. **Documentación de librerías (opcional, recomendado).** Esto evita que Claude Code adivine APIs y gaste tokens corrigiéndose:
   ```bash
   claude mcp add context7 -- npx -y @upstash/context7-mcp
   ```
   Para el servidor MCP de Supabase, pedile a Claude Code que lo configure siguiendo la documentación oficial de Supabase. Si algo falla, no es bloqueante: el CLI alcanza.

## Paso 2 — Carpeta del proyecto

```bash
mkdir -p ~/Proyectos/masalto-clima
```

Copiá ahí el contenido de este paquete (`CLAUDE.md`, `docs/`, `.env.example`). Después:

```bash
cd ~/Proyectos/masalto-clima
claude
```

## Paso 3 — Prompt del Hito 0 (copiar y pegar tal cual)

```
Leé CLAUDE.md y docs/PROGRESS.md, y de docs/PLAN.md solo la sección "Hito 0". Vamos a ejecutar el Hito 0 completo, automatizado.

Antes de tocar nada, verificá que estén instalados y logueados node >= 20, pnpm, gh, supabase y vercel (gh auth status, supabase projects list, vercel whoami). Si falta algo, dame el comando exacto y esperá.

Después, en modo plan, mostrame el plan en 10 líneas o menos y esperá mi OK. Pasos esperados:
1. Scaffold de Next.js 15 (TypeScript, Tailwind, App Router, pnpm) en esta carpeta, sin pisar CLAUDE.md, docs/ ni .env.example. .gitignore con .env*.local.
2. git init, primer commit y gh repo create masalto17/masalto-clima --private --source=. --push.
3. CI en .github/workflows/ci.yml: lint + typecheck en cada PR.
4. Supabase: crear el proyecto masalto-clima en región São Paulo (sa-east-1) con el CLI; si no se puede, dame el paso exacto. Después supabase init, supabase link, migración inicial (organizations, profiles, places, channels, system_health) con RLS en todas las tablas y supabase db push.
5. Vercel: vercel link, proyecto conectado al repo de GitHub, variables de entorno cargadas.
6. Bot de Telegram: ruta /api/telegram que valida X-Telegram-Bot-Api-Secret-Token; /start devuelve un link a /vincular con código de un solo uso válido 10 minutos; chats no vinculados se ignoran; un chat vinculado recibe "hola, <nombre>". Registrar el webhook con setWebhook y secret_token.
7. Secretos: no me los pidas por chat. Creá .env.local desde .env.example, decime qué variable completar y esperá mi "listo". Para Vercel y GitHub usá vercel env add y gh secret set leyendo desde .env.local.
8. Verificá el "Listo cuando" del Hito 0, actualizá docs/PROGRESS.md, commit, push y abrí el PR con gh pr create --fill. Esperá mi OK para el merge.
```

## Paso 4 — Prompt para cada hito siguiente

Antes de cada hito: `/clear` (sesión limpia = menos tokens). Reemplazá N y el nombre:

```
Leé docs/PROGRESS.md y de docs/PLAN.md solo la sección "Hito N". Creá la rama hito-N-<slug>. En modo plan, mostrame el plan en 10 líneas o menos y esperá mi OK. Después construí, probá (lint, typecheck, test), verificá el "Listo cuando", actualizá PROGRESS.md, hacé commit y push y abrí el PR. Seguí las reglas de CLAUDE.md. Si algo queda fuera de alcance, preguntá antes de hacerlo.
```

## Qué adjuntar y cuándo

| Antes de | Qué | Dónde | Nota |
| --- | --- | --- | --- |
| Hito 2 | 3 a 5 eventos o días de Zonda pasados: fecha, lugar, qué pasó y a qué hora | `docs/refs/backtest_eventos.csv` | Con fecha y hora aproximada alcanza; la ubicación puede ser un link de Google Maps |
| Hito 3 | Umbrales de viento que usás hoy por estructura y su origen | `docs/refs/umbrales_estructuras.csv` | Si solo tenés manuales en PDF, guardá únicamente las páginas de la tabla de viento en `docs/refs/`: un PDF entero consume muchos tokens |
| Hito 5 | URL y forma de recibir mensajes de Handy | Decíselo a Claude Code en el prompt | Si Handy todavía no tiene webhook, Claude Code lo agrega en el repo de Handy en otra sesión |
| Etapa cercanos | Logos autorizados de MasAlto | `public/brand/` | Solo archivos con estado AUTORIZADO en masalto-brand-master |

## Respaldo y automatización

- **GitHub:** cada hito en su rama y con su PR; `main` siempre funciona. Todo el código, los planes y el progreso quedan en el repo privado.
- **CI:** GitHub Actions corre lint y typecheck en cada PR.
- **Deploy:** Vercel publica una vista previa por PR y producción al hacer merge a `main`.
- **Base de datos:** las migraciones viven en el repo (`supabase/migrations/`); nada se cambia a mano en el panel.
- **Secretos:** solo en `.env.local` (local), Vercel, GitHub Secrets y Supabase Secrets.

## Ahorro de tokens (lo que hacés vos)

- Una sesión por hito. `/clear` al terminar; `/compact` si la sesión se alarga.
- `/model`: un modelo más chico para construir tareas claras y el más potente para planificar hitos complejos o depurar algo difícil.
- No pegues logs enteros: las últimas 30 líneas o el error.
- Si Claude Code se va de alcance, cortalo con: "fuera de alcance, anotalo en PROGRESS como Fase 2".
