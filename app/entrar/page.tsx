import { Shell } from "../vista-general";
import { entrarConLink } from "./actions";

const ERRORES: Record<string, string> = {
  link: "El link venció o ya se usó. Mandale /web al bot para pedir otro.",
  acceso: "Esta cuenta no tiene acceso a MasAlto Clima.",
};

// El canje va por POST (botón), no al abrir el link: así una vista previa o un
// escáner de links no gasta el token.
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string }>;
}) {
  const { t, error } = await searchParams;

  return (
    <Shell>
      {error ? (
        <p role="alert">{ERRORES[error] ?? "Algo salió mal. Mandale /web al bot para pedir otro link."}</p>
      ) : !t ? (
        <p>Para entrar sin poner el mail, mandale /web al bot.</p>
      ) : (
        <form action={entrarConLink} className="flex max-w-sm flex-col gap-3">
          <input type="hidden" name="t" value={t} />
          <button
            type="submit"
            className="rounded bg-foreground px-4 py-3 text-lg font-semibold text-background"
          >
            Entrar
          </button>
        </form>
      )}
    </Shell>
  );
}
