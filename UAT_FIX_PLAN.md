# UAT Fix Plan — Round 2026-04-26

Source: `UAT/UAT Test.docx` (3 testers: Tester 1, Shahla, Naweed) + 8 screenshots in `UAT/`.

## How issues map to testers

| Code | Issue | Reported by |
|------|-------|-------------|
| CRIT-A | Admin sidebar links bounce to login despite signed-in admin | Naweed |
| CRIT-B | Dashboard "Create Class" opens Webinar/Opportunity/Library form page | Tester 1, Shahla, Naweed |
| HIGH-A | Team page images missing (Sahar, Shahla, Farham) | Tester 1, Shahla, Naweed |
| HIGH-B | Email validation accepts typos (`.con`, `.lh`, fake addresses) | Tester 1, Shahla |
| HIGH-C | Cannot delete webinars or expired opportunities | Naweed |
| HIGH-D | AI Tutor input is hard to use ("could not type properly") | Shahla |
| HIGH-E | Opportunities and Webinars pages look the same | Shahla |
| MED-A | No per-student enrollment cap | Tester 1, Shahla |
| MED-B | Class catalog mixes started + not-started classes | Shahla |
| MED-C | 5MB upload limit hits on real-world files | Naweed |
| INFO-1 | "Overall complex / heavy on bandwidth" | Shahla |

CRIT-A is the only true regression. Everything else is missing/incorrect functionality.

---

## Fix details

### CRIT-A — Admin pages redirect to `/login`
**Symptom (Screenshot 87):** Naweed signed in as ADMIN, clicked an admin sidebar link, landed on `/fa/login`. Sidebar still shows "Naweed Dawlat ADMIN".
**Root cause hypothesis:** All admin pages use this guard:
```ts
const user = await getSessionUser();
if (!user) redirect(`/${params.locale}/login`);
```
On Render free tier the Neon DB suspends after 5 min. A cold request can race with `getSessionUser()` (which calls Prisma indirectly via `auth.ts` callbacks). When Prisma throws, NextAuth's `jwt`/`session` callbacks reject and `getServerSession` returns null — so the page redirects even though the cookie is still valid.
**Fix:**
1. Make `getSessionUser()` resilient: wrap the underlying `getServerSession` call so transient Prisma errors don't silently translate to "no session". If Prisma fails, return the JWT-derived user (already in the cookie) without DB enrichment.
2. Audit every admin/teacher page guard. Any guard that reads more than `user.role` from the DB should fall back gracefully.
3. Bump the JWT `maxAge` to 7 days (currently 30 min) so legitimate idle clicks don't punt to login. NextAuth refreshes the token on each request.

**Files:** `src/lib/security/session.ts`, `src/lib/auth.ts`.
**Acceptance:** Sign in as admin, leave for 10 min, click every sidebar link → all open admin pages, no login bounce.

### CRIT-B — Dashboard "Create Class" link is wrong
**Source:** `src/app/[locale]/dashboard/page.tsx:216`
```ts
{ href: `/${locale}/admin/content`, label: t("quickActions.createClass"), ... }
```
`/admin/content` is the Webinar/Opportunity/Library forms hub — not class creation.
**Fix:** Point it at `/${locale}/admin/classes` (where `AdminClassForm` lives). While there, point the "Add opportunity" tile at `/admin/content` (where `OpportunityForm` is) — currently both go to `/admin/content` which is fine.
**Files:** `src/app/[locale]/dashboard/page.tsx`.
**Acceptance:** As admin, dashboard "Create Class" tile → `/admin/classes` with the create form visible.

