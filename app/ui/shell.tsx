import { salir } from "../actions";
import { Marco } from "./marco";

export function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <Marco
      accion={
        email ? (
          <form action={salir} className="flex min-w-0 items-center gap-1">
            <span className="max-w-[7.5rem] truncate text-sm text-muted sm:max-w-[16rem]">{email}</span>
            <button
              type="submit"
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold underline-offset-4 hover:underline"
            >
              Salir
            </button>
          </form>
        ) : null
      }
    >
      {children}
    </Marco>
  );
}
