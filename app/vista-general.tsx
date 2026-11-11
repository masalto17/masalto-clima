import { localDateParts, type DaySummary } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import { dayPhrase, dayStatus, directionName, type DayStatus, type Tone } from "@/lib/forecast/phrases";
import { rainWindows, type HourlySummary } from "@/lib/forecast/hourly";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { isStale, sourceLabel } from "@/lib/health/check";
import { salir } from "./actions";

export function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-end justify-between gap-4 border-b-2 border-brand pb-3">
        <h1 className="text-2xl font-bold">MasAlto Clima</h1>
        {email && (
          <form action={salir} className="text-right text-sm">
            <span className="hidden opacity-70 sm:inline">{email} · </span>
            <button type="submit" className="underline">
              Salir
            </button>
          </form>
        )}
      </header>
      {children}
    </main>
  );
}

const TONE_ORDER: Record<Tone, number> = { warning: 0, info: 1, calm: 2 };

const TONE_CLASS: Record<Tone, string> = {
  calm: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  info: "bg-amber-500/15 text-amber-900 dark:text-amber-300",
  warning: "bg-red-600/15 text-red-800 dark:text-red-300",
};

function Estado({ status }: { status: DayStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${TONE_CLASS[status.tone]}`}
    >
      {status.label}
    </span>
  );
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function rangoRafaga(day: DaySummary): string | null {
  if (day.gustMax === null || day.gustLow === null) return null;
  const low = Math.round(day.gustLow);
  const high = Math.round(day.gustMax);
  return low === high ? null : `Ráfagas según cada modelo: de ${low} a ${high} km/h.`;
}

type Tarjeta = PlaceForecast & { hoy?: DaySummary; manana?: DaySummary };

function range(low: number | null, high: number | null, unit: string): string {
  if (low === null || high === null) return "sin dato";
  const a = Math.round(low);
  const b = Math.round(high);
  return `${a === b ? a : `${a}–${b}`} ${unit}`;
}

function HorasDeManana({ hours }: { hours: HourlySummary[] }) {
  if (hours.length === 0) return <p className="text-sm">Sin pronóstico horario para mañana.</p>;
  const withWind = hours.filter((hour) => hour.windHigh !== null);
  const peak = withWind.sort((a, b) => (b.windHigh ?? 0) - (a.windHigh ?? 0))[0];
  const windows = rainWindows(hours);
  const hasRainData = hours.some((hour) => hour.rainDataModels > 0);
  return (
    <div className="rounded-lg bg-foreground/5 p-3 text-sm">
      <p className="font-semibold">Mañana, por hora</p>
      {peak && (
        <p>
          Mayor viento previsto: {peak.hour}–{peak.hour + 1} h, {range(peak.windLow, peak.windHigh, "km/h")}.
          {peak.windDirection !== null && ` Dirección del modelo más intenso: ${directionName(peak.windDirection)}.`}
          {peak.gustHigh !== null && ` Ráfagas: ${range(peak.gustLow, peak.gustHigh, "km/h")}.`}
        </p>
      )}
      <p>
        {windows.length > 0
          ? `Algún modelo indica lluvia: ${windows.map((window) => `${window.start}–${window.end + 1} h`).join(", ")}.`
          : hasRainData ? "Ningún modelo disponible indica lluvia." : "Lluvia: sin datos horarios."}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Ver todas las horas y modelos</summary>
        <ul className="mt-2 max-h-80 overflow-y-auto">
          {hours.map((hour) => (
            <li key={hour.hour} className="border-t border-current/10 py-2">
              <strong>{String(hour.hour).padStart(2, "0")}:00</strong> · Viento {range(hour.windLow, hour.windHigh, "km/h")}
              {hour.windDirection !== null && ` del ${directionName(hour.windDirection)}`}
              {hour.gustHigh !== null && ` · Ráfagas ${range(hour.gustLow, hour.gustHigh, "km/h")}`}
              {hour.rainDataModels > 0 && ` · Lluvia: ${hour.rainModels} de ${hour.rainDataModels} modelos, hasta ${range(hour.rainHigh, hour.rainHigh, "mm/h")}`}
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-2 opacity-70">Los rangos y la cantidad de modelos muestran diferencias entre pronósticos; no son una probabilidad ni una medición en el predio.</p>
    </div>
  );
}

function Momento({ titulo, day }: { titulo: string; day?: DaySummary }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{titulo}</span>
        {day && <Estado status={dayStatus(day)} />}
      </div>
      <p className="leading-relaxed">{day ? dayPhrase(day) : "Sin pronóstico todavía."}</p>
    </div>
  );
}

function Lugar({ place, days, sources, hourlyTomorrow, hoy, manana }: Tarjeta) {
  const resto = days.filter((day) => day !== hoy && day !== manana);
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-current/15 p-4">
      <h2 className="text-xl font-bold">{place.name}</h2>
      <Momento titulo="Hoy" day={hoy} />
      <Momento titulo="Mañana" day={manana} />
      <HorasDeManana hours={hourlyTomorrow} />
      {place.timezone === "America/Argentina/San_Juan" && (
        <p className="text-sm opacity-70">
          Zonda: esta vista todavía no lo identifica. Revisá también las{" "}
          <a className="underline" href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener noreferrer">alertas oficiales del SMN</a>.
        </p>
      )}
      {resto.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">
            Ver el resto de la semana
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {resto.map((day) => (
              <li key={day.date} className="flex flex-col gap-1 border-t border-current/10 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize">{formatDayLabel(day.date)}</span>
                  <Estado status={dayStatus(day)} />
                </div>
                <p className="leading-relaxed">{dayPhrase(day)}</p>
                {rangoRafaga(day) && <p className="text-sm opacity-60">{rangoRafaga(day)}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs opacity-60">
        Fuente reciente: {sources.length === 0 ? "ninguna" : sources.map((source) => source === "smn-wrf" ? "SMN" : "Open-Meteo").join(" y ")}.
      </p>
    </section>
  );
}

export function VistaGeneral({ overview, now }: { overview: Overview; now: Date }) {
  if (overview.places.length === 0) {
    return (
      <p>
        No hay lugares guardados para esta cuenta. Si todavía no vinculaste Telegram, mandale
        /start al bot.
      </p>
    );
  }

  const stale = overview.health.filter((status) => isStale(status.last_ok_at, now));
  const tarjetas: Tarjeta[] = overview.places
    .map((forecast) => {
      const today = localDateParts(now, forecast.place.timezone).date;
      return {
        ...forecast,
        hoy: forecast.days.find((day) => day.date === today),
        manana: forecast.days.find((day) => day.date === addDays(today, 1)),
      };
    })
    // Primero lo que pide más atención hoy.
    .sort((a, b) => {
      const tone = (card: Tarjeta) => (card.hoy ? TONE_ORDER[dayStatus(card.hoy).tone] : 3);
      return tone(a) - tone(b);
    });

  return (
    <>
      {(stale.length > 0 || overview.health.length === 0) && (
        <p role="alert" className="rounded-xl border-2 border-brand px-4 py-3 font-semibold">
          {tarjetas.some((tarjeta) => tarjeta.sources.length > 0)
            ? "Una fuente sin actualizar; el pronóstico usa sólo fuentes recientes. Consultá también al SMN."
            : "Sistema sin datos, usar SMN."}
          {stale.length > 0 &&
            ` Sin actualizar hace más de 6 h: ${stale.map((status) => sourceLabel(status.source)).join(" y ")}.`}
        </p>
      )}
      {tarjetas.map((tarjeta) => (
        <Lugar key={tarjeta.place.id} {...tarjeta} />
      ))}
      <footer className="flex flex-col gap-1 border-t border-current/20 pt-3 text-xs opacity-60">
        <p>
          {overview.health
            .map(
              (status) =>
                `${sourceLabel(status.source)} ${
                  status.last_ok_at ? `actualizado ${formatAgo(new Date(status.last_ok_at), now)}` : "sin datos"
                }`,
            )
            .join(" · ")}
        </p>
        <p>
          Combina hasta 6 modelos recientes. Temperatura y lluvia: el valor del medio. Viento y ráfagas: el más alto
          (peor caso). Nombres del viento según la escala de Beaufort. Datos: Open-Meteo (CC BY
          4.0) y Servicio Meteorológico Nacional (CC BY 2.5 AR).
        </p>
      </footer>
    </>
  );
}
