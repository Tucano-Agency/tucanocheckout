export default function AdminTenantLoading() {
  return (
    <div
      className="animate-pulse space-y-10 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Carregando"
    >
      <header className="border-b border-zinc-100 pb-8">
        <div className="h-9 w-56 max-w-full rounded-lg bg-zinc-200/90" />
        <div className="mt-4 h-4 w-[min(28rem,100%)] max-w-full rounded bg-zinc-100" />
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-30 rounded-2xl bg-zinc-100 ring-1 ring-zinc-50"
          />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}
