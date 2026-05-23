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
- ⚠️ **Not yet wired into the app.** Certificates are static templates only. To issue
  them at scale, the app needs:
  1. An API route (e.g. `/api/admin/classes/[id]/issue-certificates`) that for each
     enrolled student with `Enrollment.status = COMPLETED` generates a personalized
     copy by compositing student name + class + date + signed verify ID onto this
     PNG, then emails / displays it.
  2. A `Certificate` Prisma model (id, studentId, classId, type, issuedAt, verifyId,
     fileUrl) so verify-by-QR works.
  3. A public `/verify/[id]` route that looks up the verifyId and confirms validity.

Until that ships, these PNGs are used as-is for hand-issued certificates
(team prints / emails them manually).

## Superseded drafts (do not use)

- `../certificates-v2/student-template-v2.svg` — superseded
- `../certificates-v2/teacher-template-v2.svg` — superseded
- `../certificates/student-template.svg` — superseded
- `../certificates/teacher-template.svg` — superseded
