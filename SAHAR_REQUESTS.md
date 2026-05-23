# Sahar's Change Requests — Tracking

Stakeholder: **Sahar Nikzad** — Co-Founder & Communication Manager.
Last updated: **2026-05-23** — Sahar delivered final logo + final certificate
designs, both shipped into the codebase.

This is the running list of every change request Sahar has sent so we
don't lose any of them. Update the status column as items move.

---

## Open work — committed by us, do not lose

| # | Item | Source | Status | Notes |
|---|------|--------|--------|-------|
| 1 | **Visibility audit** — "Join Google Meet" button is white/invisible; white text across the site is hard to read. Audit every button, label, status text in EN + FA, on light + dark surfaces. | 2026-05-01 email | TODO | Waiting on Sahar's screenshot of worst offenders to start. Promised before Mike leaves Nexus next Friday. |
| 2 | **Contact page + footer social cluster + Site Settings admin panel** — public Contact page in nav, social-link icons in footer on every page, admin form where team types in URLs (Instagram first, others later). New Prisma `SiteSettings` model + admin CRUD. Once shipped, team self-serves social URLs without code changes. | 2026-05-01 email + 2026-05-02 reply | PARTIAL — site-settings panel + footer icons SHIPPED 2026-05-05 (admin URL: `/admin/settings`). Migration file written at `prisma/migrations/20260505000000_add_site_settings/`; user runs `npm run prisma:migrate:deploy` to apply. Still TODO: standalone `/contact` public page (this turn shipped only the dashboard panel + footer icons). | Sahar can paste Instagram URL into the admin panel after the migration is applied; the icon appears on the public site automatically. |
| 3 | **Team page title update** — Farkhunda Latif: "Team Member" → "Technical Manager". Naweed Dawlat: keep as "Human Resources Manager" (do not touch). | 2026-05-02 email | TODO | One-line edit in `src/lib/team-data.ts` (or wherever team data lives). |
| 4 | **Certificate redesign** — Path B confirmed by Sahar 2026-05-05: Alizada layout, AlphaSeekers brand gradient (replacing her navy/light-blue), white background, shorter body copy. v2 SVGs + preview built at `design-drafts/certificates-v2/` and sent to Sahar 2026-05-05 for final confirmation. Reference PDFs at `~/Downloads/Boniadi Certificate (1).pdf` and `~/Downloads/Muzamel Esaqzai (1) (1).pdf`. | 2026-05-02 email + reference PDFs | RESOLVED 2026-05-23 | Sahar delivered final PNGs (Green and Gold geometric, both founder signatures). Saved as `design-drafts/certificates-v3-final/{student-completion,teacher-recognition}-certificate.png`. v2 SVGs superseded. **Not yet wired into runtime cert issuance — see README in v3-final folder.** |
| 5 | **Logo refinement** — APPROACH PIVOTED 2026-05-05: Sahar drives the design herself in Canva using the prompt + creative brief Mike sent. Brain-only (no globe), no tagline, "Alpha Seekers Organization" wordmark, brand-aligned colour palette. Mike integrates her output into the cert template + website header. Earlier brain+globe v2 (sent 2026-05-05 morning) is abandoned; brain-only v3 designed locally but never sent. Local drafts in `design-drafts/logo-v2/` and `logo-v3/` for reference only. | 2026-05-02 email + 2026-05-05 pivots | RESOLVED 2026-05-23 | Sahar delivered final wordmark logo (book/monitor + green-blue swoosh + "AlphaSeekers" text). Swapped into all 9 in-app spots (navbar, footer, login, register, admin sidebar, mobile-nav, layout). Adjacent `<span>AlphaSeekers</span>` removed since wordmark embeds the text. Icon-only variant used in tiny 28×28 mockup illustrations (Hero, HowItWorks). PWA icons + favicon regenerated. Old SVG drafts deleted. See `public/logo/LOGO.md`. |
| 6 | **CSV download per class** — admin button on the class page that exports enrolment + completion data as CSV (for cohort tracking, certificate batches, donor reports). Promised standalone walkthrough email with screenshots once button exists. | 2026-05-02 email | TODO | Sahar said "if it's simple, I can ask Hadi to handle it" — Hadi can take this if Mike is out. |
| 7 | **CSV walkthrough email** — separate, focused email to Sahar with step-by-step + screenshots once #6 ships. | 2026-05-03 reply | TODO (depends on #6) | Promised "tomorrow" (i.e. by 2026-05-04). |
| 8 | **Custom email on `@alphaseekers.org`** — set up real domain emails for the team (e.g. `sahar@alphaseekers.org`). Three options laid out for Sahar: Cloudflare Email Routing (free, receive only), Zoho Mail Free (free, 5 users, full mailbox), Google Workspace ($6/user/mo, polished). | 2026-05-04 email | BLOCKED on Hadi | Costs money — Hadi controls the budget. Hadi on hiking trip, unreachable until after 2026-05-06. Mike to follow up with Hadi on which option + cost cover. Setup is < 1 hour once chosen. |
| 9 | **ASN → ASO label swap on certificates** — when AlphaSeekers Network officially incorporates as AlphaSeekers Organization, swap "Founder of ASN" → "Founder of ASO" wherever it appears. | 2026-05-04 email | DEFERRED | Only happens when org incorporation is official; Sahar will let us know. |
| 10 | **Logo tagline change** — "Be Creative" doesn't fit an education nonprofit (Hadi's view, Mike concurs). Suggested replacements offered to Sahar: established site tagline "Free education for Afghan students" / "آموزش رایگان برای دانش‌آموزان افغان", or shorter alternatives, or no tagline at all. | 2026-05-04 email | BLOCKED on Sahar | Sahar to pick the new tagline (or "no tagline") since Hadi is unreachable until after 2026-05-06. Folded into logo refinement (#5). |

## Awaiting Sahar's input

| # | What we need from her | Why | Asked on |
|---|----------------------|-----|----------|
| 1 | **Final approval on cert v2** — three options: "approved", "approved with tweaks (list them)", or "not quite right". Plus: date format preference (YYYY/MM/DD vs Month D, YYYY) and verification ID format. | Unblocks #4 above. | 2026-05-05 |
| 2 | **Screenshot of "Join Google Meet" button + other white-on-white spots** | Speeds up #1 above. | 2026-05-02 |
| 3 | **Instagram URL** | Pre-fill the Site Settings panel on launch (#2 above). | 2026-05-02 |
| 4 | **Original Canva logo file (or higher-res source)** | Speeds up #5 above. Optional. | 2026-05-03 |
| 5 | **Dari titles for "Certificate of Completion" + "Recognition for Teaching Service"** | Per the no-invented-Dari rule, Sahar provides any new Dari that goes on the cert. | 2026-04-30 |
| 6 | **Sample logo designs** | She offered to send them. | 2026-05-01 |
| 7 | **Tagline pick for the new logo** | Replaces "Be Creative". Mike suggested established site tagline; Sahar to decide alone since Hadi unreachable. | 2026-05-04 |
| 8 | **Effective date for ASN → ASO** | Only swap when org incorporation is official. | 2026-05-04 |

## Resolved — no further action

| # | Item | Resolution |
|---|------|------------|
| R1 | Upload capacity 5MB → 200MB | Sahar accepted the explanation 2026-05-02. Use Telegram/Google Drive for files >5MB. (Optional follow-up if we want: still bump in-platform limit 5MB → 50MB and add an `externalUrl` UI hint on the upload form. Not requested explicitly.) |
| R2 | Database raw access for whole team | Sahar accepted the explanation 2026-05-02. Team will use the admin dashboard. CSV export covers the actual need (#6 above). |

---

## Email correspondence log

| Date | Direction | Subject | Summary |
|------|-----------|---------|---------|
| 2026-04-30 | Sahar → us | (original team request) | Asked for: certificate templates with QR + ID, new logo, Contact section, database access guidance. |
| 2026-04-30 | us → Sahar | Logo + certificate drafts — and answers to your other questions | Sent: 3 logo concepts (Lantern, Pomegranate, Book+Northstar) + 2 cert templates (student + teacher) + preview.html. Answered the contact + database questions. |
| 2026-05-01 | us → Sahar | Follow-up on database access — two options, and which is safer for the team | Explained Option A (admin dashboard, safe, recommended) vs Option B (raw Neon SQL, powerful but irreversible) with three concrete risks. Asked her to pick. |
| 2026-05-01 | us → Sahar | Before I leave Nexus Science next week — a few things I want to say | Personal note. Mike leaves Nexus end of next week. Asked for feedback ASAP. Acknowledged Sahar's leadership and Hadi's dedication. |
| 2026-05-01 | Sahar → us | (reply) | Logo: AI-generated drafts have issues, wants brain/knowledge symbol, will send samples. Certificate: disorganized (overlap), will send samples. Upload: wants 200MB. Visibility: white text everywhere is hard to see, "Join Google Meet" button invisible. |
| 2026-05-01 | Sahar → us | (second message in thread) | Only have Instagram for now; can the team self-serve social URLs when other accounts come online? |
| 2026-05-02 | us → Sahar | Re: Logo + certificate drafts — going through your feedback | Receptive on logo/cert (waiting for samples), pushed back on 200MB with three honest costs (student data, server timeout, R2 storage), proposed 50MB + external links, committed to visibility audit + Contact/Site Settings panel before Mike leaves. |
| 2026-05-02 | Sahar → us | (reply, two PDF attachments) | Accepted 5MB explanation. Sent two reference certs (Boniadi + Alizada). Wants Farkhunda Latif → "Technical Manager", keep Naweed as is. Wants per-class CSV export. Logo concept: hand holding a globe ("we change the world with our own hands"). |
| 2026-05-03 | us → Sahar | Re: Logo + certificate drafts — one quick question to unblock me | Asked her to pick A (fix overlap on my drafts) vs B (rebuild matching her two samples). Recommended B. Confirmed Farkhunda update. Will keep brain/globe logo concept. CSV walkthrough email coming separately. |
| 2026-05-04 | Sahar → us | (reply, with logo PNG attached) | Wants real `@alphaseekers.org` email on the .org domain. Founder title changes to "Founder of ASO" if org name changes from ASN. Only she + Shahla on certificates. Hadi thinks "Be Creative" doesn't fit; Sahar unsure, asks Mike's view. No Canva source file (made 1.5 years ago); attached the PNG instead. |
| 2026-05-04 | us → Sahar | Re: Latest updates — going through your items | .org email: 3 options laid out (Cloudflare free / Zoho free / Workspace paid); Hadi unreachable on hiking trip until after May 6; needs Hadi for cost approval. ASN→ASO acknowledged. Signatures confirmed Sahar + Shahla only. Concurred with Hadi on tagline ("Be Creative" doesn't fit); offered established site tagline + 3 short alternatives + "no tagline" option; left Sahar to pick. Canva file not needed; PNG sufficient. |
| 2026-05-05 | Sahar → us | (reply) | Logo: drop tagline entirely, just brain-globe + "Alpha Seekers Organization" wordmark. Email: Hadi will talk to Mike directly. Cert: clarified — pick from her own samples (Boniadi vs Alizada); prefers Alizada style with AlphaSeekers brand colours and white background. Instagram URL coming tonight. Visibility screenshot says it's the dashboard section (didn't reach us). |
| 2026-05-05 | us → Sahar | Certificate v2 — please confirm | Sent rebuilt v2 (Alizada layout + brand gradient + white bg + shorter body, all spacing audited collision-free). Three attachments: preview-v2.html, student-template-v2.svg, teacher-template-v2.svg. Asked for explicit (1) approve / (2) approve-with-tweaks / (3) not-quite-right answer. Asked open questions on date format and ID format. |
| 2026-05-05 | us → Sahar | Logo v2 — please confirm | Sent refined brain+globe logo (mark.svg, wordmark.svg, preview.html) — refinement of her Canva mark, kept the globe. Subsequently superseded by the Canva-prompt approach below. |
| 2026-05-05 | us → Sahar | Logo — try this Canva AI prompt and drive it yourself | PIVOT: handed the logo design back to Sahar. Asked her to ignore the brain+globe draft. Provided (1) a paste-ready Canva AI Magic Design prompt and (2) a full creative brief (palette, layout, technical constraints, do-nots). Brain-only, no globe, no tagline, brand-aligned colours, "Alpha Seekers Organization" wordmark. She generates in Canva and sends back; Mike plugs it into the certificate template + website header. |

---

## Hard rules to honour on every change

- **No invented Dari.** Any new Dari string (cert titles, contact-page copy, status text) requires Sahar to provide. Reuse only what already exists in `messages/fa.json` or the existing wordmark assets.
- **Dev and prod share one Neon DB.** Any data-shape change (new Prisma model for `SiteSettings`, etc.) hits production immediately. Migrate carefully.
- **Render free tier.** Use plain `<img>` for static team photos (image optimizer 504s); upload limits constrained by request timeout.
- **No file >5MB upload to platform.** Resolved per R1; teachers route big files via Telegram / Google Drive.
