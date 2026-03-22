export default function ClassesLoading() {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="hero-panel p-5 sm:p-6">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 flex gap-2">
          <div className="field h-11 flex-1 animate-pulse bg-slate-100" />
          <div className="h-11 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div className="stat-card p-3" key={i}>
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-6 w-10 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div className="panel panel-strong p-4 sm:p-5" key={i}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-emerald-100" />
                <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="stat-card px-3 py-2">
                <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
                <div className="mt-1 h-6 w-6 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