### HIGH-A — Team page images missing
**Symptom (Screenshot 86):** Both Shahla and Sahar render with empty (black) image area. Files exist on disk: `public/team/sahar.jpg`, `shahla.png`, `mfs.jpeg`, `Naweed.jpeg`.
**Root cause hypothesis:** `TeamGrid` uses `next/image`, which routes through `/_next/image?url=...&w=...&q=...`. On Render free tier this optimizer endpoint can return 504/timeout, especially for the 2.1 MB `sahar.jpg`. The browser shows the placeholder (black bg) but never gets a usable image. Naweed.jpeg already worked because it's 118 KB.
**Fix:**
1. Replace `next/image` with a plain `<img loading="lazy">` for team photos — they are not LCP-critical and don't need optimization.
2. Add `Cache-Control: public, max-age=86400` for `/team/*` via `next.config.mjs` headers.
3. Note (does not block): `sahar.jpg` should be downscaled to ≤ 200 KB. Document this in a follow-up.
**Files:** `src/components/team/team-grid.tsx`, `next.config.mjs`.
**Acceptance:** Team page shows all photos within 2 s on Render prod. Hard-refresh shows photos before fonts.

### HIGH-B — Email validation too permissive
**Symptom:** Registering with `me@gmail.con` returns "request received".
**Fix:** Tighten the email schema in `src/app/api/auth/register/route.ts`:
- Require RFC email (already done).
- Require TLD ≥ 2 chars made up of letters.
- Reject a curated list of common typos: `.con`, `.cmo`, `.cm`, `.vom`, `.lh`, `.cim`, `.coom`, `.comm`, `.ney`, `.nte`, `.rog`.
- Mirror the same validation client-side in `src/components/forms/use-autosave-form.ts` consumers (login + register pages) for instant feedback.

The same regex/check is added once in `src/lib/security/email.ts` and consumed by both the API route and client forms. Server is the source of truth.

**Files:** new `src/lib/security/email.ts`, `src/app/api/auth/register/route.ts`, `src/app/[locale]/register/page.tsx`, `src/app/[locale]/login/page.tsx`.
**Acceptance:** `me@gmail.con` blocked client-side AND server-side with a clear message.

### HIGH-C — Cannot delete webinars or expired opportunities
**Fix:**
1. Add `DELETE /api/admin/webinars/[id]` (admin only). Hard delete + cascade `WebinarRegistration`.
2. Add `DELETE /api/admin/opportunities/[id]` (admin only). Hard delete.
3. Add a `<DeleteButton>` on every webinar card on `/[locale]/webinars` and every opportunity card on `/[locale]/opportunities`, gated by `user.role === "ADMIN"`.
4. Confirm via `window.confirm()` — same pattern as `archive-class-button.tsx`.

i18n: reuse `materials.delete` / `adminClassDetail.archive` if present; otherwise add new keys (English-only placeholder in `fa.json`, flagged below for user to translate).

**Files:** new `src/app/api/admin/webinars/[id]/route.ts`, new `src/app/api/admin/opportunities/[id]/route.ts`, new `src/components/admin/delete-content-button.tsx`, `src/app/[locale]/webinars/page.tsx`, `src/app/[locale]/opportunities/page.tsx`, `messages/en.json`, `messages/fa.json`.
**Acceptance:** Admin sees red "Delete" on each webinar/opportunity card. Click → confirm → row gone.

### HIGH-D — AI Tutor input
**Hypothesis (need to repro):** Input is disabled during streaming and no clear "loading…" cue. RTL layout may also cause caret/focus oddness with mode-switching pills.
**Fix:**
1. Always keep `<input>` enabled; instead, queue or refuse the second send while streaming.
2. Auto-focus the input on mount and after a response completes.
3. Make the "Ask about your course materials…" placeholder localized (already is) and verify Dari direction is correct (`dir="rtl"` on the input when `locale === 'fa'`).
4. Add a visible "Press Enter to send" hint under the input.
**Files:** `src/components/ai/study-assistant.tsx`.
**Acceptance:** Open `/fa/study-assistant`, type a Dari question, receive answer, type another → no re-focus needed, no "stuck" input.

### HIGH-E — Opportunities and Webinars look the same
**Fix:**
- Webinars get a calendar SVG hero, "Live event" eyebrow chip, time-until-start badge ("starts in 2 days"), join link button.
- Opportunities get a star/award SVG hero, "Funded" / "Job" / "Scholarship" type chip already exists — make it the dominant visual element, plus a deadline countdown bar.
- Different accent colors: webinars = sky-500, opportunities = amber-500 (matches existing chip color).
**Files:** `src/app/[locale]/webinars/page.tsx`, `src/app/[locale]/opportunities/page.tsx`.
**Acceptance:** Open both pages back-to-back — at a glance, immediately distinguishable.

