# masalto-clima — Contexto para Codex

Centro de riesgo climático por evento (ecosistema MasAlto). Cruza varios modelos de pronóstico con las estructuras y fases de cada evento y avisa qué hacer y con cuánto margen. Sin evento cargado, funciona como pronóstico combinado de los lugares guardados.

- Dueño: Hugo (construye solo, con Codex). Idioma de trabajo: español rioplatense.
- Plan completo: `docs/PLAN.md`. Estado actual: `docs/PROGRESS.md`. **Leer PROGRESS primero; de PLAN leer solo la sección del hito en curso.**

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind) en Vercel. PWA.
- Supabase: Postgres + RLS + Auth + pg_cron + Edge Functions. Migraciones en `supabase/migrations/`.
- Worker Python (xarray) en `workers/wrf/`, programado con GitHub Actions: baja el WRF del SMN (S3 `smn-ar-wrf`, sin credenciales) y guarda solo los puntos de cada predio.
- Datos: Open-Meteo (multimodelo), WRF SMN 4 km, observaciones y alertas SMN.
- Mensajería: bot de Telegram (webhook en `/api/telegram`). Claude (modelo chico) para el chatbot. WhatsApp = Fase 2.
- Paquetes: pnpm. Node 20+.

## Estructura

```
app/            Next.js (UI + rutas API)
lib/            clientes (supabase, open-meteo, telegram), motor de riesgo
supabase/       migraciones, seed, edge functions
workers/wrf/    ingesta Python del WRF
docs/           PLAN.md, PROGRESS.md, refs/ (manuales, CSV de umbrales y backtest)
```

## Comandos

- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test`
- `pnpm db:migrate` (aplica migraciones) · `supabase functions deploy <fn>`
- **Nunca `supabase db push` ni `supabase pull`:** el proyecto Supabase es el de Handy (esquema `clima`) y pisarían su historial de migraciones. `supabase config push` solo después de revisar `supabase config diff`.
- `vercel env pull .env.local`

## Reglas del proyecto

1. **Alcance:** solo lo que está en el Core del hito en curso (`docs/PLAN.md`). Si aparece algo fuera de alcance, frenar y preguntar: "esto no está en el MVP, ¿lo sumamos o va a Fase 2?".
2. **Seguridad (innegociable):**
   - Secretos solo en `.env.local`, Vercel env, `gh secret set` y `supabase secrets set`. Nunca en el código ni en commits.
   - Webhook de Telegram valida `X-Telegram-Bot-Api-Secret-Token`. Chats no vinculados se ignoran (vinculación con código de un solo uso).
   - RLS activado en todas las tablas desde la primera migración.
   - Hacia Handy: firma HMAC.
3. **Motor de riesgo:** para viento usar el peor caso razonable (valor alto del rango entre modelos), no el promedio. Nunca inventar umbrales: vienen de `docs/refs/umbrales_estructuras.csv` con su fuente.
4. **Alertas:** una por estructura y episodio (clave única); reenviar solo si sube el nivel. Formato fijo: nivel, qué, cuándo, acción, margen, confianza.
5. **Salud:** si una fuente no actualiza en 6 h, avisar por Telegram "sistema sin datos, usar SMN".
6. **Atribución:** mostrar "Fuente: SMN" donde se usen datos del SMN (CC BY 2.5 AR).
7. **Marca:** marca primaria `MasAlto`. Escribir `MasAlto` (nunca `MásAlto`, `Mas Alto`, `Masalto`). No crear ni modificar logos: usar solo activos autorizados (skill `masalto-brand-master` si está disponible). El nombre final del producto está pendiente.

## Flujo de trabajo por sesión

1. Leer `docs/PROGRESS.md` y la sección del hito en `docs/PLAN.md`.
2. Para hitos con varias piezas: modo plan primero, mostrar el plan en 10 líneas o menos y esperar el OK.
3. Trabajar en la rama `hito-N-<slug>`. Commits chicos con mensajes en español (`feat:`, `fix:`, `chore:`).
4. Antes de cerrar: `pnpm lint && pnpm typecheck && pnpm test` en verde.
5. Cerrar el hito: actualizar `docs/PROGRESS.md` (hecho, pendiente, decisiones), push, `gh pr create --fill` y merge a `main` cuando Hugo lo apruebe. Vercel despliega la vista previa por PR.
6. Terminar con: "Hito N cerrado. Sugerido: /clear y arrancar el Hito N+1 con el prompt de KICKOFF.md".

## Uso eficiente de tokens

- Buscar con Grep/Glob antes de leer. Leer rangos de archivo, no archivos enteros grandes.
- No volver a leer archivos que no cambiaron en la sesión.
- Búsquedas amplias en el repo → subagente Explore; que devuelva solo conclusiones.
- Salidas largas de comandos: filtrar (`| tail -30`, `--silent`, `--reporter=dot`). No imprimir JSON de APIs completo: una muestra de 1 o 2 elementos.
- Documentación de librerías: usar Context7 (MCP) si está instalado, en lugar de adivinar APIs o buscar en la web.
- Una sesión = un hito (o medio hito). Al cambiar de tema: `/clear`. Si la sesión se alarga: `/compact` con foco en el hito.
- Respuestas cortas: qué se hizo, qué falta, qué necesita Hugo. Sin repetir código ya escrito.

## Skills y herramientas

- `crear-mvp` (Etapa B: construcción guiada), `auditar-mvp` (antes de cada etapa de lanzamiento) y `masalto-brand-master` (cualquier pieza con marca), si están instalados.
- CLIs: `gh`, `supabase`, `vercel`. Usarlos en lugar de pedirle a Hugo que haga clics en paneles.
- MCP recomendados: Context7 (docs), Supabase (consultas y migraciones). Si no están, seguir con los CLIs.
