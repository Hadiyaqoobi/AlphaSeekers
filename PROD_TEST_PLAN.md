# AlphaSeekers — Production Test Plan

A browser-agent-executable playbook covering every page, button, flow, and role
gate on the platform. Designed for Antigravity / Chrome to step through as a
real user.

- **Target environment**: `https://alphaseekers.onrender.com`
- **Locales**: `/en` (English LTR) and `/fa` (Dari RTL — default)
- **Browser**: Latest Chrome on desktop. Repeat the smoke set on Chrome Android (≤1024×768).
- **Plan version**: 2026-04-26
- **Last commit covered**: `8957ebf` (UAT round 2)

---

## How to read a test case

```
### {ID}: {Name}
**Role**: anonymous | student | teacher | admin
**Locale**: en | fa | both
**Setup**: any preconditions / which session must be active
**Steps**:
  1. {action} → {expected observable result}
  2. {action} → {expected observable result}
**Pass**: {single-sentence success criterion}
**Negative checks** (where present): things that should NOT happen
```

When a step says **navigate to X**, paste `https://alphaseekers.onrender.com{X}`
into the address bar. When a step says **click {label}**, find the visible
element with that exact text. When in doubt, prefer the role+text accessible
name over CSS selectors.

---

## 0. Test accounts

Use the demo accounts for fast smoke. Create at least one real account
mid-test for the registration → approval flow. Reuse Naweed/Shahla's UAT
accounts as well to confirm regressions.

| Role     | Email                          | Password    | Notes |
|----------|--------------------------------|-------------|-------|
| Admin    | `admin@alphaseekers.org`       | `admin123`  | Demo data, bypasses approval |
| Teacher  | `teacher@alphaseekers.org`     | `teacher123`| Demo data |
| Student  | `student@alphaseekers.org`     | `student123`| Demo data |
| Real student | `qa-student-{ts}@example.com` | `Test1234!` | Created during REG-01 |

Tester also needs a real Gmail address that can receive admin-approval emails
if SMTP is configured.

---

## 1. Public / unauthenticated (PUB)

### PUB-01: Landing redirect
**Role**: anonymous
**Locale**: -
**Steps**:
  1. Navigate to `/` → 200, redirected to `/fa`.
  2. Navigate to `/en` → 200, hero renders in English.
  3. Navigate to `/fa` → 200, hero renders in Dari, `dir="rtl"` on `<html>`.
**Pass**: All three load < 8 s and the hero CTA buttons are visible.

### PUB-02: Public navigation links
**Role**: anonymous
**Locale**: both
**Steps** for each locale:
  1. Click each visible nav link: Home, Programs, How it works, Webinars, Library, Stories, Team.
  2. Each navigates to its page, returns 200, no JS console errors.
**Pass**: All seven links land on the right page in the right language.

### PUB-03: Locale switcher
**Role**: anonymous
**Locale**: both
**Steps**:
  1. From `/en`, click the language switcher button (`دری`).
  2. URL changes to `/fa`, content flips to Dari, layout flips RTL.
  3. Click `EN` → back to `/en`, LTR.
**Pass**: Round-trips both ways, no flash of untranslated content.

### PUB-04: Login page renders
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Navigate to `/{locale}/login`.
  2. Email field, password field, "Sign in" button, "Send me a magic link" button visible.
  3. Show/hide-password toggle works.
  4. "Don't have an account? Request access" link visible at bottom.
**Pass**: All form controls render and the page is keyboard-tabbable.

### PUB-05: Register page renders
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Navigate to `/{locale}/register`.
  2. Fields visible: Full name, Email, Password, Phone (optional), Role pill (Student / Teacher).
  3. Click the Teacher pill → it visibly highlights and Student de-selects.
  4. Click Student pill → reverses.
**Pass**: Role toggle visibly changes selection.

### PUB-06: Team page (UAT HIGH-A regression)
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Navigate to `/{locale}/team`.
  2. **Visually verify all 5 photos render**: Sahar, Shahla, Farham, Naweed; the 5th member (Farkhunda) shows the initial avatar.
  3. Open DevTools → Network → filter `team` → reload. Every `/team/*.jpg|png|jpeg` request returns 200.
  4. Confirm there are **no requests** to `/_next/image?url=%2Fteam%2F...`.
**Pass**: 4 photos visible, 0 next/image requests for team assets.
**Negative**: No black/empty photo placeholders.

