// Sin imports de Node ni alias `@/`: este archivo también lo usan las Edge Functions (Deno).

/** Una fuente que no actualiza en 6 h se da por caída. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export type SourceHealth = {
  source: string;
  last_ok_at: string | null;
  alerted_at: string | null;
};

export type HealthAction = {
  source: string;
  kind: "down" | "recovered";
  message: string;
};

const SOURCE_LABELS: Record<string, string> = {
  "open-meteo": "Open-Meteo",
  "smn-wrf": "WRF SMN",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function isStale(lastOkAt: string | null, now: Date): boolean {
  if (lastOkAt === null) return true;
  const then = new Date(lastOkAt).getTime();
  // Fecha inválida = no hay latido usable: se trata como caída.
  if (Number.isNaN(then)) return true;
  return now.getTime() - then > STALE_AFTER_MS;
}

/**
 * Decide qué avisar: un aviso cuando la fuente se cae (`alerted_at` vacío)
 * y uno cuando vuelve. Mientras siga caída y ya avisada, no repite.
 */
export function evaluateHealth(sources: SourceHealth[], now: Date): HealthAction[] {
  const actions: HealthAction[] = [];
  for (const { source, last_ok_at, alerted_at } of sources) {
    const stale = isStale(last_ok_at, now);
    if (stale && !alerted_at) {
      actions.push({
        source,
        kind: "down",
        message: `Sistema sin datos, usar SMN. Fuente sin actualizar hace más de 6 h: ${sourceLabel(source)}.`,
      });
    } else if (!stale && alerted_at) {
      actions.push({
        source,
        kind: "recovered",
        message: `Fuente recuperada: ${sourceLabel(source)}. El sistema vuelve a tener datos.`,
      });
    }
  }
  return actions;
}