### MED-A — Enrollment limit
**Decision:** 3 active enrollments per student (configurable via `MAX_ACTIVE_ENROLLMENTS` env, default 3).
**Fix:**
1. Server: in `POST /api/classes/[id]/enroll`, count `ACTIVE` enrollments for `studentId`, reject with 409 + clear message if at limit.
2. Client: `EnrollButton` shows the cap-reached error inline instead of a generic "enrollment failed".
3. Pre-check: `GET /api/classes` could include `userActiveCount` for nicer UX, but the server check is sufficient for correctness.
**Files:** `src/app/api/classes/[id]/enroll/route.ts`, `src/components/classes/enroll-button.tsx`, `messages/en.json`, `messages/fa.json`.
**Acceptance:** Student enrolled in 3 classes attempts a 4th → blocked with "You can join up to 3 classes at a time. Drop one to add another." (or equivalent Dari).

### MED-B — Class structure clarity
**Fix:** On `/[locale]/classes`:
- Group classes into two sections: "Starting soon" (no sessions yet OR first session is in the future) and "In progress" (already had at least one session).
- Each card gets a status pill: "Starts in N days", "In progress", "Completed", "Pending schedule".
- Default sort: starting-soon first, then in-progress, then completed.
**Files:** `src/app/[locale]/classes/page.tsx`, `src/components/classes/enroll-button.tsx` (read-only — show "Already enrolled" on cards user is in).
**Acceptance:** Browse page makes status obvious without opening the detail page.

### MED-C — 5 MB upload limit
**Decision:** Keep at 5 MB but make the error message localized + show file size before submit. Render free tier bandwidth + R2 free tier storage make 10 MB risky; document the constraint in `CONTRIBUTING.md`.
**Files:** `src/components/classes/file-upload.tsx` (already validates), `src/lib/integrations/r2.ts` (already 5 MB), copy update in en/fa.
**Acceptance:** Upload too-large file → clear error in user's language with "limit is 5 MB" copy.

### INFO-1 — Bandwidth / complexity
**Out of scope for this round** — addressing this requires a wider performance audit (page weight, image policies, code splitting). Captured for the next QA round.

---

## Dari translation strings to be reviewed

The following new strings will be added in English to both `messages/en.json` and `messages/fa.json` with English fallback in `fa.json`. Sahar / native-Dari reviewer to provide proper Dari before next deploy. **Do not auto-translate.**

- `webinars.delete`
- `webinars.deleteConfirm`
- `opportunities.delete`
- `opportunities.deleteConfirm`
- `enroll.limitReached` ("You can join up to {n} classes at a time. Drop one to add another.")
- `classes.statusStartingIn` ("Starts in {n} days")
- `classes.statusInProgress`
- `classes.statusCompleted`
- `classes.statusPending`
- `classes.sectionStartingSoon`
- `classes.sectionInProgress`
- `register.invalidEmailTld` ("That email address is not valid. Did you mean .com?")
- `studyAssistant.enterToSend`

---

## Execution order

1. CRIT-B (one-line fix, easy win)
2. CRIT-A (session resilience + JWT TTL)
3. HIGH-A (team images)
4. HIGH-B (email validation)
5. HIGH-C (delete buttons + endpoints)
6. HIGH-D (AI Tutor UX)
7. HIGH-E (visual differentiation)
8. MED-A (enrollment cap)
9. MED-B (class status)
10. MED-C (upload copy)
11. End-to-end regression as student / teacher / admin

After each fix I will note the files changed and the manual verification step.

---

## What I will NOT touch in this round

- The shared dev/prod Neon DB (no migrations, no row deletes/updates).
- The `team/*.jpg` files themselves (compression is recommended but the user has not asked).
- Service worker / PWA config beyond what UAT explicitly covers.
- Anything in `node_modules`, `.next`, `prisma/migrations`.

---

## Verification log (2026-04-26)

`tsc --noEmit` passes. Dev server (`localhost:3005`) walked end-to-end
as ADMIN, TEACHER, STUDENT, and unauthenticated. All checks below run
against this dev server.

