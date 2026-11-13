import { localDateParts, type DaySummary } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import { dayPhrase, dayStatus, directionName, type DayStatus, type Tone } from "@/lib/forecast/phrases";
import { rainWindows, type HourlySummary } from "@/lib/forecast/hourly";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { isStale, sourceLabel } from "@/lib/health/check";
import type { OfficialAlert } from "@/lib/smn/cap";
import type { OfficialAlertsResult } from "@/lib/smn/load";
import Image from "next/image";
import { salir } from "./actions";
import HeroVideoBackground from "./components/HeroVideoBackground";

export function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <HeroVideoBackground className="clima-shell min-h-screen text-white">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 pb-10 pt-5 sm:px-6 sm:pt-7">
        <header className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div className="flex items-center gap-2">
            <Image src="/masalto-logo-negativo.png" width={1280} height={739} alt="MasAlto" className="h-12 w-auto sm:h-14" priority />
            <span className="border-l border-white/25 pl-3 text-[10px] font-bold tracking-[.22em] text-white/65">CLIMA</span>
          </div>
          {email && (
            <form action={salir} className="text-right text-sm">
              <span className="hidden text-white/60 sm:inline">{email} · </span>
              <button type="submit" className="underline underline-offset-4">
                Salir
              </button>
            </form>
          )}
        </header>
        <div className="space-y-1 pb-1 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-400">Estado del clima</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">El tiempo en el predio.</h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/65">
            Ahora y los próximos días. Si está todo bien, se lee al toque. Viento, lluvia y Zonda quedan marcados.
          </p>
        </div>
        {children}
      </main>
    </HeroVideoBackground>
  );
}

const TONE_ORDER: Record<Tone, number> = { warning: 0, info: 1, calm: 2 };

const TONE_CLASS: Record<Tone, string> = {
  calm: "border border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
  info: "border border-amber-400/25 bg-amber-500/15 text-amber-300",
  warning: "border border-red-400/35 bg-red-500/20 text-red-200",
};

