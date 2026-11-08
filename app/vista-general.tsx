import { localDateParts, type DaySummary } from "@/lib/forecast/combine";
import { formatAgo, formatDayLabel } from "@/lib/forecast/format";
import {
  dayStatus,
  rainSentence,
  temperatureSentence,
  windSentence,
  type DayStatus,
  type Tone,
} from "@/lib/forecast/phrases";
import type { Overview, PlaceForecast } from "@/lib/forecast/queries";
import { isStale, sourceLabel } from "@/lib/health/check";
import { SMN_URL, botonSecundarioClass } from "./ui/estilos";
import { AbrirBot, Aviso, Comando } from "./ui/piezas";

const TONE_ORDER: Record<Tone, number> = { warning: 0, info: 1, calm: 2 };

const TONE_CLASS: Record<Tone, string> = {
  calm: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
  info: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
  warning: "bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100",
};

const BORDE: Record<Tone | "neutro", string> = {
  warning: "border-brand",
  info: "border-amber-700 dark:border-amber-300",
  calm: "border-line",
  neutro: "border-line",
};

function Estado({ status, grande = false }: { status: DayStatus; grande?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full self-start items-center rounded-lg font-bold leading-tight ${
        grande ? "px-3 py-1.5 text-xl" : "px-2.5 py-1 text-base"
      } ${TONE_CLASS[status.tone]}`}
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

function fuenteDe(sources: string[]): string {
  return sources.includes("smn-wrf") ? "Fuente: SMN y Open-Meteo." : "Fuente: Open-Meteo.";
}

function tonoVisible(hoy?: DaySummary, manana?: DaySummary): Tone | "neutro" {
  const tonos = [hoy, manana].flatMap((day) => (day ? [dayStatus(day).tone] : []));
  if (tonos.length === 0) return "neutro";
  return tonos.reduce((peor, tono) => (TONE_ORDER[tono] < TONE_ORDER[peor] ? tono : peor));
}

function diaMasUrgente(days: DaySummary[]): DaySummary {
  return days.reduce((peor, day) =>
    TONE_ORDER[dayStatus(day).tone] < TONE_ORDER[dayStatus(peor).tone] ? day : peor,
  );
}

function Frase({ day }: { day: DaySummary }) {
  const lineas = [
    { id: "lluvia", texto: rainSentence(day) },
    { id: "temperatura", texto: temperatureSentence(day) },
    { id: "viento", texto: windSentence(day) },
  ];
  return (
    <ul className="flex max-w-prose flex-col gap-1 text-base leading-snug">
      {lineas.map((linea) => (
        <li key={linea.id} className="text-pretty">
          {linea.texto}
        </li>
      ))}
    </ul>
  );
}

function Momento({
  titulo,
  day,
  destacado = false,
}: {
  titulo: string;
  day?: DaySummary;
  destacado?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted">
        {titulo}
        {day ? <span className="font-normal capitalize"> · {formatDayLabel(day.date)}</span> : null}
      </h3>
      {day ? (
        <>
          <Estado status={dayStatus(day)} grande={destacado} />
          <Frase day={day} />
        </>
      ) : (
        <p className="text-base text-muted">Sin pronóstico todavía.</p>
      )}
    </div>
  );
}

type Tarjeta = PlaceForecast & { hoy?: DaySummary; manana?: DaySummary };

function Lugar({ place, days, sources, hoy, manana }: Tarjeta) {
  const resto = days.filter((day) => day !== hoy && day !== manana);
  const peor = resto.length > 0 ? diaMasUrgente(resto) : null;

  return (
    <section className={`flex min-w-0 flex-col gap-5 rounded-xl border-2 bg-surface p-4 sm:p-5 ${BORDE[tonoVisible(hoy, manana)]}`}>
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">{place.name}</h2>
      <Momento titulo="Hoy" day={hoy} destacado />
      <div className="border-t border-line pt-4">
        <Momento titulo="Mañana" day={manana} />
      </div>
      {peor && (
        <details className="border-t border-line pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg py-1 hover:bg-background [&::-webkit-details-marker]:hidden">
            <span className="font-semibold">Ver el resto de la semana</span>
            <span className="flex shrink-0 items-center gap-2">
              <Estado status={dayStatus(peor)} />
              <span aria-hidden="true" className="semana-chevron inline-block h-2 w-2 border-r-2 border-b-2 border-current" />
            </span>
          </summary>
          <ul className="mt-2 flex flex-col gap-4">
            {resto.map((day) => {
              const rango = rangoRafaga(day);
              return (
                <li key={day.date} className="flex flex-col gap-2 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold capitalize">{formatDayLabel(day.date)}</h3>
                    <Estado status={dayStatus(day)} />
                  </div>
                  <Frase day={day} />
                  {rango && <p className="text-sm text-muted">{rango}</p>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted">{fuenteDe(sources)}</p>
    </section>
  );
}

export function VistaGeneral({ overview, now }: { overview: Overview; now: Date }) {
  if (overview.places.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Aviso titulo="No hay lugares guardados" tono="neutro" role="status" tituloEtiqueta="h2">
          Esta cuenta todavía no tiene lugares. Si no vinculaste Telegram, mandale <Comando>/start</Comando>{" "}
          al bot.
        </Aviso>
        <AbrirBot>Abrir el bot</AbrirBot>
      </div>
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

  const [primero, ...resto] = tarjetas;

  return (
    <>
      {(stale.length > 0 || overview.health.length === 0) && (
        <Aviso titulo="Sistema sin datos, usar SMN." tituloEtiqueta="h2">
          {stale.length > 0 ? (
            <p>
              Sin actualizar hace más de 6 h: {stale.map((status) => sourceLabel(status.source)).join(" y ")}.
            </p>
          ) : (
            <p>No hay datos de las fuentes.</p>
          )}
          <a href={SMN_URL} rel="noopener noreferrer" className={`${botonSecundarioClass} mt-3 sm:w-auto`}>
            Abrir el pronóstico del SMN
          </a>
        </Aviso>
      )}
      {overview.health.length > 0 && (
        <ul aria-label="Actualización de las fuentes" className="flex flex-col gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
          {overview.health.map((status) => (
            <li key={status.source}>
              <span className="font-semibold text-foreground">{sourceLabel(status.source)}</span>{" "}
              {status.last_ok_at ? `actualizado ${formatAgo(new Date(status.last_ok_at), now)}` : "sin datos"}
            </li>
          ))}
        </ul>
      )}
      {primero && <Lugar {...primero} />}
      {resto.length > 1 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {resto.map((tarjeta) => (
            <Lugar key={tarjeta.place.id} {...tarjeta} />
          ))}
        </div>
      ) : (
        resto.map((tarjeta) => <Lugar key={tarjeta.place.id} {...tarjeta} />)
      )}
      <footer className="border-t border-line pt-4 text-sm leading-relaxed text-muted">
        <p>
          Combina 6 modelos. Temperatura y lluvia: el valor del medio. Viento y ráfagas: el más alto
          (peor caso). Nombres del viento según la escala de Beaufort. Datos: Open-Meteo (CC BY
          4.0) y Servicio Meteorológico Nacional (CC BY 2.5 AR).
        </p>
      </footer>
    </>
  );
}