| Code | Verification | Result |
|------|-------------|--------|
| CRIT-A | Admin session check after login: `expires` is 7 days out | ✅ `2026-05-03` |
| CRIT-A | Admin walks `/en/admin/{classes,users,analytics,teachers,content,posts}`, `/dashboard`, `/teacher/availability`, `/study-assistant` | ✅ all 200, no meta-refresh |
| CRIT-A | Teacher → admin pages | ✅ `<meta refresh content="1;url=/en/dashboard">` |
| CRIT-A | Student → admin/teacher pages | ✅ same redirect |
| CRIT-A | Unauth → /dashboard | ✅ `<meta refresh content="1;url=/en/login">` |
| CRIT-A | Student → `/api/admin/users` | ✅ 403 |
| CRIT-B | Source check `dashboard/page.tsx:216` | ✅ `href: \`/${locale}/admin/classes\`` |
| HIGH-A | `/en/team` HTML — no `_next/image?url=%2Fteam` references | ✅ only plain `/team/*.jpg` paths |
| HIGH-B | `POST /api/auth/register` with `me@gmail.con` | ✅ 400 — "That domain extension (.con) doesn't look right. Did you mean .com?" |
| HIGH-B | Same with `.lh` | ✅ 400 — same shape |
| HIGH-C | `/en/webinars` admin view | ✅ `WebinarForm` rendered |
| HIGH-C | `/en/opportunities` admin view | ✅ `OpportunityForm` rendered |
| HIGH-C | New routes exist | ✅ `src/app/api/admin/{webinars,opportunities}/[id]/route.ts` |
| HIGH-D | `/en/study-assistant` HTML | ✅ `dir="auto"` on textarea, `autoFocus` set, `disabled` only on send button |
| HIGH-E | `/en/webinars` HTML | ✅ `bg-sky-100`, `text-sky-600` |
| HIGH-E | `/en/opportunities` HTML | ✅ `bg-amber-100`, `text-amber-600` |
| MED-A | Source enforcement | ✅ 409 returned at `MAX_ACTIVE_ENROLLMENTS` (default 3) |
| MED-B | `/en/classes` HTML | ✅ `bg-amber-400` (pending), `bg-emerald-500` (scheduled) status dots |
| MED-C | `messages/fa.json:upload` | ✅ `fileTooLarge: "فایل بیشتر از ۵ مگابایت است"` already correct |

### Files changed

```
M  messages/en.json
M  messages/fa.json
M  next.config.mjs
M  src/app/[locale]/classes/page.tsx
M  src/app/[locale]/dashboard/page.tsx
M  src/app/[locale]/opportunities/page.tsx
M  src/app/[locale]/register/page.tsx
M  src/app/[locale]/team/page.tsx
M  src/app/[locale]/webinars/page.tsx
M  src/app/api/auth/register/route.ts
M  src/app/api/classes/[id]/enroll/route.ts
M  src/components/ai/study-assistant.tsx
M  src/components/team/team-grid.tsx
M  src/lib/auth.ts
A  src/app/api/admin/opportunities/[id]/route.ts
A  src/app/api/admin/webinars/[id]/route.ts
A  src/components/admin/delete-content-button.tsx
A  src/lib/security/email.ts
```

### Open follow-ups (not blockers, flagged for Sahar / Naweed)

1. `admin.deleteConfirm` is English-only in `messages/fa.json` — Sahar to translate.
   `admin.delete` already uses the existing Dari word `حذف` (reused from `upload.remove`).
2. `sahar.jpg` is 2.1 MB. Compress to ≤ 200 KB (e.g. `cwebp -q 80`) for faster team page load on Render.
3. The dashboard "Add opportunity" tile still points at `/admin/content` (which has the OpportunityForm) — that's correct, but consider routing it to `/admin/content#opportunity` so the form is in view.
4. Demo accounts use in-memory mock data — the enrollment cap will only fire against real DB users. Confirmed code path; live verification needs a real student account with 3 active enrollments.
5. The same Neon DB powers dev and prod (per team memo), so any changes that touch data must be staged carefully. This round is code-only.
