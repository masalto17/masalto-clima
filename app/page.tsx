import { Tablero } from "./tablero";
import { loadClimateReport } from "@/lib/clima/load";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Home() {
  try {
    const report = await loadClimateReport();
    return <Tablero report={report} />;
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-white">
        <p role="alert" className="rounded-xl border-2 border-red-400 px-4 py-4 text-base font-bold">
          Sistema sin datos, usar SMN.{" "}
          <a className="underline" href="https://www.smn.gob.ar/alertas">Consultá el SMN</a>.
        </p>
      </main>
    );
  }
}
