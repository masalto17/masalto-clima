import { allowedEmails } from "@/lib/env";
import { loadOverview } from "@/lib/forecast/queries";
import { createSessionClient } from "@/lib/supabase/server";
import { ingresar } from "./actions";
import { BotonEnviar } from "./ui/boton";
import { AbrirBot, Aviso, CampoMail, Comando } from "./ui/piezas";
import { Shell } from "./ui/shell";
import { VistaGeneral } from "./vista-general";

export const dynamic = "force-dynamic";

function Ingreso({ estado }: { estado?: string }) {
  return (
    <Shell>
      <section aria-labelledby="ingreso-titulo" className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h2 id="ingreso-titulo" className="text-xl font-bold tracking-tight">
          Entrar
        </h2>
        {estado === "mail" ? (
          <Aviso titulo="Revisá el mail" tono="ok" role="status">
            Si el mail está habilitado, te llegó un link de ingreso. Abrilo en este dispositivo. Si no
            llega en unos minutos, mirá el spam.
          </Aviso>
        ) : (
          <>
            <p className="text-base leading-relaxed">
              ¿Tenés Telegram vinculado? Mandale <Comando>/web</Comando> al bot y entrás sin poner el
              mail.
            </p>
            <AbrirBot>Abrir el bot</AbrirBot>
            <div className="flex items-center gap-3 text-sm font-semibold text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              o
              <span className="h-px flex-1 bg-line" />
            </div>
            <form action={ingresar} className="flex flex-col gap-4">
              <CampoMail leyenda="Tu mail" />
              <BotonEnviar pendiente="Enviando…" variante="secundario">
                Mandame el link de ingreso
              </BotonEnviar>
            </form>
          </>
        )}
      </section>
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
