# AlphaSeekers — Logo System

## The mark

A single, bold "A" — interpreted as a mountain silhouette — with a small
star above it. Three meanings, one shape:

- **A** is for AlphaSeekers.
- The **mountain** is Afghanistan: the place every student is calling
  home from.
- The **star** above the apex is what every Seeker is reaching for —
  education, the goal that's been put out of reach. It rises into a
  green-to-teal-to-blue gradient that reads as **dawn**: light coming
  back after a long dark.

The crossbar of the A doubles as a horizon line. It tells the eye that
this is a place at the start of something.

## Files

| File | Use |
|------|-----|
| `mark-light.svg`        | Primary square mark on the green/teal gradient. Use on neutral or photographic backgrounds. |
| `mark-dark.svg`         | Same shape, gradient on dark slate. Use on the app's dark surfaces. |
| `mark-mono.svg`         | Single-color (`currentColor`). Embroidery, stencils, low-res print, anywhere you can't render a gradient. |
| `wordmark-light.svg`    | Mark + "AlphaSeekers" + tagline. Light layout. For docs, slides, light-mode UI. |
| `wordmark-dark.svg`     | Same lockup on dark. For the app header, README hero. |
| `wordmark-bilingual.svg`| English + Dari (`آلفاسیکرز`) lockup. Use anywhere both languages co-exist. |
| `favicon.svg`           | 64×64 simplified version. Replaces `favicon.ico` for modern browsers. |

All SVGs are under 2 KB each. They scale infinitely and ship clean
through Render's CDN.

## Brand colors

| Token | Hex | Use |
|-------|-----|-----|
| `--brand-green`  | `#00E676` | Primary brand. CTA buttons, focus rings, success state. |
| `--brand-teal`   | `#00E5FF` | Gradient mid-tone. |
| `--brand-blue`   | `#2979FF` | Gradient end-tone. Long-distance horizon. |
| `--brand-ink`    | `#0A1118` | Dark background slate. |
| `--brand-text`   | `#E8EEF2` | Body text on dark. |
| `--brand-muted`  | `#8899A6` | Secondary text on dark. |

The gradient `linear-gradient(135deg, #00E676 0%, #00E5FF 55%, #2979FF 100%)`
is the canonical brand gradient. Re-use it; don't sample new colors out of it.

## Typography

- **Display / mark** — Plus Jakarta Sans, weight 800 (extrabold).
- **Body** — Inter, weight 400–600.
- **Dari / Persian** — Vazirmatn, with Noto Sans Arabic fallback.

The wordmark SVGs reference these system-fallback font stacks. If
Plus Jakarta Sans isn't installed (e.g. some print pipelines), the
mark falls back to Inter, then to system UI fonts — the layout still
holds.

## Don'ts

- **Don't** add a drop shadow, outer glow, or 3D effect. The mark is
  meant to read flat.
- **Don't** rotate or skew the A. The vertical apex is the meaning.
- **Don't** swap the green for a different primary. The dawn gradient
  is the brand.
- **Don't** crop the star — it's small but it's the whole point.
- **Don't** stretch the wordmark. The 4:1 aspect ratio (240 mark + 640
  type) is locked.

## Minimum size

| Use | Min height |
|-----|-----------|
| Mark only           | 24 px |
| Wordmark            | 40 px |
| Bilingual lockup    | 64 px |

Below the minimum, switch to `favicon.svg` which is hand-tuned for
small sizes (no gradients, fatter strokes).

## Replacing the existing letterform

The current header logo is a hard-coded `A` glyph on a green tile. To
swap it for the new mark:

```tsx
// before
<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E676] text-sm font-bold text-[#080D12]">A</span>

// after
<img src="/logo/mark-dark.svg" alt="" width="36" height="36" className="rounded-xl"/>
```

The `<img>` keeps the same footprint, ships the same number of bytes
or fewer, and stays sharp on Retina screens. The current letterform
should remain as a fallback for anywhere the SVG fails to load.

## Provenance

Designed alongside the 2026-04-27 UAT round. The shape is deliberately
simple so it can be embroidered onto a hoodie, etched into a stamp,
shrunk to 16 px, or stenciled by a volunteer with one Sharpie.
