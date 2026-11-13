import Link from "next/link";
import { loadClimateReport } from "@/lib/clima/load";
import { Historico } from "./historico";

export const dynamic = "force-dynamic";

export default async function EstadisticasPage() {
  const report = await loadClimateReport().catch(() => null);
  return (
    <main className="modo-obra mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-6">
      <Link className="toque w-fit" href="/">Volver</Link>
      <h1 className="text-3xl font-extrabold">Estadísticas</h1>
      <p className="text-base">Esto no es la pantalla de la obra. Acá está el ranking de fuentes y el archivo de años anteriores.</p>
      <section>
        <h2 className="text-2xl font-extrabold">Qué fuente viene mejor</h2>
        <p className="mt-1 text-base">{report?.rankingNote ?? "Sin datos de acierto."}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {(report?.ranking ?? []).map((row) => (
            <li key={row.variable}>
              <p className="font-bold">{row.label}</p>
              {row.entries.length === 0 ? <p>Sin comparaciones todavía.</p> : (
                <ol>
                  {row.entries.map((entry, index) => (
                    <li key={entry.source}>{index + 1}. {entry.label} · error {entry.mae.toFixed(1)} {row.unit} · {entry.samples}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Historico />
    </main>
  );
}
