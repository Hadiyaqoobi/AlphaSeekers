# AlphaSeekers Codebase Map
Generated: 2026-04-15

## Tech Stack
- **Framework:** Next.js 14.2.35 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3.4
- **Database:** PostgreSQL (Neon) + Prisma 6.19
- **Auth:** NextAuth.js 4.24 (JWT strategy)
- **i18n:** next-intl 4.8.2 (Dari + English)
- **AI:** Groq (Llama 3.1 8B) + HuggingFace embeddings (384-dim)

## Key Directories

### Pages (`src/app/[locale]/`)
| Path | Description |
|------|-------------|
| `page.tsx` | Landing page (redirects to /fa) |
| `[locale]/page.tsx` | Locale-specific landing page |
| `[locale]/layout.tsx` | Root locale layout (top nav OR sidebar based on auth) |
| `[locale]/dashboard/page.tsx` | Dashboard (student/teacher/admin views) |
| `[locale]/dashboard/layout.tsx` | Dashboard layout (passthrough) |
| `[locale]/classes/page.tsx` | Class catalog |
| `[locale]/classes/[id]/page.tsx` | Class detail |
| `[locale]/library/page.tsx` | Library (coming soon / browse) |
| `[locale]/webinars/page.tsx` | Webinars (coming soon / browse) |
| `[locale]/opportunities/page.tsx` | Opportunities listing |
| `[locale]/team/page.tsx` | Team page with photos |
| `[locale]/study-assistant/page.tsx` | AI Study Assistant |
| `[locale]/login/page.tsx` | Login form |
| `[locale]/register/page.tsx` | Registration form |
| `[locale]/profile/page.tsx` | User profile |
| `[locale]/admin/users/page.tsx` | User management |
| `[locale]/admin/classes/page.tsx` | Class management |
| `[locale]/admin/content/page.tsx` | Content forms (webinar, opportunity, library) |
| `[locale]/admin/ai/page.tsx` | AI system health dashboard |
| `[locale]/admin/analytics/page.tsx` | Analytics dashboard |
| `[locale]/teacher/availability/page.tsx` | Teacher availability grid |
| `[locale]/staff/dashboard/page.tsx` | Staff dashboard |

### API Routes (`src/app/api/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/ai/ask | Yes | RAG query → stream SSE |
| POST | /api/ai/feedback | Yes | Thumbs up/down feedback |
| POST | /api/ai/ingest | Admin | Ingest + embed documents |
| GET | /api/ai/status | Admin | AI health check |
| GET | /api/admin/ai-health | Admin | Provider + cache stats |
| GET/POST | /api/classes | Yes | List / create classes |
| GET | /api/classes/[id] | Yes | Class detail |
| POST | /api/classes/[id]/enroll | Student | Enroll in class |
| POST | /api/classes/[id]/materials | Teacher | Upload material |
| GET/POST | /api/webinars | Yes/Admin | List / create webinars |
| POST | /api/webinars/[id]/register | Student | Register for webinar |
| GET/POST | /api/library | Yes/Admin | List / create resources |
| GET/POST | /api/opportunities | Yes/Admin | List / create opportunities |
| GET | /api/dashboard/summary | Yes | Dashboard stats |
| GET | /api/me/schedule | Student | Offline schedule |
| GET/POST | /api/admin/users | Admin | User management |
| POST | /api/admin/classes | Admin | Class CRUD |

### Components (`src/components/`)
| Directory | Contents |
|-----------|----------|
| `landing/` | Hero, Navbar, Footer, FeatureTabs, WorkflowPipeline, HowItWorks, AIShowcase, CTABanner, MissionSection, LogoTicker, ScrollReveal, CountUp |
| `admin/` | Sidebar |
| `ai/` | StudyAssistant (chat UI) |
| `dashboard/` | GoogleConnectCard, JoinNowCard, OfflineSchedule |
| `coming-soon/` | LibraryComingSoon, WebinarsComingSoon |
| `team/` | TeamGrid |
| `forms/` | LibraryForm, WebinarForm, OpportunityForm, WebinarRegisterButton |
| `pwa/` | InstallPrompt, ServiceWorkerRegister |

### AI Pipeline (`src/lib/ai/`)
| File | Purpose |
|------|---------|
| `config.ts` | AI config (Groq, Gemma, HF, RAG params) |
| `llm.ts` | LLM client (Groq primary, Gemma fallback) |
| `embeddings.ts` | HuggingFace embedding generation |
| `vector-store.ts` | pgvector similarity search |
| `rag-pipeline.ts` | Full RAG orchestration (embed → search → prompt → stream) |
| `response-cache.ts` | Response caching with quality tracking |
| `prompts.ts` | System prompts (EN + Dari) |
| `chunker.ts` | Document chunking for ingestion |

### Database (`prisma/schema.prisma`)
Key models: User, Class, Session, Enrollment, Attendance, Material, Opportunity, LibraryResource, Webinar, WebinarRegistration, Notification, DocumentChunk, CachedResponse, AIConversation, TeacherAvailability, SchedulerJob, GoogleAccountLink

## Environment Variables
See `.env.example` for full list with descriptions.

### Required:
DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET

### Required for AI:
GROQ_API_KEY, HF_API_TOKEN

### Optional:
GEMMA_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_API_KEY, SMTP_USER, SMTP_PASS
