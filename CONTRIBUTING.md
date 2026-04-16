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

After every Prisma migration that touches the `MaterialChunk` table, restore
the pgvector column manually:

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260413000000_add_rag_vector_store/migration.sql
```

Prisma drops unknown column types on regen — pgvector lives outside its model
mapping, so it has to be re-added by raw SQL after each migration.

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
