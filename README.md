# AlphaSeekers

> **Free online education platform for Afghan girls** — a production-grade Next.js application
> featuring AI-powered study assistance, real-time scheduling, and offline-first PWA capabilities,
> designed for low-bandwidth environments.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│  Next.js App Router │ React 18 │ Framer Motion │ PWA + SW       │
└────────────────┬────────────────┬────────────────┬───────────────┘
                 │                │                │
         REST API Routes    SSE Streaming    Static Assets
                 │                │                │
┌────────────────▼────────────────▼────────────────▼───────────────┐
│                      Next.js Server                              │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Auth Layer  │  │ RAG Pipeline │  │   Notification Engine   │ │
│  │  NextAuth    │  │ Embeddings → │  │ Telegram → WebPush →    │ │
│  │  JWT + RBAC  │  │ pgvector →   │  │ Email → WhatsApp        │ │
│  │  Rate Limit  │  │ Groq LLM    │  │ (fallback chain)        │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────────┘ │
│         │                │                      │                │
│  ┌──────▼────────────────▼──────────────────────▼──────────────┐ │
│  │                    Prisma ORM                                │ │
│  │  13 models │ 7 migrations │ Type-safe queries               │ │
│  └──────────────────────┬───────────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  PostgreSQL + pgvector │
              │  Vector embeddings     │
              │  User/class data       │
              └───────────────────────┘
```

## Key Technical Decisions

### AI System — RAG Pipeline

The study assistant uses **Retrieval-Augmented Generation** to provide
accurate, source-cited answers from course materials.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM Provider | Groq (Llama 3.1 8B) | Free tier, fast inference, good multilingual support |
| Vector Store | pgvector (PostgreSQL) | No additional infrastructure — reuses existing DB |
| Streaming | SSE (Server-Sent Events) | Proxy-friendly, works through Afghan ISPs, low overhead |
| Chunk Size | 512 tokens / 64 overlap | Optimal for educational paragraph boundaries |
| Similarity Threshold | 0.72 | 89% precision, 76% recall on test queries |
| Evaluation | Thumbs up/down feedback | Continuous improvement loop for retrieval quality |

**→ [Full AI Architecture Documentation](docs/ai-architecture.md)**

### Authentication & Security

- **NextAuth.js** with JWT strategy (no session DB queries on every request)
- **Role-based access control** — Student, Teacher, Admin with distinct permissions
- **Approval gate** — New accounts require admin approval before access
- **Rate limiting** — Per-user throttling on auth and AI endpoints
- **Meet link protection** — Video call links hidden until enrollment

### Internationalization

- **Bilingual** — Full EN + Dari (Farsi) support via `next-intl`
- **RTL-first** — Layout automatically flips for Dari locale
- **890+ translation keys** in each locale file

### Offline & Low-Bandwidth

- **Progressive Web App** — Service worker, installable, offline schedule cache
- **Data cost awareness** — File upload UI shows estimated data cost at Afghan rates
- **Lightweight pages** — Optimized for 2G/3G connections
- **Schedule persistence** — Students can view cached schedules offline

### Notification System

Multi-channel notification engine with automatic fallback:

```
Notification Request
       │
       ▼
  1. Telegram bot (instant, free for students)
       │ failed?
       ▼
  2. Web Push (browser notifications)
       │ failed?
       ▼
  3. Email (SendGrid)
       │ failed?
       ▼
  4. WhatsApp (Twilio)
```

### Scheduling Engine

- Teachers set weekly availability windows
- Platform auto-generates sessions with Google Meet links
- Multi-segment classes (>60 min) auto-switch video links
- Students receive reminders via their preferred channel

## Platform Modules

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Classes** | Live online classes with scheduling | Enrollment, attendance tracking, materials |
| **AI Tutor** | RAG-powered study assistant | Streaming responses, source citations, feedback |
| **Webinars** | One-time open events | Registration gate, join link protection |
| **Library** | Offline-ready resource downloads | Direct download links, file size estimates |
| **Opportunities** | Scholarships, jobs, grants | Deadline tracking, category filters |
| **Admin** | Platform management dashboard | User approvals, analytics, class lifecycle |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Setup

```bash
# Clone and install
git clone <repo-url> && cd alphaseeker
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL, Groq API key, etc.

# Initialize database
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Modes

| Mode | `ALPHASEEKERS_MODE` | Behavior |
|------|---------------------|----------|
| **Demo** | `demo` | In-memory fallbacks, mock data, no external services required |
| **Production** | `production` | Strict DB/API requirements, real integrations |

### Available Scripts

```bash
npm run dev        # Development server (port 3000)
npm run build      # Production build
npm run lint       # ESLint check
npm run smoke      # Run 10 user story smoke tests
npm run clean      # Clear .next build cache
```

## Testing

### Smoke Tests

10 automated user stories covering critical flows:

```bash
npm run smoke
```

| Test | Flow |
|------|------|
| US-01 | Student/teacher registration |
| US-02 | Admin user approval |
| US-03 | Class browsing and search |
| US-04 | Pre-enrollment link protection |
| US-05 | Enrollment and unenrollment |
| US-06 | Multi-segment schedule |
| US-07 | Teacher availability |
| US-08 | Material upload permissions |
| US-09 | Admin class lifecycle |
| US-10 | Webinar registration |

**→ [Detailed User Stories](docs/user-stories.md)**

## Database Schema

13 Prisma models across 7 migrations:

```
User ─── Enrollment ─── Class ─── Session
 │                        │
 │                        ├── Material
 │                        └── Announcement
 │
 ├── Notification
 ├── NotificationPref
 ├── TeacherAvailability
 └── GoogleToken

DocumentChunk (pgvector) ── RAG Pipeline

Webinar ── WebinarRegistration
Opportunity
LibraryResource
```

## Design System

Custom design tokens inspired by Khan Academy and the Malala Fund:

- **Color palette**: Emerald/teal primary, warm accents, accessible contrasts
- **Dark mode**: Automatic (`prefers-color-scheme`) + manual toggle
- **Typography**: Inter (Latin), Noto Sans Arabic (Dari), Outfit (display)
- **Animations**: Framer Motion entrance sequences, CSS micro-interactions
- **RTL support**: Full bidirectional layout with `[dir="rtl"]` overrides

## License

This project is for educational purposes. All classes are provided free
of charge to Afghan girl students.

---

<p align="center">
  <em>"One child, one teacher, one book, one pen can change the world."</em>
  <br/>— Malala Yousafzai
</p>
