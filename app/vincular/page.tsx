import { createSessionClient } from "@/lib/supabase/server";
import { enviarLinkDeIngreso, vincularChat } from "./actions";

const ERRORES: Record<string, string> = {
  codigo: "El código venció o ya se usó. Mandale /start al bot para pedir otro.",
  acceso: "Esta cuenta no tiene acceso a MasAlto Clima.",
  sesion: "No se pudo iniciar la sesión. Pedí un link de ingreso nuevo.",
};

const inputClass = "rounded border border-current/30 bg-transparent px-3 py-2";
const buttonClass = "rounded bg-foreground px-4 py-2 font-medium text-background";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Vincular Telegram</h1>

      {error && <p role="alert">{ERRORES[error] ?? "Algo salió mal. Probá de nuevo."}</p>}

      {estado === "ok" ? (
        <p>Listo: el chat quedó vinculado. Escribile al bot para probar.</p>
      ) : !codigo ? (
        <p>Falta el código. Mandale /start al bot y abrí el link que te responde.</p>
      ) : estado === "mail" ? (
        <p>Si el mail está habilitado, te llegó un link de ingreso. Abrilo en este dispositivo.</p>
      ) : user ? (
        <form action={vincularChat} className="flex flex-col gap-3">
          <input type="hidden" name="codigo" value={codigo} />
          <p>
            Vas a vincular este chat de Telegram con la cuenta <strong>{user.email}</strong>.
          </p>
          <button type="submit" className={buttonClass}>
            Vincular
          </button>
        </form>
      ) : (
        <form action={enviarLinkDeIngreso} className="flex flex-col gap-3">
          <input type="hidden" name="codigo" value={codigo} />
          <label className="flex flex-col gap-1">
            Tu mail
            <input type="email" name="email" required autoComplete="email" className={inputClass} />
          </label>
          <button type="submit" className={buttonClass}>
            Mandame el link de ingreso
          </button>
        </form>
      )}
    </main>
  );
}