### PUB-07: Stories list (public)
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Navigate to `/{locale}/stories`.
  2. If posts exist: cards render with title, author, type badge.
  3. Click a card → detail page opens, content renders, "Read time" shown.
  4. If no posts: "Coming soon" component renders without a JS error.
**Pass**: Browse and detail both load under 5 s.

### PUB-08: Webinars / Opportunities / Library coming-soon
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Navigate to each: `/{locale}/webinars`, `/{locale}/opportunities`, `/{locale}/library`.
  2. With no published items, each renders its coming-soon component.
**Pass**: No 500s, no infinite spinners.

### PUB-09: Theme & visual identity (UAT HIGH-E regression)
**Role**: admin (after login) or use authenticated session for content
**Locale**: en
**Steps**:
  1. Visit `/en/webinars` (with content): header has a sky-blue calendar icon block (`bg-sky-100`, `text-sky-600`).
  2. Visit `/en/opportunities` (with content): header has an amber star icon block (`bg-amber-100`, `text-amber-600`).
**Pass**: The two pages are immediately visually distinguishable side-by-side.

---

## 2. Registration → approval (REG)

### REG-01: Student self-registration (happy path)
**Role**: anonymous
**Locale**: en
**Steps**:
  1. Navigate to `/en/register`.
  2. Fill: Full name = "QA Student", Email = unique `qa-student-{ts}@example.com`, Password = `Test1234!`, Phone optional, Role = Student.
  3. Click "Submit request".
  4. Page redirects to `/en/pending-approval`.
  5. Animated icon, "Under Review" eyebrow, "Your account is being reviewed" copy visible.
**Pass**: Account created (verify in admin queue), PENDING state.

### REG-02: Teacher self-registration role binding
**Role**: anonymous
**Locale**: en
**Steps**:
  1. Navigate to `/en/register`.
  2. Toggle Role pill to **Teacher**.
  3. Submit with `qa-teacher-{ts}@example.com`.
  4. After redirect, sign in as admin and confirm role = TEACHER.
**Pass**: Account created with role=TEACHER (UAT MED-2 regression).

### REG-03: Email validation — invalid format (UAT HIGH-B)
**Role**: anonymous
**Locale**: both
**Steps**:
  1. On register page, fill `me@bad` → submit.
  2. Inline error appears in the page's locale ("Please enter a valid email address." / "لطفاً یک آدرس ایمیل معتبر وارد کنید.")
**Pass**: 400 from server; localized message; account NOT created.

### REG-04: Email validation — typo TLD (UAT HIGH-B)
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Fill `me@gmail.con` → submit.
  2. Error: "That domain extension (.con) doesn't look right. Did you mean .com?" / Dari equivalent.
  3. Repeat with `.lh`, `.cmo`, `.vom` — same error text with the offending TLD.
**Pass**: Each typo blocked; `.com` typo suggestion present.

### REG-05: Email validation — TLD missing (UAT HIGH-B)
**Role**: anonymous
**Locale**: both
**Steps**:
  1. Fill `foo@bar` → submit.
  2. Error: "Email is missing a domain extension (for example .com)." / Dari equivalent.
**Pass**: Server 400, account not created.

### REG-06: Pending account cannot sign in
**Role**: pending account from REG-01
**Locale**: en
**Steps**:
  1. Navigate to `/en/login`.
  2. Sign in with the new pending credentials.
  3. Redirect lands on `/en/login?error=PENDING_APPROVAL` (or pending banner).
**Pass**: No session cookie set; pending message shown.

### REG-07: Admin approves a pending user
**Role**: admin
**Locale**: en
**Setup**: REG-01 created a pending student.
**Steps**:
  1. Sign in as admin.
  2. Navigate to `/en/admin/users`.
  3. Search bar: type the new user's email → row appears.
  4. Click "Approve" on that row → button briefly disables, row updates.
  5. Open a separate browser/incognito → log in as that user → reaches `/en/dashboard`.
**Pass**: Approve = single click; approved user can now sign in.

### REG-08: Duplicate email rejected
**Role**: anonymous
**Locale**: en
**Steps**:
  1. Submit register form with an email that already exists (e.g. `student@alphaseekers.org`).
  2. Server returns 409 "Email already registered".
**Pass**: 409 + clear message.

### REG-09: Form validation — required fields
**Role**: anonymous
**Steps**: Submit empty form → server returns the first field error in the locale's language.

---

## 3. Authentication & session (AUTH)

