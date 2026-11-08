import { Shell } from "./ui/shell";

export default function Cargando() {
  return (
    <Shell>
      <p role="status" className="text-base font-semibold">
        Cargando…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4 motion-reduce:animate-none">
          <div className="h-4 w-36 rounded bg-foreground/15" />
          <div className="mt-4 h-8 w-44 rounded-lg bg-foreground/15" />
          <div className="mt-4 h-3 w-full max-w-prose rounded bg-foreground/15" />
          <div className="mt-2 h-3 w-4/5 max-w-prose rounded bg-foreground/15" />
          <div className="mt-2 h-3 w-3/5 max-w-prose rounded bg-foreground/15" />
        </div>
      </div>
    </Shell>
  );
}
