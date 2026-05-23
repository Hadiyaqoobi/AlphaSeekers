# AlphaSeekers Logo

Sahar-delivered logo (2026-05-23). Replaces all earlier SVG drafts.

## Design

Book inside a monitor + green/blue swoosh + "AlphaSeekers" wordmark.
Color: green-blue gradient. Background: transparent / white.

## Files

### Wordmark (icon + "AlphaSeekers" text — use everywhere except tiny mockups)

| File | Pixel size (h) | File size | Use case |
|------|----------------|-----------|----------|
| `wordmark-96.png` | 96px | 11 KB | Navbar, footer, mobile nav, admin sidebar, layout header (display 36–40px) |
| `wordmark-192.png` | 192px | 40 KB | Login splash, register splash (display 48–56px) |
| `wordmark-384.png` | 384px | 170 KB | Reserved — large hero / cert headers (not yet used) |
| `wordmark-full.png` | 650px | 446 KB | Source / print master. Do not embed in pages. |

Aspect ratio ~1.265 (width / height). Set `height` and let `width` follow at
`height × 1.265` rounded.

### Icon-only (no wordmark text — for tiny mockups + favicon + PWA)

| File | Pixel size (h) | File size | Use case |
|------|----------------|-----------|----------|
| `icon-64.png` | 64px | 7 KB | Hero / HowItWorks mockup illustrations (display 28px) |
| `icon-192.png` | 192px | 47 KB | Also copied to `public/icon-192.png` for PWA manifest |
| `icon-512.png` | 512px | 363 KB | Also copied to `public/icon-512.png` for PWA manifest |
| `favicon-32.png` | 32px | 3 KB | Browser favicon |
| `favicon-48.png` | 48px | 4 KB | Browser favicon + PWA manifest fallback |

## Where it's used in code

Wordmark spots — `<span>AlphaSeekers</span>` was removed since the wordmark
image contains the text:

- `src/app/[locale]/layout.tsx` — student-area header
- `src/app/[locale]/login/page.tsx` — login splash
- `src/app/[locale]/register/page.tsx` — register splash (top + mobile)
- `src/components/landing/Navbar.tsx` — public navbar (desktop + mobile menu)
- `src/components/landing/Footer.tsx` — public footer
- `src/components/admin/sidebar.tsx` — admin sidebar
- `src/components/public/mobile-nav.tsx` — mobile drawer

Icon-only spots (28×28 inside mockup illustrations — wordmark unreadable at
that size; surrounding mockup text is intentional, it represents the live
navbar layout):

- `src/components/landing/Hero.tsx`
- `src/components/landing/HowItWorks.tsx`

Favicon + PWA icon refs:

- `src/app/layout.tsx` — `icons.icon` array
- `src/app/manifest.ts` — `icons` array
- `public/icon-192.png`, `public/icon-512.png` — PWA install icons

## Known follow-ups

- **Certificates** — `design-drafts/certificates-v3-final/` has the wordmark
  embedded; no runtime cert-issuance flow yet.

## Brand colors (unchanged)

| Token | Hex | Use |
|-------|-----|-----|
| `--brand-green` | `#00E676` | Primary brand. CTA buttons, focus rings, success state. |
| `--brand-teal`  | `#00E5FF` | Gradient mid-tone. |
| `--brand-blue`  | `#2979FF` | Gradient end-tone. |
| `--brand-ink`   | `#0A1118` | Dark background slate. |
| `--brand-text`  | `#E8EEF2` | Body text on dark. |
| `--brand-muted` | `#8899A6` | Secondary text on dark. |

## Superseded files (deleted 2026-05-23)

`favicon.svg`, `mark-light.svg`, `mark-dark.svg`, `mark-mono.svg`,
`wordmark-light.svg`, `wordmark-dark.svg`, `wordmark-bilingual.svg`,
`preview.html`. Earlier draft iterations live under `design-drafts/logos/`,
`logo-v2/`, `logo-v3/` — kept for design history only.