### AUTH-01: Login (happy path) all 3 demo roles
**Steps**: For admin / teacher / student, log in via `/en/login`. Expect:
  - Admin → `/en/dashboard` with admin sidebar (Users, Admin, Stories, Analytics tiles).
  - Teacher → `/en/dashboard` with Teacher sidebar tile only.
  - Student → `/en/dashboard` with no admin/teacher tiles.

### AUTH-02: Wrong password
Steps: Wrong password → "Invalid email or password" / "ایمیل یا رمز عبور نادرست است" — no session.

### AUTH-03: JWT survives idle (UAT CRIT-A regression)
**Role**: admin
**Steps**:
  1. Sign in as admin.
  2. Wait ≥ 35 minutes idle (run other tests in another tab).
  3. Click any sidebar link in the admin tab → opens, no bounce to `/login`.
**Pass**: 7-day session honoured; was 30 min before.

### AUTH-04: Logout clears session + caches
**Steps**: Click "Log out" in sidebar → redirected to landing; `/en/dashboard` now redirects to `/en/login`.

### AUTH-05: Password change
**Role**: any signed-in
**Steps**:
  1. Navigate to `/en/profile`.
  2. Submit current = wrong → error "wrong_current".
  3. Submit current = correct, new < 6 chars → error "too_short".
  4. Submit current = correct, new = current → error "same_as_current".
  5. Submit valid new password → success; log out; log in with new; works.
**Pass**: All four error paths surface; happy path swaps the password.

### AUTH-06: Role gates by URL (UAT CRIT-A regression)
**Steps**: As STUDENT, navigate to `/en/admin/users`, `/en/admin/classes`, `/en/teacher/availability`. Each renders meta-refresh redirect to `/en/dashboard`. Repeat as TEACHER for admin URLs — same redirect.
**Pass**: All non-admin sessions are kicked out of admin URLs.

---

## 4. Student flows (STU)

### STU-01: Dashboard renders for student
**Steps**: Sign in as student → `/en/dashboard` shows greeting, 4 stat cards, Join-Now banner (if a session is live), My Classes (≤4), Notifications.
**Pass**: All sections render with no spinner stuck.

### STU-02: Browse class catalogue
**Steps**:
  1. Navigate to `/en/classes`.
  2. Cards render with teacher initial avatar, class name, schedule, language pill, enrollment count, duration, category.
  3. **Status dot** (UAT MED-B): emerald dot when class has nextSessionStart, amber dot when pending.
  4. Search box: type a partial class name → press search → list filters.
  5. Pagination Prev/Next work; URL has `?page=...&search=...`.
**Pass**: Search filters; pagination paginates; status dot visible.

### STU-03: Class detail (pre-enroll privacy — US-04 regression)
**Steps**: As student NOT enrolled, click a class card "Details". Class detail page shows description, schedule, but NOT the Meet link, NOT materials.
**Pass**: `meetLink` is not in the rendered HTML. Page does not 500.

### STU-04: Enroll
**Steps**:
  1. From class detail, click "Enroll".
  2. Optimistic UI flips to "Enrolled (tap to unenroll)" instantly.
  3. Refresh → still enrolled (cards show "Enrolled" pill on `/en/classes` per UAT MED-B).
  4. Meet link now visible, materials accessible.
**Pass**: Enrolment persists across reload; gated content unlocked.

### STU-05: Enrollment cap (UAT MED-A)
**Role**: student
**Steps**:
  1. Enrol in 3 different classes successfully.
  2. Try to enrol in a 4th.
  3. Inline error appears in the page's locale: "You can join up to 3 classes at a time. Drop one to add another." / Dari equivalent.
  4. Drop one of the existing 3 → 4th now enrols.
**Pass**: Server 409 fires at the limit; UI shows localized message; drop-then-enrol works.

### STU-06: Drop a class
**Steps**: Click "Enrolled (tap to unenroll)" → confirms → status flips back to "Enroll". Meet link disappears.

### STU-07: Schedule offline cache
**Steps**:
  1. Visit `/en/dashboard` once online.
  2. Toggle DevTools → Application → Service Workers → Offline.
  3. Reload `/en/dashboard` → cached schedule still visible with "Offline" banner / last-updated timestamp.
**Pass**: Schedule not blank when offline.

### STU-08: Join Now banner
**Setup**: A session for an enrolled class is in the live window (15 min before to 2 h after start).
**Steps**:
  1. `/en/dashboard` shows "Join Now" prominent card with the class name + Meet link.
  2. Click → opens Google Meet in new tab.
