import { notFound } from "next/navigation";
import { localDateParts, type DaySummary } from "@/lib/forecast/combine";
import type { HourlySummary } from "@/lib/forecast/hourly";
import type { Overview } from "@/lib/forecast/queries";
import { Shell, VistaGeneral } from "../vista-general";

export const dynamic = "force-dynamic";

const TZ = "America/Argentina/San_Juan";

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function demoDay(date: string, windy: boolean): DaySummary {
  return {
    date,
    temperatureMin: 17,
    temperatureMax: 31,
    precipitation: windy ? 2 : 0,
    precipitationHigh: windy ? 8 : 0,
    windMax: windy ? 55 : 22,
    windDirection: 180,
    gustMax: windy ? 75 : 30,
    gustLow: windy ? 48 : 18,
    gustHour: 19,
    models: 5,
  };
}

function demoHour(hour: number): HourlySummary {
  const windy = hour >= 18 && hour <= 20;
  const rainy = hour === 19 || hour === 20;
  return {
    hour,
    models: 5,
    windLow: windy ? 30 : 12,
    windHigh: windy ? (hour === 19 ? 55 : 48) : 22,
    windDirection: windy ? 180 : 270,
    gustLow: windy ? 48 : 20,
    gustHigh: windy ? (hour === 19 ? 75 : 64) : 32,
    rainHigh: rainy ? 2 : 0,
    rainModels: rainy ? 2 : 0,
    rainDataModels: 5,
  };
}

export default function DemoPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  const now = new Date();
  const today = localDateParts(now, TZ).date;
  const tomorrow = addDays(today, 1);
  const overview: Overview = {
    places: [{
      place: { id: "demo", name: "Estadio San Juan del Bicentenario · DEMO", timezone: TZ },
      days: [demoDay(today, false), demoDay(tomorrow, true)],
      hourlyToday: [],
      hourlyTomorrow: Array.from({ length: 24 }, (_, hour) => demoHour(hour)),
      sources: ["open-meteo"],
    }],
    health: [{ source: "open-meteo", last_ok_at: now.toISOString() }],
  };

  return (
    <Shell>
      <p role="alert" className="rounded-xl border-2 border-brand p-4 font-bold">
        DEMOSTRACIÓN CON DATOS FICTICIOS. No es un pronóstico ni una alerta vigente.
      </p>
      <VistaGeneral overview={overview} now={now} />
    </Shell>
  );
}
