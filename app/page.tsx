import { loadClimateReport } from "@/lib/clima/load";
import { Shell } from "./vista-general";
import { EstadoClima } from "./estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Home() {
  try {
    const report = await loadClimateReport();
    return (
      <Shell>
        <EstadoClima report={report} />
      </Shell>
    );
  } catch {
    return (
      <Shell>
        <p role="alert" className="glass-panel rounded-xl border-red-500/60 px-4 py-3 text-sm font-semibold text-red-100">
          Sistema sin datos, usar SMN.{" "}
          <a className="underline underline-offset-4" href="https://www.smn.gob.ar/alertas">
            Consultá el SMN
          </a>
          .
        </p>
      </Shell>
    );
  }
}