**Pass**: Card visible; Meet opens.

### STU-09: Live session hub (`/classes/[id]/live/[sessionId]`)
**Setup**: Inside the live window for an enrolled session.
**Steps**:
  1. Open the live URL → page loads showing materials, notes editor, summary section, homework section, attendance section.
  2. **Take notes**: type into the notes editor → wait 3 s → close & reopen → notes persisted.
  3. **Quick AI** panel: ask a short question → answer streams back.
  4. **Check-in code**: enter a wrong code → "Wrong code" error. Enter the correct one → attendance marked.
**Pass**: Notes auto-save; quick AI returns; check-in flows work.

### STU-10: Homework submission + AI review
**Setup**: A teacher has assigned homework on a session you're enrolled in.
**Steps**:
  1. From the session live hub, fill homework content / upload an image (≤5 MB).
  2. Submit → success message; the AI review appears within ~30 s.
**Pass**: Submission persists; AI feedback is non-empty.

### STU-11: AI Tutor (Study Assistant) full flow (UAT HIGH-D regression)
**Role**: student
**Steps**:
  1. Navigate to `/en/study-assistant`.
  2. Input is **autofocused** on load.
  3. Type a question in English → press Enter → response streams in; "Thinking…" indicator visible during streaming.
  4. While the answer streams, click the input again — caret lands inside it; you CAN type follow-up text immediately. (HIGH-D: was disabled before.)
  5. After the response, type and send another question → no need to click, focus is on the input.
  6. Click thumbs up → confirmation "Thanks for the feedback!".
  7. Click "New conversation" → chat clears; sessionStorage cleared.
**Pass**: Input is never disabled; streaming completes; feedback registered.

### STU-12: AI Tutor in Dari (RTL)
**Steps**:
  1. Navigate to `/fa/study-assistant`.
  2. Type a Dari question (`فتوسنتز چیست؟`) → press Enter.
  3. Caret/text rendering correct (RTL); "در حال فکر کردن…" appears as the typing label.
  4. Response streams in Dari.
**Pass**: Dari input rendered RTL; localized typing indicator.

### STU-13: Voice chat
**Steps**: On `/en/study-assistant`, click the mic button. Browser asks for mic permission. Speak a short question → text fills the input → submit → response streams. Optional: short answers (<500 chars) auto-spoken.
**Pass**: STT works; TTS plays for short answers.

### STU-14: Mode switcher (study / practice / quiz / explain / vocabulary / prepare)
**Steps**: For each mode, set the mode (chip / dropdown), ask a question. Verify the mode label displays in the assistant response and that the answer pattern matches the mode (e.g. quiz returns 5 questions).
**Pass**: All 6 modes return content shaped to the mode.

### STU-15: Self-learning paths (`/learn`)
**Steps**:
  1. `/en/learn` shows search box + popular topic cards.
  2. Type a topic ("Python basics") → submit → 4–6 lesson outline appears at `/en/learn/{pathId}`.
  3. Open lesson 1 → sections render (explanation, example, vocabulary, quiz, "Your turn", summary).
  4. Answer a quiz question → "correct" feedback; complete quiz → next lesson unlocks.
**Pass**: Path generated; lessons render; quiz advances state.

### STU-16: Spaced repetition (review items)
**Setup**: At least one vocabulary word seen during a lesson or AI response.
**Steps**:
  1. `/en/learning` shows due review items (or empty state).
  2. Click "Review" → SM-2 quality buttons (0–5).
  3. Mark "good" → next item; check `/en/dashboard` shows updated streak.
**Pass**: Items advance; streak counter updates.

### STU-17: Stories (read + write)
**Steps**:
  1. `/en/stories` lists published stories.
  2. Click a story → detail page; click 👍 like → count increments.
  3. Navigate to `/en/stories/write` (must be approved student).
  4. Use the editor: title (en + Dari toggle), cover image upload via R2 presign, gallery (≤10 images), category, tags.
  5. Save draft → drafts list shows it; auto-save triggers ~3 s after typing.
  6. "Submit for review" → status flips to pending_review.
**Pass**: Draft persists; submit moves to pending; admin sees it (see ADM-08).

