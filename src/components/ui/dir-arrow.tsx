/**
 * A direction-aware arrow for "go on" / "go back" links and buttons.
 *
 * A hard-coded "→" points the wrong way in Dari (RTL): "next" should point
 * left there. This mirrors the glyph under any [dir="rtl"] ancestor, so the
 * same markup reads correctly in both languages. Decorative only.
 */
export function DirArrow({ back = false, className = "" }: { back?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-block rtl:-scale-x-100 ${className}`.trim()}>
      {back ? "←" : "→"}
    </span>
  );
}
