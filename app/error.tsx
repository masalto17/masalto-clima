"use client";

import { Marco } from "./ui/marco";
import { Aviso } from "./ui/piezas";
import { SMN_URL, botonPrimarioClass, botonSecundarioClass } from "./ui/estilos";

export default function ErrorPagina({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Marco>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Aviso titulo="No se pudo cargar la página" tituloEtiqueta="h2">
          Probá de nuevo. Si sigue igual, usá el pronóstico del SMN.
        </Aviso>
        <button type="button" onClick={() => reset()} className={botonPrimarioClass}>
          Reintentar
        </button>
        <a href={SMN_URL} rel="noopener noreferrer" className={botonSecundarioClass}>
          Abrir el pronóstico del SMN
        </a>
      </div>
    </Marco>
  );
}
