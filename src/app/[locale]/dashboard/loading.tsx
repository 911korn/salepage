export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="h-8 w-64 max-w-[75vw] animate-pulse rounded bg-zinc-200" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="size-8 animate-pulse rounded-lg bg-zinc-200" />
            </div>
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3.5">
          <div className="h-5 w-36 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-14 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="divide-y divide-[color:var(--color-border)]">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-3">
              <div className="size-9 shrink-0 animate-pulse rounded-xl bg-zinc-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 max-w-full animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
