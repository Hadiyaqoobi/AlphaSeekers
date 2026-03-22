export default function LocaleLoading() {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="hero-panel p-5 sm:p-6">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div className="stat-card p-4" key={i}>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <div className="panel panel-strong p-4 sm:p-5" key={i}>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}
