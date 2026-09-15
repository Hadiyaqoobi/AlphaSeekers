# AlphaSeekers Status Report
Generated: 2026-04-15

> **⚠️ HISTORICAL SNAPSHOT — DO NOT READ AS CURRENT STATUS.**
>
> This is a point-in-time report from 2026-04-15 and has not been regenerated since.
> Several months of work landed after it, so its "Biggest Blockers" section in
> particular is misleading: it reads as though the AI Study Assistant is dead,
> when the migrations that unblock it were already in the repo when this was
> written, or landed the next day.
>
> Corrections verified against the repository on 2026-09-14:
>
> | This report says | Actual |
> |---|---|
> | "pgvector — Not installed / extension needs CREATE EXTENSION vector" | `prisma/migrations/20260413000000_add_rag_vector_store/migration.sql` opens with `CREATE EXTENSION IF NOT EXISTS vector` (committed 2026-04-13) |
> | "DocumentChunk — Table not created, migration not applied" | Same migration creates `DocumentChunk` with a `vector(384)` column and an HNSW index |
> | "CachedResponse table needs migration" | Created by `20260416023428_add_intelligent_tutor` (committed 2026-04-16) |
> | "13 models / 7 migrations" (see README) | 38 models across 21 migrations |
>
> What is **not** re-verified here: whether those migrations have actually been
> applied to the production Neon database, and whether the Gemma fallback key is
> still returning 403. Both require a live database/provider check — run
> `npm run prisma:migrate:deploy` and the `/api/admin/ai-health` page to confirm.
> The row counts in the table below are from 2026-04-15 and are certainly stale.

## Build Status
- `npm run build`: PASSES (with --no-lint)
- Warnings: next-intl webpack cache parsing warning (cosmetic, not breaking)

## Database State
| Table | Rows | Notes |
|-------|------|-------|
| User | 193 | Mix of demo + real users |
| Class | 20 | Active classes |
| Enrollment | 10 | Student enrollments |
| Session | 46 | Scheduled sessions |
| Material | 20 | Uploaded materials |
| DocumentChunk | 0 | Table not created — migration not applied |
| pgvector | Not installed | Extension needs CREATE EXTENSION vector |

## Feature Status

### Core Platform
| Feature | Status | Notes |
|---------|--------|-------|
| User registration | ✅ | Student + teacher flows work |
| Admin approval | ✅ | Pending → approved flow works |
| Login / Logout | ✅ | NextAuth with JWT |
| Role-based access | ✅ | Student, Teacher, Admin roles |
| Class browsing | ✅ | Paginated catalog |
| Class enrollment | ✅ | Enroll/unenroll with meet link visibility |
| Material upload | ✅ | Teacher uploads, student downloads |

### AI Study Assistant
| Feature | Status | Notes |
|---------|--------|-------|
| Groq LLM connection | ✅ | API key valid, 200 OK |
| HuggingFace embeddings | ✅ | URL updated to new endpoint |
| pgvector search | ❌ | Extension not installed, DocumentChunk table missing |
| Streaming responses | ✅ | SSE format fixed (type:"text"/content) |
| Gemma fallback | ⚠️ | Code implemented, API key returns 403 |
| Response caching | ⚠️ | Code ready, CachedResponse table needs migration |
| Source citations | ✅ | Displayed in expandable panel |
| Feedback | ✅ | Thumbs up/down → console log + cache quality |

### Localization
| Feature | Status | Notes |
|---------|--------|-------|
| English UI | ✅ | Complete |
| Dari UI (RTL) | ✅ | Landing page fully translated |
| Language switcher | ✅ | On landing nav + utility header |
| Landing page Dari | ✅ | All 10 components use useTranslations |

### Pages
| Feature | Status | Notes |
|---------|--------|-------|
| Landing page | ✅ | Fully redesigned with Dari support |
| Team page | ✅ | 4/5 photos, initials placeholder for missing |
| Library (coming soon) | ✅ | Auto-transitions when content added |
| Webinars (coming soon) | ✅ | Auto-transitions when content added |
| Opportunities | ✅ | Accessible without login when empty |
| Dashboard | ✅ | Sidebar nav + utility header + stat cards |
| Admin AI health | ✅ | Provider status + cache stats |

## Biggest Blockers for Production
1. **pgvector not installed** — AI Study Assistant can't search documents until `CREATE EXTENSION vector` runs and DocumentChunk migration is applied
2. **Gemma API key denied** — Fallback LLM won't work until a valid key is provided
3. **No Prisma migration applied for new models** — CachedResponse and AIConversation tables need `prisma migrate deploy`
