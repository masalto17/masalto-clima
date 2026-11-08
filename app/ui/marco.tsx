export function Marco({
  children,
  accion,
}: {
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:font-semibold"
      >
        Saltar al contenido
      </a>
      <header className="flex items-center justify-between gap-3 border-b-2 border-brand pb-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">MasAlto Clima</h1>
        {accion}
      </header>
      <div id="contenido" className="flex flex-1 flex-col gap-6">
        {children}
      </div>
    </main>
  );
}
