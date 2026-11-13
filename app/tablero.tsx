"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HeroVideoBackground from "./components/HeroVideoBackground";
import { PantallaLugar } from "./pantalla";
import { PUBLIC_PLACES } from "@/lib/clima/places";
import { emptyPreferences, parsePreferences, type Preferences, type SavedPlace } from "@/lib/clima/prefs";
import type { ClimateReport, PlaceView } from "@/lib/clima/types";
import Image from "next/image";

const LOCAL = "masalto-clima-preferencias";
const OBRA = "masalto-clima-obra";
const LUGAR = "masalto-clima-lugar";

type Listed = {
  id: string;
  name: string;
  region: string;
  armadoOn: string | null;
  eventOn: string | null;
  custom: boolean;
  lat: number;
  lon: number;
  timezone: string;
  zonda: boolean;
};

function readLocal(): Preferences {
  try {
    return parsePreferences(JSON.parse(localStorage.getItem(LOCAL) || "null"));
  } catch {
    return emptyPreferences();
  }
}

export function Tablero({ report }: { report: ClimateReport }) {
  const [prefs, setPrefs] = useState<Preferences>(emptyPreferences);
  const [obra, setObra] = useState(false);
  const [selected, setSelected] = useState(PUBLIC_PLACES[0].id);
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ name: string; region: string; lat: number; lon: number; timezone: string }[]>([]);
  const [customView, setCustomView] = useState<PlaceView | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);

  useEffect(() => {
    const local = readLocal();
    setPrefs(local);
    const savedObra = localStorage.getItem(OBRA) === "1";
    setObra(savedObra);
    document.body.classList.toggle("modo-obra", savedObra);
    setSelected(localStorage.getItem(LUGAR) || PUBLIC_PLACES[0].id);
    setReady(true);
    void fetch("/api/preferencias")
      .then((response) => response.json())
      .then((body: { signedIn?: boolean; prefs?: Preferences }) => {
        if (body.signedIn && body.prefs) setPrefs(parsePreferences(body.prefs));
      })
      .catch(() => undefined);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  function save(next: Preferences) {
    setPrefs(next);
    localStorage.setItem(LOCAL, JSON.stringify(next));
    void fetch("/api/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  const list: Listed[] = useMemo(() => {
    const defaults = PUBLIC_PLACES.filter((place) => !prefs.disabledIds.includes(place.id)).map((place) => ({
      id: place.id,
      name: place.name,
      region: place.region,
      lat: place.lat,
      lon: place.lon,
      timezone: place.timezone,
      zonda: place.zonda,
      custom: false,
      armadoOn: prefs.dates[place.id]?.armadoOn ?? null,
      eventOn: prefs.dates[place.id]?.eventOn ?? null,
    }));
    const custom = prefs.custom.map((place) => ({ ...place, custom: true }));
    return [...defaults, ...custom];
  }, [prefs]);

  const current = list.find((place) => place.id === selected) ?? list[0];
  const fromReport = report.places.find((place) => place.id === current?.id) ?? null;
  const view = fromReport ?? (customView?.id === current?.id ? customView : null);

  useEffect(() => {
    if (!current || fromReport || !ready) return;
    let cancel = false;
    setLoadingPlace(true);
    void fetch("/api/clima/punto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    })
      .then((response) => response.json())
      .then((body: { place?: PlaceView }) => {
        if (!cancel && body.place) setCustomView(body.place);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancel) setLoadingPlace(false); });
    return () => { cancel = true; };
  }, [current, fromReport, ready]);

  function choose(id: string) {
    setSelected(id);
    localStorage.setItem(LUGAR, id);
  }

  function toggleObra() {
    const next = !obra;
    setObra(next);
    localStorage.setItem(OBRA, next ? "1" : "0");
    document.body.classList.toggle("modo-obra", next);
  }

  async function search() {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const body = await response.json() as { results: typeof hits };
    setHits(body.results ?? []);
  }

  function addHit(hit: (typeof hits)[number]) {
    const place: SavedPlace = {
      id: `lugar-${hit.lat.toFixed(3)}-${hit.lon.toFixed(3)}`,
      name: hit.name,
      region: hit.region,
      lat: hit.lat,
      lon: hit.lon,
      timezone: hit.timezone,
      zonda: /san juan|mendoza|la rioja/i.test(hit.region),
      armadoOn: null,
      eventOn: null,
      custom: true,
    };
    const next = { ...prefs, custom: [...prefs.custom.filter((item) => item.id !== place.id), place] };
    save(next);
    choose(place.id);
    setHits([]);
    setQuery("");
  }

  function setDates(id: string, field: "armadoOn" | "eventOn", value: string) {
    const custom = prefs.custom.find((place) => place.id === id);
    if (custom) {
      save({ ...prefs, custom: prefs.custom.map((place) => place.id === id ? { ...place, [field]: value || null } : place) });
      return;
    }
    save({ ...prefs, dates: { ...prefs.dates, [id]: { armadoOn: prefs.dates[id]?.armadoOn ?? null, eventOn: prefs.dates[id]?.eventOn ?? null, [field]: value || null } } });
  }

  const body = (
    <main className={`mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-4 ${obra ? "modo-obra" : "text-white"}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Image src="/masalto-logo-negativo.png" width={1280} height={739} alt="MasAlto" className={`h-10 w-auto ${obra ? "invert" : ""}`} priority />
        <div className="flex flex-wrap gap-2">
          <Link className="toque" href="/estadisticas">Estadísticas</Link>
          <Link className="toque" href="/avisos">Avisos</Link>
          <button type="button" className="toque" onClick={toggleObra} aria-pressed={obra}>{obra ? "Modo normal" : "Modo obra"}</button>
        </div>
      </header>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Lugar
        <select className="toque text-base" value={current?.id ?? ""} onChange={(event) => choose(event.target.value)}>
          {list.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </label>

      <button type="button" className="toque w-fit" onClick={() => setEditor((open) => !open)}>
        {editor ? "Cerrar lugares" : "Elegir lugares y fechas"}
      </button>

      {editor && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 p-4">
          <p className="text-base font-bold">Lista de lugares</p>
          {PUBLIC_PLACES.map((place) => (
            <label key={place.id} className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={!prefs.disabledIds.includes(place.id)}
                onChange={(event) => {
                  const disabledIds = event.target.checked
                    ? prefs.disabledIds.filter((id) => id !== place.id)
                    : [...prefs.disabledIds, place.id];
                  save({ ...prefs, disabledIds });
                }}
              />
              {place.name}
            </label>
          ))}
          {prefs.custom.map((place) => (
            <div key={place.id} className="flex items-center justify-between gap-2">
              <span>{place.name}</span>
              <button type="button" className="toque" onClick={() => save({ ...prefs, custom: prefs.custom.filter((item) => item.id !== place.id) })}>Quitar</button>
            </div>
          ))}
          {current && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Armado
                <input className="toque mt-1 w-full" type="date" value={current.armadoOn ?? ""} onChange={(event) => setDates(current.id, "armadoOn", event.target.value)} />
              </label>
              <label className="text-sm font-bold">Evento
                <input className="toque mt-1 w-full" type="date" value={current.eventOn ?? ""} onChange={(event) => setDates(current.id, "eventOn", event.target.value)} />
              </label>
            </div>
          )}
          <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <label className="text-sm font-bold">Agregar lugar
              <input className="toque mt-1 w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej: Fiesta del Sol, Villallén" />
            </label>
            <button className="toque w-fit" type="submit">Buscar</button>
          </form>
          {hits.map((hit) => (
            <button key={`${hit.lat}-${hit.lon}`} type="button" className="toque text-left" onClick={() => addHit(hit)}>
              {hit.name} · {hit.region}
            </button>
          ))}
        </section>
      )}

      {!current && <p className="text-base">Elegí al menos un lugar.</p>}
      {loadingPlace && !view && <p className="text-base">Buscando el clima de este lugar…</p>}
      {view && current && (
        <PantallaLugar
          place={view}
          checkedAt={report.checkedAt}
          officialNote={report.officialNote}
          armadoOn={current.armadoOn}
          eventOn={current.eventOn}
        />
      )}
    </main>
  );

  if (obra) return body;
  return <HeroVideoBackground className="min-h-screen text-white">{body}</HeroVideoBackground>;
}
