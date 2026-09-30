import type { DaySummary } from "@/lib/forecast/combine";
import {
  formatAgo,
  formatDayLabel,
  formatGust,
  formatPrecipitation,
  formatTemperature,
  formatWind,
} from "@/lib/forecast/format";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { isStale, sourceLabel } from "@/lib/health/check";
import { salir } from "./actions";

export function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-end justify-between gap-4 border-b-2 border-brand pb-3">
        <div>
          <h1 className="text-2xl font-bold">MasAlto Clima</h1>
          <p className="text-sm opacity-70">Vista general · lugares guardados</p>
        </div>
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

function Frescura({ overview, now }: { overview: Overview; now: Date }) {
  const stale = overview.health.filter((status) => isStale(status.last_ok_at, now));
  return (
    <section className="flex flex-col gap-2 text-sm">
      {(stale.length > 0 || overview.health.length === 0) && (
        <p role="alert" className="rounded border-2 border-brand px-3 py-2 font-semibold">
          Sistema sin datos, usar SMN.
          {stale.length > 0 &&
            ` Sin actualizar hace más de 6 h: ${stale.map((status) => sourceLabel(status.source)).join(" y ")}.`}
        </p>
      )}
      <p className="opacity-70">
        {overview.health.map((status) => (
          <span key={status.source} className="mr-4 inline-block">
            {sourceLabel(status.source)}:{" "}
            {status.last_ok_at
              ? `actualizado ${formatAgo(new Date(status.last_ok_at), now)}`
              : "sin datos"}
          </span>
        ))}
      </p>
    </section>
  );
}

function rangoRafaga(day: DaySummary): string | null {
  if (day.gustMax === null || day.gustLow === null) return null;
  const low = Math.round(day.gustLow);
  const high = Math.round(day.gustMax);
  return low === high ? null : `modelos: ${low} a ${high}`;
}

function Lugar({ place, days, sources }: PlaceForecast) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{place.name}</h2>
      {days.length === 0 ? (
        <p className="text-sm opacity-70">Sin pronóstico todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-current/20 text-left text-xs uppercase opacity-70">
                <th className="py-1 pr-4 font-semibold">Día</th>
                <th className="py-1 pr-4 font-semibold">Ráfagas</th>
                <th className="py-1 pr-4 font-semibold">Viento</th>
                <th className="py-1 pr-4 font-semibold">Temperatura</th>
                <th className="py-1 font-semibold">Lluvia</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {days.map((day) => (
                <tr key={day.date} className="border-b border-current/10 align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-sans font-semibold">
                    {formatDayLabel(day.date)}
                  </th>
                  <td className="py-2 pr-4">
                    {formatGust(day)}
                    {rangoRafaga(day) && (
                      <span className="block text-xs opacity-60">{rangoRafaga(day)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{formatWind(day)}</td>
                  <td className="py-2 pr-4">{formatTemperature(day)}</td>
                  <td className="py-2">{formatPrecipitation(day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60">
        Fuente: {sources.includes("smn-wrf") ? "Open-Meteo y SMN (WRF 4 km)" : "Open-Meteo"}.
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
  return (
    <>
      <Frescura overview={overview} now={now} />
      {overview.places.map((place) => (
        <Lugar key={place.place.id} {...place} />
      ))}
      <footer className="border-t border-current/20 pt-3 text-xs opacity-60">
        Pronóstico combinado a 7 días: mediana entre modelos para temperatura y lluvia; en viento
        y ráfagas, el valor más alto. El WRF del SMN cubre las primeras 72 h y no informa
        ráfagas. Datos: Open-Meteo (CC BY 4.0) y Servicio Meteorológico Nacional (CC BY 2.5 AR).
      </footer>
    </>
  );
}
