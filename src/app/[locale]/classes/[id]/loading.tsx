export default function ClassDetailLoading() {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="hero-panel p-5 sm:p-6">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-5 w-20 animate-pulse rounded-full bg-emerald-100" />
        <div className="mt-2 h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="flex gap-2" key={i}>
              <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-11 w-28 animate-pulse rounded-full bg-emerald-100" />
        </div>
      </div>
      <div className="panel panel-strong space-y-3 p-4 sm:p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
        {[1, 2].map((i) => (
          <div className="stat-card p-3" key={i}>
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="panel panel-strong space-y-3 p-4 sm:p-5">
        <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      </div>
    </section>
  );
}
