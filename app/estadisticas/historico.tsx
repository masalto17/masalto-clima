"use client";

import { useState } from "react";
import { PUBLIC_PLACES } from "@/lib/clima/places";

type Row = { year: number; rain: number | null; gust: number | null; wind: number | null; tmax: number | null };

export function Historico() {
  const [placeId, setPlaceId] = useState(PUBLIC_PLACES[0].id);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const place = PUBLIC_PLACES.find((item) => item.id === placeId) ?? PUBLIC_PLACES[0];

  async function load() {
    const [, month, day] = date.split("-");
    setBusy(true);
    const response = await fetch(`/api/historico?lat=${place.lat}&lon=${place.lon}&month=${Number(month)}&day=${Number(day)}`);
    const body = await response.json() as { rows: Row[] };
    setRows(body.rows ?? []);
    setBusy(false);
  }

  const maxGust = Math.max(1, ...(rows ?? []).map((row) => row.gust ?? 0));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-extrabold">El mismo día, otros años</h2>
      <p className="text-base">Archivo de Open-Meteo. Sirve para ver si esa fecha suele traer viento o lluvia, no para el aviso de hoy.</p>
      <label className="text-sm font-bold">Lugar
        <select className="toque mt-1" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
          {PUBLIC_PLACES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">Fecha
        <input className="toque mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <button type="button" className="toque w-fit" onClick={() => void load()}>{busy ? "Buscando…" : "Ver otros años"}</button>
      {rows && rows.length === 0 && <p>No hubo datos para ese día.</p>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.year} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 text-sm">
              <span className="font-bold">{row.year}</span>
              <span className="h-3 rounded bg-red-700" style={{ width: `${Math.round(((row.gust ?? 0) / maxGust) * 100)}%` }} />
              <span>{row.gust === null ? "s/d" : `${Math.round(row.gust)} km/h`} · {row.rain === null ? "s/d" : `${Math.round(row.rain)} mm`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
