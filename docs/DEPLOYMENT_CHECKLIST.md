# AlphaSeekers Deployment Checklist

## Prerequisites
- [ ] `npm run build` passes locally
- [ ] All env vars documented in .env.example

## 1. Neon Database
- [ ] DATABASE_URL set in deployment environment
- [ ] Run: `npx prisma migrate deploy` (applies all pending migrations)
- [ ] Run: `CREATE EXTENSION IF NOT EXISTS vector;` in SQL editor
- [ ] Verify pgvector: `SELECT extname FROM pg_extension WHERE extname='vector';`

## 2. Vercel (or Render) Deployment

### Required Environment Variables:
| Variable | Source | Required |
|----------|--------|----------|
| DATABASE_URL | Neon dashboard | Yes |
| NEXTAUTH_SECRET | `openssl rand -base64 32` | Yes |
| NEXTAUTH_URL | Your deployment URL | Yes |
| GROQ_API_KEY | console.groq.com | Yes (for AI) |
| HF_API_TOKEN | huggingface.co/settings/tokens | Yes (for AI) |
| CRON_SECRET | Any random string | Yes |

### Optional Environment Variables:
| Variable | Source | Feature |
|----------|--------|---------|
| GEMMA_API_KEY | aistudio.google.com/apikey | AI fallback |
| GOOGLE_CLIENT_ID | Google Cloud Console | Calendar + Meet |
| GOOGLE_CLIENT_SECRET | Google Cloud Console | Calendar + Meet |
| GOOGLE_API_KEY | Google Cloud Console | Calendar |
| SMTP_USER | Gmail address | Email notifications |
| SMTP_PASS | Gmail App Password | Email notifications |

### Build Settings:
- Framework: Next.js (auto-detected)
- Build command: `npm run build`
- Node.js: 20.x
- Run `npx prisma generate` before build (add to build script or postinstall)

## 3. Post-Deployment Verification
- [ ] Homepage loads
- [ ] Login works (demo accounts in demo mode)
- [ ] Dashboard shows real data
- [ ] Language switcher works (EN ↔ دری)
- [ ] Library/Webinars show coming soon state
- [ ] Team page shows photos
- [ ] AI Study Assistant connects (requires pgvector + ingested content)

## 4. Cron Jobs
Check `render.yaml` or `vercel.json` for:
- [ ] Neon warm-up ping (prevents cold starts)
- [ ] Auto-scheduler (creates sessions from teacher availability)
- [ ] Reminder sender (WhatsApp/email before class)