### STU-18: Profile + integrations
**Steps**:
  1. `/en/profile` shows avatar, role badge, email, timezone, language.
  2. Notification preferences toggles (Telegram, Web Push, Email) — flip each → API call returns 200; reload preserves.
  3. Telegram link button → modal/panel asks for code; "open Telegram" link points to `https://t.me/{bot}?start=...`.
  4. Web push subscribe → browser prompt → after approval, `pushSubscription` saved (verify via `/api/me/notification-prefs`).
  5. Sign out button works.
**Pass**: All toggles persist; Telegram / push start flows reach external prompts.

### STU-19: Schedule via API (offline)
**Steps**: `GET /api/me/schedule` while signed in returns 200 + JSON with upcoming sessions and `joinNow` if one is current. Cache-Control: `private, max-age=30, stale-while-revalidate=60`.
**Pass**: JSON shape matches; cache headers correct.

### STU-20: Opportunities + Library browse
**Steps**:
  1. `/en/opportunities`: filter pills (ALL, SCHOLARSHIP, JOB, INTERNSHIP, GRANT) all return matching cards.
  2. Click "Open opportunity" → opens `externalUrl` in new tab.
  3. Expired opportunities show "Expired" badge with reduced opacity.
  4. `/en/library`: search by title/author; download a PDF (`Save offline` triggers Cache API).
**Pass**: Filters; expired-state correct; downloads work.

---

## 5. Teacher flows (TCH)

### TCH-01: Teacher dashboard
**Steps**: Sign in as teacher → `/en/dashboard` shows Google Calendar connect card, My Classes (up to 4), Today's Sessions, Notifications.
**Pass**: Sections render; no admin-only items.

### TCH-02: Set availability
**Steps**:
  1. `/en/teacher/availability` shows weekly grid.
  2. Tap several 30-min slots Mon–Fri → save → reload → still highlighted.
  3. Slots stored in UTC, displayed in user timezone (verify minute boundary on a Sun/Mon edge).
**Pass**: Persistence; tap target ≥44 px.

### TCH-03: My Classes (teacher view)
**Steps**: `/en/teacher/classes` lists teacher's classes with sessions; "Mark Attendance" button per session.

### TCH-04: Generate check-in code
**Steps**:
  1. Open a class session attendance page.
  2. Click "Generate code" → 4-digit numeric code appears + countdown timer (30 min).
  3. Code visible to teacher; not exposed in any student-facing endpoint until they enter it.
**Pass**: New code each click; 30-min timer.

### TCH-05: Mark attendance manually
**Steps**: From the roster, toggle a student's `attended` checkbox → API call returns 200 → reload → state preserved.

### TCH-06: Cancel session (two-step confirm)
**Steps**:
  1. Click "Cancel session" once → button label changes to "Confirm cancel?".
  2. Click again → POST → session marked cancelled; students notified via the fallback chain.
**Pass**: Two clicks required; cancellation propagates.

### TCH-07: Upload material
**Setup**: R2 must be configured.
**Steps**:
  1. From `/en/admin/classes/{id}` (or teacher class detail), click upload.
  2. Choose a 1 MB PDF → upload progresses → "Upload complete".
  3. Choose a 6 MB file → blocked with "فایل بیشتر از ۵ مگابایت است" / English equivalent (UAT MED-C).
  4. Choose a `.exe` → blocked with "نوع فایل مجاز نیست" / English.
**Pass**: Happy path uploads; size and MIME enforced; cost estimate shown.

### TCH-08: Post announcement
**Steps**: From class detail, type announcement (≤500 chars) → submit → all enrolled students get a notification (Telegram / web push / email / in-platform fallback).

### TCH-09: Generate session summary + quiz
**Steps**:
  1. After a class finishes, on the session live page, click "Generate summary".
  2. Summary appears in markdown.
  3. Click "Generate quiz" → 5-question quiz appears.
  4. Confirm both are saved (refresh).
**Pass**: Both LLM calls complete and persist.

### TCH-10: Assign homework
**Steps**: Create a homework assignment (title 3–200 chars, description 10–5000, optional due date) → it appears for every enrolled student on their session view.

### TCH-11: View AI insights for a class
**Steps**: `/api/teacher/ai-insights?classId={id}` (or UI link) returns/shows: total questions in 7 days, mode breakdown, satisfaction rate, top topics, struggled topics, daily volume.

---

## 6. Admin flows (ADM)

### ADM-01: Admin dashboard
**Steps**: As admin, `/en/dashboard` shows Quick Actions panel: Create class, Add opportunity, View pending users, AI Dashboard. **Verify "Create class" links to `/en/admin/classes`** (UAT CRIT-B regression).

