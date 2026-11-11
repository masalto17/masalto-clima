import { unstable_cache } from "next/cache";
import { loadOverview } from "@/lib/forecast/queries";
import { loadOfficialAlerts } from "@/lib/smn/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { Shell, VistaGeneral } from "./vista-general";

export const dynamic = "force-dynamic";

// Una lectura compartida cada cinco minutos evita repetir las consultas CAP
// para cada visitante. El cliente con privilegios queda solo en el servidor.
const loadPublicClimate = unstable_cache(async () => {
  const supabase = createAdminClient();
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "MasAlto")
    .limit(2);
  if (error) throw error;
  if (organizations?.length !== 1) throw new Error("La organización pública de MasAlto no es única");
  const now = new Date();
  const overview = await loadOverview(supabase, now, organizations[0].id);
  const officialAlerts = await loadOfficialAlerts(overview.places.map(({ place }) => place), now);
  return { overview, officialAlerts, checkedAt: now.toISOString() };
}, ["masalto-public-climate"], { revalidate: 300 });

export default async function Home() {
  const { overview, officialAlerts, checkedAt } = await loadPublicClimate();
  return (
    <Shell>
      <VistaGeneral overview={overview} officialAlerts={officialAlerts} now={new Date(checkedAt)} />
    </Shell>
  );
}
