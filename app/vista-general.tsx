import { localDateParts, type DaySummary } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import { dayPhrase, dayStatus, directionName, type DayStatus, type Tone } from "@/lib/forecast/phrases";
import { rainWindows, type HourlySummary } from "@/lib/forecast/hourly";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { isStale, sourceLabel } from "@/lib/health/check";
import type { OfficialAlert } from "@/lib/smn/cap";
import type { OfficialAlertsResult } from "@/lib/smn/load";
import { salir } from "./actions";
import HeroVideoBackground from "./components/HeroVideoBackground";

export function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <HeroVideoBackground className="min-h-screen">
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
    </HeroVideoBackground>
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

function localMoment(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

function AlertasOficiales({ alerts, state, checkedAt, timeZone }: {
  alerts: OfficialAlert[];
  state: OfficialAlertsResult["state"];
  checkedAt: string;
  timeZone: string;
}) {
  return (
    <div className="rounded-lg border border-brand/50 p-3 text-sm">
      <h3 className="font-bold">Alertas oficiales del SMN</h3>
      {state !== "ok" && (
        <p role="alert" className="font-semibold">
          {state === "unavailable"
            ? "No se pudieron verificar las alertas oficiales ahora."
            : "La consulta oficial fue parcial; pueden faltar alertas."}{" "}
          <a className="underline" href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener noreferrer">Consultá el SMN</a>.
        </p>
      )}
      {alerts.length === 0 && state === "ok" && (
        <p>No apareció una alerta aplicable a este punto en el índice consultado. Esto no confirma ausencia de riesgo.</p>
      )}
      {alerts.map((alert) => (
        <article key={alert.id} className="mt-2 border-t border-current/15 pt-2">
          <p className="font-bold">{alert.demo ? "DEMO ficticia · " : ""}{alert.headline}</p>
          <p>Evento: {alert.event}{alert.severity && ` · Severidad oficial: ${alert.severity}`}</p>
          <p>Desde {localMoment(alert.startsAt, timeZone)} hasta {localMoment(alert.expiresAt, timeZone)}.</p>
          <p>Emitida {localMoment(alert.sentAt, timeZone)}.</p>
          {alert.description && <p>{alert.description}</p>}
          {!alert.demo && <a className="underline" href={alert.sourceUrl} target="_blank" rel="noopener noreferrer">Ver aviso CAP original</a>}
        </article>
      ))}
      <p className="mt-2 text-xs opacity-70">Índice consultado: {localMoment(checkedAt, timeZone)} · Fuente: SMN. El pronóstico por modelos aparece aparte.</p>
    </div>
  );
}

function range(low: number | null, high: number | null, unit: string): string {
  if (low === null || high === null) return "sin dato";
  const a = Math.round(low);
  const b = Math.round(high);
  return `${a === b ? a : `${a}–${b}`} ${unit}`;
}

function hourlyRain(hour: HourlySummary): string {
  if (hour.rainDataModels === 0) return "Lluvia sin dato";
  if (hour.rainModels === 0) return `Sin lluvia en ${hour.rainDataModels} modelos`;
  return `Lluvia en ${hour.rainModels} de ${hour.rainDataModels} modelos, hasta ${range(hour.rainHigh, hour.rainHigh, "mm/h")}`;
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
              {` · ${hourlyRain(hour)}`}
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

function Lugar({ place, days, sources, hourlyTomorrow, hoy, manana, official }: Tarjeta & { official: OfficialAlertsResult }) {
  const resto = days.filter((day) => day !== hoy && day !== manana);
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-current/15 p-4">
      <h2 className="text-xl font-bold">{place.name}</h2>
      <AlertasOficiales alerts={official.byPlace[place.id] ?? []} state={official.state} checkedAt={official.checkedAt} timeZone={place.timezone} />
      <Momento titulo="Hoy" day={hoy} />
      <Momento titulo="Mañana" day={manana} />
      <HorasDeManana hours={hourlyTomorrow} />
      {place.timezone === "America/Argentina/San_Juan" && (
        <p className="text-sm opacity-70">
          Zonda: esta vista sólo lo identifica cuando hay un aviso oficial aplicable del SMN; todavía no tiene detector propio.
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

export function VistaGeneral({ overview, officialAlerts, now }: { overview: Overview; officialAlerts: OfficialAlertsResult; now: Date }) {
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
        <Lugar key={tarjeta.place.id} {...tarjeta} official={officialAlerts} />
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
