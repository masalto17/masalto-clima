import { formatAgo } from "@/lib/forecast/format";
import { directionName } from "@/lib/forecast/phrases";
import type { ClimateReport, Level, PlaceView, Reason } from "@/lib/clima/types";

const RANK: Record<Level, number> = { alerta: 0, atencion: 1, ok: 2 };

const BANNER: Record<Level, string> = {
  ok: "border-emerald-300/40 bg-emerald-950/50",
  atencion: "border-amber-300/50 bg-amber-950/50",
  alerta: "border-red-400/55 bg-red-950/65",
};

const CHIP: Record<Level, string> = {
  ok: "bg-emerald-400/15 text-emerald-200",
  atencion: "bg-amber-400/15 text-amber-100",
  alerta: "bg-red-500/20 text-red-100",
};

function num(value: number | null, digits = 0): string {
  if (value === null) return "s/d";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function Ahora({ place }: { place: PlaceView }) {
  if (!place.now) return <p className="text-sm text-white/70">Sin lectura de esta hora.</p>;
  const wind =
    place.now.wind === null
      ? "viento sin dato"
      : `viento ${num(place.now.wind)} km/h${place.now.direction === null ? "" : ` del ${directionName(place.now.direction)}`}`;
  const gust =
    place.now.gust === null
      ? "ráfaga sin dato"
      : place.now.gustIsForecast
        ? `ráfagas ${num(place.now.gust)} km/h (pronóstico)`
        : `ráfagas ${num(place.now.gust)} km/h`;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/50">{place.nowLabel}</p>
      <p className="mt-1 text-lg font-semibold leading-snug">
        {place.now.temperature === null ? "s/d" : `${num(place.now.temperature)}°`}
        <span className="mx-2 text-white/30">·</span>
        {place.now.humidity === null ? "humedad s/d" : `humedad ${num(place.now.humidity)} %`}
      </p>
      <p className="text-sm text-white/80">
        {wind}
        <span className="mx-2 text-white/30">·</span>
        {gust}
      </p>
    </div>
  );
}

