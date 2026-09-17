# Contributing to AlphaSeekers

Welcome. This file documents the local-development gotchas that aren't
obvious from the code or the README.

---

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npx prisma migrate deploy    # apply schema
npm run dev                  # http://localhost:3005
```

After every Prisma migration that touches the `DocumentChunk` table, restore
the pgvector column manually:

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260413000000_add_rag_vector_store/migration.sql
```

Prisma drops unknown column types on regen — pgvector lives outside its model
mapping, so it has to be re-added by raw SQL after each migration.

---

## Do not keep your working copy in iCloud Drive

Check where you cloned this repo. If the path is under `~/Documents` or
`~/Desktop` and you have macOS "Desktop & Documents Folders" syncing turned on,
every file read goes through the sync daemon and the toolchain effectively
stops working. Measured on this repo, 2026-09-14:

| | reading all of `src/` | `tsc --noEmit` |
|---|---|---|
| `~/Documents/alphaseeker` | **29.1 s** | did not finish in 25 min |
| `/tmp` (not synced) | **0.03 s** | **6.3 s** |

That is roughly a 900× difference on file reads. The failure is silent and very
easy to misread: `npm run typecheck` looks like it has hung or like the machine
is broken, when the process is simply blocked on I/O the whole time.

Clone somewhere unsynced instead — `~/dev/alphaseeker`, `~/src/alphaseeker`,
anything outside the synced folders. To check quickly:

```bash
time (find src -name '*.ts*' | xargs cat > /dev/null)   # want well under 1s
```

---

## Regenerate the lockfile with npm 10.8.2, not whatever npm you have

CI pins Node **20.18.1**, which bundles **npm 10.8.2**, and it installs with
`npm ci` — which refuses to run at all if `package-lock.json` and
`package.json` disagree:

```
npm error code EUSAGE
npm ci can only install packages when your package.json and
package-lock.json are in sync.
Missing: @swc/helpers@0.5.23 from lock file
```

A newer npm (11.x) resolves that same tree without complaining and writes a
lockfile npm 10.8.2 then rejects. So a lockfile regenerated on a modern local
npm can break CI while working perfectly on your machine — which is exactly
what happened: **every CI run from 2026-07-19 to 2026-09-16 failed here**, at
the first step, so typecheck, tests and build never ran once.

When you change dependencies, regenerate the lockfile with the version CI uses:

```bash
npx -y npm@10.8.2 install --package-lock-only
```

and verify the way CI will:

```bash
rm -rf node_modules && npx -y npm@10.8.2 ci
```

(The `EBADENGINE` warnings about packages wanting Node >= 20.19 are noise on
20.18.1 — warnings, not errors. They are a hint that the Node pin is getting
old, not the cause of a failure.)

---

## `npm install` alone does not regenerate the Prisma client

npm 11 gates dependency lifecycle scripts behind `allowScripts`, so
`@prisma/client`'s own postinstall is skipped with only a warning. If the schema
changed since your last install, you are left with a **stale generated client**,
and the symptom is a flood of type errors that look like real bugs:

```
Property 'passwordReset' does not exist on type 'PrismaClient'
'schedulingMode' does not exist in type 'ClassSelect'
```

There is nothing wrong with the source — the client just predates the schema.
This repo now runs `prisma generate` from its **own** `postinstall` script,
which is not gated, so a plain `npm install` is enough. If you ever see errors
like the above, run `npx prisma generate` first before investigating anything.

---

## Never run `next dev` and `next build` at the same time

This is the single most common source of "module not found" / "ENOENT
.next/server/app/.../page_client-reference-manifest.js" errors.

Both processes write to the same `.next/` directory. When the dev server is
running and you start a build (or vice versa), they corrupt each other's
chunk manifests, leaving you with errors that look like:

```
Error: Cannot find module './1682.js'
Error: ENOENT: no such file or directory, open '.next/server/app/[locale]/page_client-reference-manifest.js'
```

### To recover

```bash
# 1. Kill any stale dev/build processes.
lsof -i :3005 -t | xargs -r kill -9
pkill -f "next dev" 2>/dev/null
pkill -f "next build" 2>/dev/null

# 2. Wipe the corrupted cache.
rm -rf .next

# 3. Run only ONE of the following at a time:
npm run dev      # for local iteration
# OR
npm run build    # for production verification
```

### Prevention

- Use `npm run build` only when the dev server is **stopped**.
- If you need to verify a build while iterating, stop dev first, build,
  then restart dev.
- CI runs `npm run build` in an isolated workspace, so this isn't an
  issue in CI — only locally.

---

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server on :3005 |
| `npm run build` | Production build (do not run while dev is up) |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript-only check (no emit) |
| `npx prisma studio` | DB inspector at :5555 |
| `npx prisma migrate dev` | Generate + apply migration |
| `npx prisma generate` | Regenerate Prisma client after schema edits |

---

## Coding conventions

- All user-supplied strings that flow into the database must pass through
  `stripHtml()` from `src/lib/security/sanitize.ts` before persistence.
  See existing Zod schemas in `src/app/api/me/posts/route.ts` for the
  pattern: `.transform(stripHtml).pipe(z.string().min(N))`.
- Public API routes that are intended to be reachable cross-origin must
  use `withCors()` and export an `OPTIONS` handler with `corsPreflight()`.
  See `src/lib/security/cors.ts`.
- New translatable strings go into both `messages/en.json` and
  `messages/fa.json` under the same key path.

---

## Reporting issues

Create a GitHub issue with:
- Reproduction steps
- Browser + OS
- Whether the issue happens in dev only, build only, or both
- Recent commits if known (`git log --oneline -10`)
