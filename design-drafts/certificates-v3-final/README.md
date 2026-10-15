# Certificate Templates — v3 Final (Sahar-approved)

These are the final approved certificate designs delivered 2026-05-23.
Supersedes `../certificates-v2/` SVG drafts and `../certificates/` initial drafts.

## Files

| File | Use case | Orientation | Size |
|------|----------|-------------|------|
| `student-completion-certificate.png` | Certificate of Completion (per-class, awarded to students who finish) | Landscape A4 (2000×1414) | 969 KB |
| `teacher-recognition-certificate.png` | Certificate of Recognition for Teaching Service | Portrait A4 (1414×2000) | 383 KB |

## Design system

- **Palette**: green + gold geometric border, white background
- **Signatures**: Sahar Nikzad + Shahla Jalili, both labeled "Co-founder of ASO"
- **Logo**: AlphaSeekers wordmark embedded
- **QR / verify ID**: placeholder in template — needs to be generated per-issuance

## Status

- ✅ Sahar approved 2026-05-23
- ✅ **Wired into the app (2026-10-15).** Staff issue certificates from a class page
  (Certificates section). Each one has its own ID and QR code; the QR opens
  `/en/verify/<ID>`, which shows the drawn certificate with "Download image" and
  "Print or save as PDF". Staff can cancel one; its page then says so.
  - Blank copies of these designs (placeholder text removed) are in
    `public/certificates/templates/`. Text positions: `src/lib/certificates/layout.ts`.
  - Nothing is stored but a small database row; the certificate is drawn on demand.

## Superseded drafts (do not use)

- `../certificates-v2/student-template-v2.svg` — superseded
- `../certificates-v2/teacher-template-v2.svg` — superseded
- `../certificates/student-template.svg` — superseded
- `../certificates/teacher-template.svg` — superseded
