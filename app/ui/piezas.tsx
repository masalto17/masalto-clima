import { BOT_URL, botonPrimarioClass, botonSecundarioClass, campoClass } from "./estilos";

const AVISO: Record<"error" | "ok" | "neutro", string> = {
  error: "border-brand bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
  ok: "border-emerald-800 bg-emerald-50 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-50",
  neutro: "border-line bg-surface text-foreground",
};

export function Aviso({
  titulo,
  children,
  tono = "error",
  role = "alert",
  tituloEtiqueta = "p",
}: {
  titulo: string;
  children: React.ReactNode;
  tono?: "error" | "ok" | "neutro";
  role?: "alert" | "status";
  tituloEtiqueta?: "p" | "h2";
}) {
  const Titulo = tituloEtiqueta;
  return (
    <div role={role} className={`flex flex-col gap-2 rounded-xl border-2 px-4 py-3 ${AVISO[tono]}`}>
      <Titulo className="text-base font-bold leading-snug">{titulo}</Titulo>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Comando({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-block rounded-md border border-line bg-surface px-1.5 py-0.5 align-baseline font-mono text-[0.9em] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

export function AbrirBot({
  variante = "primario",
  children = "Abrir el bot",
}: {
  variante?: "primario" | "secundario";
  children?: React.ReactNode;
}) {
  return (
    <a
      href={BOT_URL}
      rel="noopener noreferrer"
      className={variante === "primario" ? botonPrimarioClass : botonSecundarioClass}
    >
      {children}
    </a>
  );
}

export function CampoMail({ leyenda }: { leyenda: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {leyenda}
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        className={campoClass}
      />
    </label>
  );
}
