import Link from "next/link";
import { botonPrimarioClass } from "./ui/estilos";
import { Marco } from "./ui/marco";
import { Aviso } from "./ui/piezas";

export default function NotFound() {
  return (
    <Marco>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Aviso titulo="Esta página no existe" tituloEtiqueta="h2">
          El enlace está mal o la página se movió.
        </Aviso>
        <Link href="/" className={botonPrimarioClass}>
          Ir al inicio
        </Link>
      </div>
    </Marco>
  );
}
