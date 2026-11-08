"use client";

import { useFormStatus } from "react-dom";
import { botonPrimarioClass, botonSecundarioClass } from "./estilos";

export function BotonEnviar({
  children,
  pendiente,
  variante = "primario",
}: {
  children: React.ReactNode;
  pendiente: string;
  variante?: "primario" | "secundario";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={variante === "primario" ? botonPrimarioClass : botonSecundarioClass}
    >
      {pending ? pendiente : children}
    </button>
  );
}
