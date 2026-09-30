import { allowedEmails } from "@/lib/env";
import { loadOverview } from "@/lib/forecast/queries";
import { createSessionClient } from "@/lib/supabase/server";
import { ingresar } from "./actions";
import { Shell, VistaGeneral } from "./vista-general";

export const dynamic = "force-dynamic";

const inputClass = "rounded border border-current/30 bg-transparent px-3 py-2";
const buttonClass = "rounded bg-foreground px-4 py-2 font-semibold text-background";

function Ingreso({ estado }: { estado?: string }) {
  return (
    <Shell>
      {estado === "mail" ? (
        <p>Si el mail está habilitado, te llegó un link de ingreso. Abrilo en este dispositivo.</p>
      ) : (
        <div className="flex max-w-sm flex-col gap-5">
          <p>
            ¿Tenés Telegram vinculado? Mandale <strong>/web</strong> al bot y entrás sin poner el
            mail.
          </p>
          <form action={ingresar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              O con tu mail
              <input type="email" name="email" required autoComplete="email" className={inputClass} />
            </label>
            <button type="submit" className={buttonClass}>
              Mandame el link de ingreso
            </button>
          </form>
        </div>
      )}
    </Shell>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth se comparte con Handy: exigir mail confirmado y habilitado.
  const email = user?.email?.toLowerCase();
  if (!user || !email || !user.email_confirmed_at || !allowedEmails().includes(email)) {
    return <Ingreso estado={estado} />;
  }

  const now = new Date();
  const overview = await loadOverview(supabase, now);

  return (
    <Shell email={email}>
      <VistaGeneral overview={overview} now={now} />
    </Shell>
  );
}