function Estado({ status }: { status: DayStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_CLASS[status.tone]}`}
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
    <div className={`rounded-xl border p-4 text-sm ${alerts.length > 0 ? "border-red-400/45 bg-red-950/30" : "border-amber-400/20 bg-amber-950/15"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Alertas oficiales del SMN</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Fuente: SMN</span>
      </div>
      {state !== "ok" && (
        <p role="alert" className="font-medium leading-relaxed text-amber-100">
          {state === "unavailable"
            ? "No se pudieron verificar las alertas oficiales ahora."
            : "La consulta oficial fue parcial; pueden faltar alertas."}{" "}
          <a className="font-bold underline underline-offset-4" href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener noreferrer">Consultá el SMN</a>.
        </p>
      )}
      {alerts.length === 0 && state === "ok" && (
        <p className="text-white/70">No apareció una alerta aplicable a este punto en el índice consultado. Esto no confirma ausencia de riesgo.</p>
      )}
      {alerts.map((alert) => (
        <article key={alert.id} className="mt-3 space-y-1 border-t border-white/15 pt-3 leading-relaxed">
          <p className="font-bold text-red-100">{alert.demo ? "DEMO ficticia · " : ""}{alert.headline}</p>
          <p>Evento: {alert.event}{alert.severity && ` · Severidad oficial: ${alert.severity}`}</p>
          <p>Desde {localMoment(alert.startsAt, timeZone)} hasta {localMoment(alert.expiresAt, timeZone)}. Emitida {localMoment(alert.sentAt, timeZone)}.</p>
          {alert.description && <p className="text-white/80">{alert.description}</p>}
          {!alert.demo && <a className="inline-block font-bold text-red-200 underline underline-offset-4" href={alert.sourceUrl} target="_blank" rel="noopener noreferrer">Ver aviso CAP original</a>}
        </article>
      ))}
      <p className="mt-3 border-t border-white/10 pt-2 text-xs text-white/50">Índice consultado: {localMoment(checkedAt, timeZone)}. El pronóstico por modelos aparece aparte.</p>
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
  const peak = [...withWind].sort((a, b) => (b.windHigh ?? 0) - (a.windHigh ?? 0))[0];
  const maxWind = Math.max(...withWind.map((hour) => hour.windHigh ?? 0), 1);
  const windows = rainWindows(hours);
  const hasRainData = hours.some((hour) => hour.rainDataModels > 0);
  return (
    <div className="glass-panel-raised rounded-xl p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Mañana, por hora</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">Detalle horario</span>
      </div>
      {peak && (
        <p className="leading-relaxed text-white/80">
          Mayor viento previsto: <strong className="text-white">{peak.hour}–{peak.hour + 1} h, {range(peak.windLow, peak.windHigh, "km/h")}</strong>.
          {peak.windDirection !== null && ` Dirección del modelo más intenso: ${directionName(peak.windDirection)}.`}
          {peak.gustHigh !== null && ` Ráfagas: ${range(peak.gustLow, peak.gustHigh, "km/h")}.`}
        </p>
      )}
      <p className="mt-1 leading-relaxed text-white/70">
        {windows.length > 0
          ? `Algún modelo indica lluvia: ${windows.map((window) => `${window.start}–${window.end + 1} h`).join(", ")}.`
          : hasRainData ? "Ningún modelo disponible indica lluvia." : "Lluvia: sin datos horarios."}
      </p>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="flex cursor-pointer items-center justify-between gap-2 font-bold text-red-200 hover:text-red-100">
          Ver todas las horas y modelos <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <p className="mt-3 text-xs text-white/50">Las barras comparan cada hora con la mayor velocidad prevista de mañana.</p>
        <ul className="mt-2 max-h-96 overflow-y-auto">
          {hours.map((hour) => (
            <li key={hour.hour} className="border-t border-white/10 py-2.5">
              <div className="mb-1 text-xs leading-relaxed">
              <strong className="mr-2 text-white">{String(hour.hour).padStart(2, "0")}:00</strong> · Viento {range(hour.windLow, hour.windHigh, "km/h")}
              {hour.windDirection !== null && ` del ${directionName(hour.windDirection)}`}
              {hour.gustHigh !== null && ` · Ráfagas ${range(hour.gustLow, hour.gustHigh, "km/h")}`}
              {` · ${hourlyRain(hour)}`}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div className="h-full rounded-full bg-gradient-to-r from-red-800 to-red-500" style={{ width: `${Math.max(0, Math.min(100, ((hour.windHigh ?? 0) / maxWind) * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-xs leading-relaxed text-white/50">Los rangos y la cantidad de modelos muestran diferencias entre pronósticos; no son una probabilidad ni una medición en el predio.</p>
    </div>
  );
}

function Momento({ titulo, day }: { titulo: string; day?: DaySummary }) {
  return (
    <div className="glass-panel-raised flex min-w-0 flex-col gap-3 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-white/70">{titulo}</span>
        {day && <Estado status={dayStatus(day)} />}
      </div>
      <p className="text-sm leading-relaxed">{day ? dayPhrase(day) : "Sin pronóstico todavía."}</p>
    </div>
  );
}

function Lugar({ place, days, sources, hourlyTomorrow, hoy, manana, official }: Tarjeta & { official: OfficialAlertsResult }) {
  const resto = days.filter((day) => day !== hoy && day !== manana);
  return (
    <section className="glass-panel clima-card flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-red-300">Lugar seguido</p>
          <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{place.name}</h2>
          <p className="mt-1 text-xs text-white/50">{place.timezone === "America/Argentina/San_Juan" ? "San Juan" : "Córdoba"} · Pronóstico por modelos</p>
        </div>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300">⌖</span>
      </div>
      <AlertasOficiales alerts={official.byPlace[place.id] ?? []} state={official.state} checkedAt={official.checkedAt} timeZone={place.timezone} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Momento titulo="Hoy" day={hoy} />
        <Momento titulo="Mañana" day={manana} />
      </div>
      <HorasDeManana hours={hourlyTomorrow} />
      {place.timezone === "America/Argentina/San_Juan" && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">
          Zonda: esta vista sólo lo identifica cuando hay un aviso oficial aplicable del SMN; todavía no tiene detector propio.
        </p>
      )}
      {resto.length > 0 && (
        <details className="group border-t border-white/10 pt-3">
          <summary className="flex cursor-pointer items-center justify-between font-bold text-sm hover:text-red-200">
            Ver el resto de la semana <span aria-hidden="true" className="text-red-300 transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {resto.map((day) => (
              <li key={day.date} className="flex flex-col gap-1 border-t border-white/10 pt-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize">{formatDayLabel(day.date)}</span>
                  <Estado status={dayStatus(day)} />
                </div>
                <p className="leading-relaxed">{dayPhrase(day)}</p>
                {rangoRafaga(day) && <p className="text-xs text-white/55">{rangoRafaga(day)}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="border-t border-white/10 pt-3 text-xs text-white/50">
        Fuente reciente: {sources.length === 0 ? "ninguna" : sources.map((source) => source === "smn-wrf" ? "SMN" : "Open-Meteo").join(" y ")}.
      </p>
    </section>
  );
}

export function VistaGeneral({ overview, officialAlerts, now }: { overview: Overview; officialAlerts: OfficialAlertsResult; now: Date }) {
  if (overview.places.length === 0) {
    return (
      <p className="glass-panel rounded-xl p-4 text-sm">Todavía no hay lugares guardados para mostrar.</p>
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
    // El estadio es el lugar principal de esta vista; después, lo que pide más atención hoy.
    .sort((a, b) => {
      const stadium = (card: Tarjeta) => /estadio san juan del bicentenario/i.test(card.place.name) ? 0 : 1;
      if (stadium(a) !== stadium(b)) return stadium(a) - stadium(b);
      const tone = (card: Tarjeta) => (card.hoy ? TONE_ORDER[dayStatus(card.hoy).tone] : 3);
      return tone(a) - tone(b);
    });

  return (
    <>
      {(stale.length > 0 || overview.health.length === 0) && (
        <p role="alert" className="glass-panel rounded-xl border-red-500/60 px-4 py-3 text-sm font-semibold leading-relaxed text-red-100">
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
      <footer className="flex flex-col gap-2 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/55">
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
        <a href="https://masalto.com.ar" target="_blank" rel="noopener noreferrer" className="mt-2 font-bold text-white/75 underline underline-offset-4 hover:text-white">MasAlto Producciones ↗</a>
      </footer>
    </>
  );
}
