export default function DashboardLoading() {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="hero-panel p-5 sm:p-6">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div className="stat-card p-4" key={i}>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-8 w-10 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel panel-strong space-y-3 p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          {[1, 2].map((i) => (
            <div className="stat-card p-3" key={i}>
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="panel panel-strong space-y-3 p-4">
          <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          {[1, 2].map((i) => (
            <div className="stat-card p-3" key={i}>
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
