import { entrarConLink } from "./actions";
import { BotonEnviar } from "../ui/boton";
import { AbrirBot, Aviso, Comando } from "../ui/piezas";
import { Shell } from "../ui/shell";

const ERRORES: Record<string, { titulo: string; detalle: React.ReactNode }> = {
  link: {
    titulo: "El link venció o ya se usó",
    detalle: (
      <>
        Mandale <Comando>/web</Comando> al bot para pedir otro.
      </>
    ),
  },
  acceso: {
    titulo: "Esta cuenta no tiene acceso a MasAlto Clima",
    detalle: (
      <>
        Si tenés otro mail habilitado, pedí un link nuevo con <Comando>/web</Comando>.
      </>
    ),
  },
};

// El canje va por POST (botón), no al abrir el link: así una vista previa o un
// escáner de links no gasta el token.
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string }>;
}) {
  const { t, error } = await searchParams;
  const fallo = error ? (ERRORES[error] ?? {
    titulo: "Algo salió mal",
    detalle: (
      <>
        Mandale <Comando>/web</Comando> al bot para pedir otro link.
      </>
    ),
  }) : null;

  return (
    <Shell>
      <section aria-labelledby="entrar-titulo" className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h2 id="entrar-titulo" className="text-xl font-bold tracking-tight">
          Entrar
        </h2>
        {fallo ? (
          <>
            <Aviso titulo={fallo.titulo}>{fallo.detalle}</Aviso>
            <AbrirBot>Abrir el bot</AbrirBot>
          </>
        ) : !t ? (
          <>
            <p className="text-base leading-relaxed">
              Para entrar sin poner el mail, mandale <Comando>/web</Comando> al bot. Te responde con un
              link: abrilo y tocá Entrar.
            </p>
            <AbrirBot>Abrir el bot</AbrirBot>
          </>
        ) : (
          <form action={entrarConLink} className="flex flex-col gap-4">
            <p className="text-base leading-relaxed">
              Este link es de un solo uso. Tocá Entrar para abrir la sesión en este dispositivo.
            </p>
            <input type="hidden" name="t" value={t} />
            <BotonEnviar pendiente="Entrando…">Entrar</BotonEnviar>
          </form>
        )}
      </section>
    </Shell>
  );
}
