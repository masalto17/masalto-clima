import { createSessionClient } from "@/lib/supabase/server";
import { BotonEnviar } from "../ui/boton";
import { AbrirBot, Aviso, CampoMail, Comando } from "../ui/piezas";
import { Shell } from "../ui/shell";
import { enviarLinkDeIngreso, vincularChat } from "./actions";

const ERRORES: Record<string, { titulo: string; detalle: React.ReactNode }> = {
  codigo: {
    titulo: "El código venció o ya se usó",
    detalle: (
      <>
        Mandale <Comando>/start</Comando> al bot para pedir otro.
      </>
    ),
  },
  acceso: {
    titulo: "Esta cuenta no tiene acceso a MasAlto Clima",
    detalle: "Entrá con el mail habilitado y volvé a abrir el link del bot.",
  },
  sesion: {
    titulo: "No se pudo iniciar la sesión",
    detalle: "Pedí un link de ingreso nuevo y abrilo en este dispositivo.",
  },
};

export default async function VincularPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; estado?: string; error?: string }>;
}) {
  const { codigo, estado, error } = await searchParams;

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fallo = error
    ? (ERRORES[error] ?? {
        titulo: "Algo salió mal",
        detalle: "Probá de nuevo. Si sigue igual, pedile otro código al bot.",
      })
    : null;

  return (
    <Shell>
      <section aria-labelledby="vincular-titulo" className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h2 id="vincular-titulo" className="text-xl font-bold tracking-tight">
          Vincular Telegram
        </h2>

        {fallo && <Aviso titulo={fallo.titulo}>{fallo.detalle}</Aviso>}

        {estado === "ok" ? (
          <>
            <Aviso titulo="Listo: el chat quedó vinculado" tono="ok" role="status">
              Escribile al bot para probar.
            </Aviso>
            <AbrirBot>Abrir el bot</AbrirBot>
          </>
        ) : !codigo ? (
          <>
            <p className="text-base leading-relaxed">
              Falta el código. Mandale <Comando>/start</Comando> al bot y abrí el link que te responde.
            </p>
            <AbrirBot>Abrir el bot</AbrirBot>
          </>
        ) : estado === "mail" ? (
          <Aviso titulo="Revisá el mail" tono="ok" role="status">
            Si el mail está habilitado, te llegó un link de ingreso. Abrilo en este dispositivo. Si no
            llega en unos minutos, mirá el spam.
          </Aviso>
        ) : user ? (
          <form action={vincularChat} className="flex flex-col gap-4">
            <input type="hidden" name="codigo" value={codigo} />
            <p className="text-base leading-relaxed">
              Vas a vincular este chat de Telegram con la cuenta{" "}
              <strong className="break-all">{user.email}</strong>.
            </p>
            <BotonEnviar pendiente="Vinculando…">Vincular</BotonEnviar>
          </form>
        ) : (
          <form action={enviarLinkDeIngreso} className="flex flex-col gap-4">
            <input type="hidden" name="codigo" value={codigo} />
            <CampoMail leyenda="Tu mail" />
            <BotonEnviar pendiente="Enviando…">Mandame el link de ingreso</BotonEnviar>
          </form>
        )}
      </section>
    </Shell>
  );
}
