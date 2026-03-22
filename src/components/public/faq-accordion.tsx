function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

// BRD: use native <details> for a11y + zero JS overhead (works even on slow devices).
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details className="faq-details stat-card overflow-hidden" key={item.id}>
          <summary className="faq-summary flex min-h-11 cursor-pointer items-center justify-between gap-4 px-4 py-3 text-start text-sm font-black text-slate-950">
            <span>{item.question}</span>
            <ChevronIcon className="faq-chevron h-4 w-4 shrink-0 text-emerald-800" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-7 text-slate-700">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
