/**
 * Lightweight, dependency-free chart primitives for the Super Admin console.
 *
 * Everything is pure inline SVG / CSS so it satisfies the platform CSP (no
 * external scripts) and works in both server and client component trees (no
 * hooks, no "use client"). All primitives are theme-consistent (light cards,
 * neon accent) and accessible (role/aria + visible numeric labels).
 */

const NEON = "#00C853"; // neon-600

export type SparkPoint = { day: string; count: number };

/**
 * Compact area/line trend. Renders full-width; the caller shows the headline
 * number next to it, so the sparkline itself is decorative-but-labelled.
 */
export function Sparkline({
  points,
  color = NEON,
  height = 48,
  label,
}: {
  points: SparkPoint[];
  color?: string;
  height?: number;
  label?: string;
}) {
  const width = 260;
  const pad = 4;
  const data = points.length > 0 ? points : [{ day: "", count: 0 }];
  const max = Math.max(...data.map((d) => d.count), 1);
  const chartH = height - pad * 2;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

  const coords = data.map((d, i) => ({
    x: pad + i * stepX,
    y: pad + chartH - (d.count / max) * chartH,
  }));
  const line = coords
    .map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)},${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`))
    .join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L ${last.x.toFixed(1)},${(pad + chartH).toFixed(1)} L ${first.x.toFixed(1)},${(pad + chartH).toFixed(1)} Z`;

  const total = data.reduce((s, d) => s + d.count, 0);
  const aria = label ?? `Trend over ${data.length} days, ${total.toLocaleString()} total, peak ${max.toLocaleString()}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={aria}
    >
      <path d={area} fill={color} fillOpacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={2.75} fill={color} />
    </svg>
  );
}

/** Horizontal CSS bar list with a label + numeric value per row. */
export function BarChart({
  data,
  color = NEON,
  formatValue,
  emptyLabel = "No data yet",
}: {
  data: { label: string; value: number }[];
  color?: string;
  formatValue?: (n: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const shown = formatValue ? formatValue(d.value) : d.value.toLocaleString();
        return (
          <li key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium capitalize text-gray-700">{d.label}</span>
              <span className="tabular-nums text-gray-500">{shown}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-100"
              role="img"
              aria-label={`${d.label}: ${shown}`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: color, minWidth: d.value > 0 ? "3px" : "0" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A 0..1 progress meter with an accessible progressbar role. */
export function Meter({
  value,
  label,
  caption,
  color = NEON,
}: {
  value: number;
  label?: string;
  caption?: string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const pct = clamped * 100;
  const shownPct = `${Number(pct.toFixed(1))}%`;
  return (
    <div>
      {(label || caption) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label ? <span className="font-medium text-gray-700">{label}</span> : <span />}
          <span className="tabular-nums font-semibold text-gray-900">{caption ?? shownPct}</span>
        </div>
      )}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "meter"}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
