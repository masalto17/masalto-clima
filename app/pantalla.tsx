import type { Level, PlaceView } from "@/lib/clima/types";

const BANNER: Record<Level, string> = {
  ok: "obra-ok",
  atencion: "obra-atencion",
  alerta: "obra-alerta",
};

function aviso(level: Level): string {
  if (level === "alerta") return "Alerta";
  if (level === "atencion") return "Atención";
  return "Todo bien";
}

function fecha(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function PantallaLugar({
  place,
  checkedAt,
  officialNote,
  armadoOn,
  eventOn,
}: {
  place: PlaceView;
  checkedAt: string;
  officialNote: string | null;
  armadoOn: string | null;
  eventOn: string | null;
}) {
  if (!place.ahora) return <p className="text-base">Actualizando el estado…</p>;
  const checked = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(checkedAt));
  const fechas = [armadoOn ? `Armado ${fecha(armadoOn)}` : null, eventOn ? `Evento ${fecha(eventOn)}` : null].filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      <section role={place.level === "ok" ? "status" : "alert"} className={`estado-banner ${BANNER[place.level]}`}>
        <p className="text-xs font-bold uppercase tracking-[.18em] opacity-80">{place.region}</p>
        <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl">{aviso(place.level)}</h2>
        <p className="mt-2 text-base leading-snug sm:text-lg">{place.summary}</p>
        {place.sugerencia && <p className="mt-3 text-base font-bold leading-snug">{place.sugerencia}</p>}
        <p className="mt-3 text-sm opacity-80">Actualizado {checked}.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className={`momento ${BANNER[place.ahora.nivel]}`}>
          <p className="text-xs font-bold uppercase tracking-[.16em]">Ahora</p>
          <p className="mt-1 text-2xl font-extrabold">{place.ahora.nivel === "ok" ? "Sin alerta" : aviso(place.ahora.nivel)}</p>
          <p className="mt-2 text-base leading-snug">{place.ahora.texto}</p>
          {place.nowLabel && <p className="mt-2 text-sm opacity-80">{place.nowLabel}</p>}
        </article>
        <article className={`momento ${place.despues ? BANNER[place.despues.nivel] : BANNER.ok}`}>
          <p className="text-xs font-bold uppercase tracking-[.16em]">Después</p>
          {place.despues ? (
            <>
              <p className="mt-1 text-2xl font-extrabold">{place.despues.cuando}</p>
              <p className="mt-2 text-base leading-snug">{aviso(place.despues.nivel)}. {place.despues.texto}</p>
            </>
          ) : (
            <p className="mt-2 text-base">No hay otra alerta en las próximas 48 h.</p>
          )}
        </article>
      </div>

      {place.lluviaRecienteMm >= 10 && (
        <p className="rounded-xl border-2 border-current px-4 py-3 text-base">
          En los días previos se acumularon {new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(place.lluviaRecienteMm)} mm. Si llueve de nuevo, el piso del armado puede estar blando.
        </p>
      )}

      {fechas.length > 0 && <p className="text-base font-semibold">{fechas.join(" · ")}</p>}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {place.days.map((day) => (
          <li key={day.date} className={`min-w-0 rounded-xl border-2 px-2 py-3 ${BANNER[day.status === "Sin datos" ? "atencion" : day.level]}`}>
            <p className="text-xs font-bold uppercase">{day.label}</p>
            <p className="text-base font-extrabold">{day.status}</p>
            <p className="mt-1 text-sm leading-snug">
              {day.gustMax === null ? "sin ráfaga" : `ráf. ${Math.round(day.gustMax)}`}
              {day.rainMm !== null && day.rainMm >= 0.5 ? ` · ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(day.rainMm)} mm` : ""}
            </p>
          </li>
        ))}
      </ul>

      {officialNote && (
        <p className="rounded-xl border-2 px-4 py-3 text-base">
          {officialNote}{" "}
          <a className="inline-flex min-h-11 items-center font-bold underline underline-offset-4" href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener noreferrer">
            Ver el SMN
          </a>
        </p>
      )}
    </div>
  );
}