function Motivo({ reason }: { reason: Reason }) {
  const alert = reason.level === "alerta";
  return (
    <div className={`rounded-xl border px-3 py-3 ${alert ? "border-red-400/50 bg-red-950/40" : "border-amber-300/40 bg-amber-950/30"}`}>
      <p className="text-sm font-extrabold">{reason.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-white/85">{reason.detail}</p>
      {reason.href && (
        <a className="mt-2 inline-block text-sm font-bold underline underline-offset-4" href={reason.href} target="_blank" rel="noopener noreferrer">
          Ver aviso original
        </a>
      )}
    </div>
  );
}

function Lugar({ place }: { place: PlaceView }) {
  const zondaOn = place.zonda.level !== "none";
  const zondaHot = place.zonda.level === "probable" || place.zonda.level === "oficial";
  const reasons = [...place.reasons].filter((reason) => !(zondaOn && reason.code === "zonda")).sort((a, b) => RANK[a.level] - RANK[b.level]);
  return (
    <section className={`glass-panel clima-card flex flex-col gap-4 rounded-2xl p-4 sm:p-5 ${place.level === "alerta" ? "border-red-400/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-red-300">{place.region}</p>
          <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{place.name}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${CHIP[place.level]}`}>{place.headline}</span>
      </div>
      {zondaOn && (
        <div className={`rounded-xl border px-3 py-3 ${zondaHot ? "border-red-300/60 bg-red-900/50" : "border-amber-300/50 bg-amber-950/40"}`}>
          <p className="text-[10px] font-bold tracking-[.22em] text-red-200">VIENTO ZONDA</p>
          <p className="text-lg font-extrabold">{place.zonda.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">{place.zonda.detail}</p>
          {place.zonda.reasons.length > 0 && <p className="mt-2 text-sm text-white/75">{place.zonda.reasons.join(" · ")}</p>}
        </div>
      )}
      {place.level === "ok" ? (
        <p className="rounded-xl border border-emerald-300/30 bg-emerald-950/30 px-3 py-3 text-sm leading-relaxed text-emerald-50">{place.summary}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reasons.map((reason) => (
            <Motivo key={`${reason.code}-${reason.title}`} reason={reason} />
          ))}
        </div>
      )}
      <Ahora place={place} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {place.days.map((day) => (
          <li key={day.date} className={`min-w-0 rounded-xl border border-white/10 px-2 py-2 sm:px-3 ${CHIP[day.status === "Sin datos" ? "atencion" : day.level]}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{day.label}</p>
            <p className="text-sm font-extrabold">{day.status}</p>
            <p className="mt-1 text-[11px] leading-snug opacity-80">
              {day.tempMax === null ? "s/d" : `${num(day.tempMin)}–${num(day.tempMax)}°`}
              <br />
              {day.gustMax === null ? "ráfaga s/d" : `ráf. ${num(day.gustMax)}`}
              {day.rainMm !== null && day.rainMm >= 0.5 ? ` · ${num(day.rainMm, 1)} mm` : ""}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-white/45">
        Fuentes de este lugar: {place.sourceLabels.length === 0 ? "ninguna" : place.sourceLabels.join(", ")}.
      </p>
    </section>
  );
}

export function EstadoClima({ report }: { report: ClimateReport }) {
  const checked = formatAgo(new Date(report.checkedAt), new Date());
  const failed = report.sources.filter((source) => !source.ok);
  const zonda = report.places.some((place) => place.zonda.level === "probable" || place.zonda.level === "oficial");
  return (
    <>
      <section role={report.level === "ok" ? "status" : "alert"} className={`rounded-2xl border px-4 py-5 sm:px-6 ${BANNER[report.level]}`}>
        {zonda && <p className="mb-1 text-[11px] font-bold tracking-[.22em] text-red-200">VIENTO ZONDA</p>}
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{report.headline}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">{report.summary}</p>
        <p className="mt-3 text-xs text-white/50">Actualizado {checked}.</p>
      </section>
      {report.officialNote && (
        <p className="rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-50">
          {report.officialNote}{" "}
          <a className="font-bold underline underline-offset-4" href="https://www.smn.gob.ar/alertas" target="_blank" rel="noopener noreferrer">
            smn.gob.ar/alertas
          </a>
        </p>
      )}
      {report.places.map((place) => (
        <Lugar key={place.id} place={place} />
      ))}
      <section className="glass-panel rounded-2xl p-4 sm:p-5">
        <h2 className="text-lg font-extrabold">Qué fuente viene mejor</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">{report.rankingNote}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {report.ranking.map((row) => (
            <li key={row.variable} className="border-t border-white/10 pt-3">
              <p className="text-sm font-bold">{row.label}</p>
              {row.entries.length === 0 ? (
                <p className="text-sm text-white/55">Sin comparaciones todavía.</p>
              ) : (
                <ol className="mt-1 text-sm text-white/80">
                  {row.entries.map((entry, index) => (
                    <li key={entry.source}>
                      {index + 1}. {entry.label} · error {num(entry.mae, entry.mae >= 10 ? 0 : 1)} {row.unit} · {entry.samples} comparaciones
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      </section>
      <footer className="flex flex-col gap-2 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/55">
        {failed.length > 0 && report.sources.some((source) => source.ok) && (
          <p>No respondieron en esta consulta: {failed.map((source) => source.label).join(", ")}. El consenso usa el resto.</p>
        )}
        <p>
          Ráfaga de atención desde {report.thresholds.gustAtencion} km/h, alerta desde {report.thresholds.gustAlerta} km/h. Viento de alerta
          desde {report.thresholds.windAlerta} km/h. Lluvia de alerta desde {report.thresholds.rainAlertaMm} mm en 24 h. Son cortes operativos,
          configurables, no el cálculo de una estructura.
        </p>
        <p>
          Datos: Open-Meteo (CC BY 4.0), MET Norway, Servicio Meteorológico Nacional (CC BY 2.5 AR) y METAR de aeropuerto. Fuente: SMN en
          observaciones y alertas oficiales. El plan gratuito de Open-Meteo no es para uso comercial.
        </p>
        <a href="https://masalto.com.ar" target="_blank" rel="noopener noreferrer" className="mt-1 font-bold text-white/75 underline underline-offset-4">
          MasAlto Producciones ↗
        </a>
      </footer>
    </>
  );
}