### ADM-02: User approvals
**Steps**:
  1. `/en/admin/users` lists pending users.
  2. Search bar filters by name / email / phone.
  3. Bulk-select checkbox → "Approve selected" works.
  4. Single-row Approve works.
  5. Approved users disappear from the pending tab.
**Pass**: Bulk + single both work; search filter applies.

### ADM-03: Create class (UAT regression — "admin can only view, not create")
**Steps**:
  1. From dashboard click Create class → arrives at `/en/admin/classes`.
  2. AdminClassForm visible: name, subject category, description, teacher dropdown, max students, duration, schedule preference, language.
  3. Submit → class appears in the list below.
**Pass**: Class created with all required fields; visible in catalog.

### ADM-04: Edit / archive class
**Steps**:
  1. Click "View" on a row → class detail.
  2. Inline edit name / desc / maxStudents → save → refresh persists.
  3. Click "Archive" → confirm → class moves to archived count, disappears from student catalog.
**Pass**: Edit + archive both behave; archived hidden from /en/classes.

### ADM-05: Run scheduler
**Steps**: Click "Run scheduler" button. Scheduler creates upcoming sessions for all active classes with assigned teachers + availability. Sessions appear in admin dashboard.

### ADM-06: Run reminders
**Steps**: Click "Run reminders". Verifies WhatsApp/Telegram/email/web-push delivery via the fallback chain (depending on what's configured). Notifications table grows.

### ADM-07: Webinar create + delete (UAT HIGH-C)
**Steps**:
  1. `/en/admin/content` → WebinarForm: title, description, startsAt, meetLink, language → submit → row appears on `/en/webinars`.
  2. On `/en/webinars` (admin view): each card shows the **Delete** button (UAT HIGH-C).
  3. Click Delete → button label changes to "تایید حذف؟" / "Confirm delete?" → click again → row removed; refresh confirms gone.
**Pass**: Create + two-step delete both work; Dari label correct on `/fa/webinars`.

### ADM-08: Opportunity create + delete (UAT HIGH-C)
**Steps**:
  1. `/en/admin/content` → OpportunityForm: title, type (Scholarship/Job/Internship/Grant), description, deadline, externalUrl → submit.
  2. On `/en/opportunities`: card shows correct type colour; Delete button visible to admin.
  3. Two-step delete works.
  4. Set deadline in the past → card auto-shows "Expired" badge (UAT regression: expired must be deletable).
**Pass**: All four type chips render; expired ones still deletable.

### ADM-09: Library resource create
**Steps**: LibraryForm at `/en/admin/content` → title, author, category, fileUrl (R2 presign or external) → submit → appears on `/en/library`.

### ADM-10: Story moderation (`/en/admin/posts`)
**Setup**: STU-17 left a `pending_review` post.
**Steps**:
  1. Pending tab shows the post (oldest-first).
  2. Click "Preview" → modal with full content.
  3. Click "Reject" → mandatory feedback note → save → post status = rejected; user sees note.
  4. Repeat with "Approve" → status = published; "Feature/Unfeature" toggle works.
**Pass**: Approve, reject (with note), feature all behave; audit log row added.

### ADM-11: Analytics dashboard
**Steps**: `/en/admin/analytics` loads metrics (growth, engagement, AI performance, content, retention). SVG charts render. Copy-to-clipboard button copies the JSON snapshot.

### ADM-12: AI dashboards (superadmin only)
**Steps** (only the superadmin email gets these tiles):
  1. `/en/admin/ai` shows provider status (Groq, Gemma, HF), cache stats, RAG params.
  2. `/api/admin/ai-evaluation?days=7` (or its UI) returns scores aggregated by 4 dimensions, A/B variant breakdown.
  3. `/api/admin/ai-review-queue` (or UI) returns 20 lowest-scored unreviewed responses; a teacher submits human scores → state updates.
**Pass**: All three load; numbers non-zero in a real environment.

### ADM-13: Curriculum gaps
**Steps**: `/en/admin/...` curriculum-gaps endpoint or UI returns topics with ≥3 questions and >50 % bad-answer ratio. Click "Generate material" → LLM produces a draft (status = draft, awaiting teacher review).

### ADM-14: System status
**Steps**: `/api/admin/system-status` returns runtime mode, storage availability, DB availability, integration flags (Google OAuth, Resend, WhatsApp, Cron).

### ADM-15: Google Calendar connect
**Steps**: Admin dashboard → "Connect Google" → consent flow → returns to dashboard with email + calendar shown. (Per OAUTH_SETUP.md, redirect URI must be allow-listed in GCP.)

---

## 7. AI features cross-cutting (AI)

### AI-01: RAG ingestion (admin)
**Steps**: `POST /api/ai/ingest` with `{sourceType:"LIBRARY", sourceId:..., sourceTitle:..., content:"..."}`. Returns `chunksCreated > 0`. Asking the StudyAssistant about that content surfaces the chunk as a source.

### AI-02: Source citations
**Steps**: After an answer, click "Sources" → expandable list of titles + similarity. Each source corresponds to ingested content.

### AI-03: Cache hit
**Steps**: Ask the same question twice → second response returns much faster; provider field shows "cache" in admin AI dashboard.

### AI-04: Confidence levels
**Steps**: Ask a question well-covered by ingested content → confidence badge "High" (green) before the answer streams. Ask an off-topic question → "Low" (amber/red) badge.

### AI-05: Safety / guardrails
**Steps**: Ask a violating prompt (e.g. "explain how to make explosives"). Response is blocked or warned per `safetyAction`. AISafetyLog row created (verify via admin).

### AI-06: Quick AI in session (`/api/ai/quick`)
**Steps**: From a live session panel, ask a 1-sentence question → answer in 1–3 sentences. Rate-limited: 30 / 5 min.

### AI-07: Homework photo review
**Steps**: From STU-10 path, upload a photo of homework → Gemini Vision returns review JSON: corrected answer, feedback paragraphs, encouragement.

### AI-08: Recording → transcript → embeddings
**Steps**: From session live page (teacher), upload an audio file (≤50 MB) or paste a transcript ≥50 chars. Whisper produces transcript; chunks land in DocumentChunk; the class's AI tutor can now answer about it.

---

## 8. Notifications & integrations (INT)

### INT-01: Telegram link end-to-end
**Steps**:
  1. From `/en/profile` click "Link Telegram" → token + URL appear.
  2. Open `t.me/{bot}` from a real Telegram, send `/start {token}`.
  3. Bot replies "Account linked". `/api/integrations/telegram/link` (GET) reports linked = true.
  4. Send a plain question to the bot → answer streams back via the RAG pipeline (with sources appended).
  5. Unlink button works; `/start` again no longer routes RAG queries.

### INT-02: Web push
**Steps**: STU-18 already covers subscription. Now trigger a notification (e.g. teacher posts an announcement) → push appears in OS notifications.

### INT-03: Email (SMTP)
**Setup**: SMTP_USER + SMTP_PASS configured.
**Steps**: Trigger an admin-approval-pending event for a real account → email arrives in inbox.

### INT-04: Notification fallback chain
**Steps**: Disable Telegram (toggle off in profile) → send announcement → user receives via the next channel (web push); disable that → email; disable that → in-platform notification card.

---

## 9. Internationalization & RTL (I18N)

### I18N-01: Every authenticated page in /fa
For every page in §4–§6 above, repeat in `/fa`:
- `dir="rtl"` on `<html>`
- Persian/Dari strings render (no curly braces / placeholders leaking through)
- Arabic numerals (۰–۹) where appropriate

### I18N-02: Mixed-direction text
**Steps**: A class titled "Korean A1" in Dari UI renders the English class name correctly without breaking layout.

### I18N-03: Localized error messages (UAT HIGH-B + MED-A)
**Steps**:
  - On `/fa/register`, submit `me@gmail.con` → Dari error appears.
  - On `/fa/classes`, attempt 4th enrolment → Dari "limitReached" error.

### I18N-04: Locale switcher preserves path
**Steps**: From `/en/admin/classes` click `دری` → goes to `/fa/admin/classes`, not `/fa`.

---

## 10. Performance, PWA, accessibility (PWA)

### PWA-01: Lighthouse audit (mobile)
**Steps**: Run Lighthouse on `/fa` and `/fa/dashboard`. Targets: Performance ≥ 70 on mobile (Render free tier limits us; landing page ideally ≥ 85), Accessibility ≥ 90, PWA installable.

### PWA-02: Throttled network test
**Steps**: DevTools → Network → "Slow 3G". Reload `/fa`. Total transfer should be < 600 KB and the page interactive within ~10 s. (BRD targets 200 KB / 3 s on 500 kbps; honest current state is heavier — record the numbers.)

### PWA-03: Install prompt
**Steps**: On Chrome Android, tap "Add to home screen". App installs with manifest icon.

### PWA-04: Offline page
**Steps**: While offline, navigate to a non-cached URL → service worker returns the offline page from `/fa/offline`.

### PWA-05: Keyboard navigation
**Steps**: Tab through `/en/login` and `/en/dashboard` — every interactive element is reachable in DOM order; focus rings visible.

### PWA-06: Color contrast
**Steps**: Spot-check via axe DevTools on landing, login, dashboard, study-assistant, register. Issues = 0 critical.

---

## 11. Security & edge cases (SEC)

### SEC-01: Pre-enrolment privacy
**Steps**: As student NOT enrolled, fetch `/api/classes/{id}` → response has `meetLink: null` and no materials.

### SEC-02: Materials gated
**Steps**: As enrolled student, GET `/api/classes/{id}/materials` → 200. Drop the class. Re-fetch → 403.

### SEC-03: Role escalation attempts
**Steps**: As STUDENT, POST to `/api/admin/classes`, `/api/admin/users/{id}` (PATCH `{approved:true}`), `/api/admin/webinars/{id}` (DELETE) → all 403.

### SEC-04: Rate limiting
**Steps**: Hit `/api/auth/[...nextauth]` login with wrong password 6+ times → on 6th, no session (in-memory limiter triggers).

### SEC-05: XSS in titles / posts
**Steps**: Submit a class name `<script>alert(1)</script>` (admin) and a story title with HTML → rendered as plain text everywhere it appears (server `stripHtml`).

### SEC-06: SQL injection in search
**Steps**: Search classes with `'; DROP TABLE Class; --` → 200, no error, Prisma params escape it.

### SEC-07: CSRF on mutating routes
**Steps**: From a different origin, POST to `/api/classes/{id}/enroll` without `Cookie` → 401. With a stolen cookie but `Origin` mismatch — confirm CORS allowlist drops it.

### SEC-08: Phone encryption
**Steps**: Register with a phone number. Inspect DB row directly (admin SQL): `phone` is base64 ciphertext, not the plain number.

### SEC-09: Session expiry display
**Steps**: After SEC-04 lockout, any UI showing "rate limited" message renders without leaking timing.

### SEC-10: Audit log
**Steps**: Approve a user, archive a class, reject a post — each row appears in `AuditLog` with `actorId`, `action`, `targetType/Id`.

---

## 12. UAT regression coupling (UAT)

These map directly to the 11 issues from `UAT/UAT Test.docx` (2026-04-26).

| ID    | Issue                                                  | Test case(s)              |
|-------|--------------------------------------------------------|---------------------------|
| UAT-1 | Admin sidebar links bounced to /login                  | AUTH-03, ADM-01..14       |
| UAT-2 | Dashboard "Create Class" → wrong page                  | ADM-01, ADM-03            |
| UAT-3 | Team photos missing                                    | PUB-06                    |
| UAT-4 | Email validation accepted typos                        | REG-03, REG-04, REG-05    |
| UAT-5 | Cannot delete webinars                                 | ADM-07                    |
| UAT-6 | Cannot delete expired opportunities                    | ADM-08                    |
| UAT-7 | AI Tutor input was unusable                            | STU-11, STU-12            |
| UAT-8 | Webinars and Opportunities looked identical            | PUB-09                    |
| UAT-9 | No enrollment cap                                      | STU-05                    |
| UAT-10| Class catalog mixed scheduled / pending                | STU-02 (status dot)       |
| UAT-11| 5 MB upload error not localized                        | TCH-07 step 3             |

Pass criterion for the UAT round: every row above passes its mapped test in `/fa` and `/en`.

---

## 13. Reporting

For each test case, record:
- ID, locale, role, browser, timestamp
- Pass / fail / partial / skipped
- Screenshot of failure (DOM inspector + network tab)
- Console + network errors
- Repro recipe (URL, inputs)

Output as a single Markdown report `PROD_TEST_REPORT_{date}.md` at the repo root, mirroring the structure of this plan. Group failures by severity: Critical / High / Medium / Low / Cosmetic — same scale as `QA_REPORT_2026-04-14.md`.

---

## Appendix A — quick smoke (≤ 10 minutes)

If short on time, run only these 12 cases to confirm a healthy deploy:

PUB-01, PUB-02, PUB-06, AUTH-01, AUTH-03, REG-04, STU-02, STU-04, STU-05, STU-11, ADM-03, ADM-07.
