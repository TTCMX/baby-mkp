// Placeholders shown instantly while a page loads (route `loading.tsx` files).
// Next prefetches them, so a tap changes the screen right away.

function Bar({ className }: { className: string }) {
  return <div className={`rounded-full bg-muted ${className}`} />;
}

export function GridSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse space-y-5">
      {title && <Bar className="h-8 w-56" />}
      <Bar className="h-10 w-full max-w-md" />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2.5 rounded-[22px] border-[1.5px] bg-card p-2 pb-3.5">
            <div className="aspect-square rounded-2xl bg-muted" />
            <Bar className="mx-1.5 h-4 w-3/4" />
            <Bar className="mx-1.5 h-5 w-1/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse md:grid md:grid-cols-2 md:gap-8">
      <div className="aspect-square rounded-[22px] bg-muted" />
      <div className="mt-4 space-y-3 md:mt-0">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-4/5" />
        <Bar className="h-8 w-32" />
        <div className="flex gap-2">
          <Bar className="h-7 w-24" />
          <Bar className="h-7 w-24" />
        </div>
        <div className="h-12 rounded-full bg-muted" />
        <div className="h-40 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="mx-auto max-w-xl animate-pulse space-y-5">
      <Bar className="h-8 w-48" />
      <div className="divide-y rounded-2xl border bg-card" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="size-12 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-2/3" />
              <Bar className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
