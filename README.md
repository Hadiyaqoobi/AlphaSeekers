# AlphaSeekers Platform

Implementation aligned to the BRD/FRD (`AlphaSeekers_BRD_FRD_v2.docx`) with a production-style architecture and Afghanistan-first constraints (mobile-first, RTL, low-bandwidth, free-tier mindset).

## Implemented modules

- Dari/English locale routing with RTL support.
- Role-based auth (student/teacher/admin) via NextAuth credentials + JWT.
- Program sections:
  - Classes (catalog, detail, enroll/unenroll, materials)
  - Webinars (list, register, admin create)
  - Opportunities (student browse + filter, admin post)
  - Library (student search/download, admin add)
- Teacher availability management with local autosave + API persistence.
- Admin class management (create/list/archive-ready APIs).
- Scheduler pipeline (`/api/cron/scheduler`) with 10-class batch processing and Meet link generation stubs.
- Notification fallback chain (WhatsApp -> Email -> Platform) with retry + circuit breaker logic.
- Student dashboard with Join-Now banner and offline schedule cache.
- Service worker + schedule cache for offline viewing.
- API surface for all major BRD entities and workflows.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Open:

- `http://localhost:3005/fa`
- `http://localhost:3005/en`

## Demo credentials

- `admin@alphaseekers.org` / `admin123`
- `teacher@alphaseekers.org` / `teacher123`
- `student@alphaseekers.org` / `student123`

## Important notes

- Port: `npm run dev` defaults to `3005` (`PORT=3005 npm run dev` to override explicitly).
- Node: the repo wraps Next/Prisma commands with Node 20 via `npx -p node@20...` to avoid issues on newer system Node versions.
- App mode: controlled via `ALPHASEEKERS_MODE` in `.env.local`.
  - `demo` (default): enables demo auth, auto-seeding, mock Meet links, and DB -> memory fallback (fast local/dev UX).
  - `production`: disables the above patches so the DB + integrations are the system of truth.
- Data store:
  - demo mode: uses PostgreSQL via Prisma when `DATABASE_URL` is set and reachable; otherwise falls back to an in-memory store.
  - production mode: DB fallback is disabled by default (hard failures instead of silently switching).
- Approval gate: new students/teachers must be approved by an admin before they can sign in (`/fa/admin/users`).
- Integrations (optional): Google Calendar/Meet, WhatsApp Cloud API, Resend.
  - demo mode: missing config uses safe fallbacks (including mock Meet links).
  - production mode: missing Google config results in `meetLinkStatus=PENDING` and no link (no fake links shown).
- Admin diagnostics: `GET /api/admin/system-status` (admin session required) returns mode + integration configuration booleans + store fallback state.
- User stories: see `docs/user-stories.md` and run `npm run stories` (alias: `npm run smoke`) to validate the main admin/teacher/student scenarios end-to-end.
- If dev starts failing with missing `.next` chunks after running multiple Next commands, run `npm run clean` then restart `npm run dev`.
