# ADR-0009 — The class sign-up form stays on the platform

- **Status:** Proposed (not yet built; needs the team's go-ahead and Dari text)
- **Date:** 2026-10-14
- **Deciders:** Platform engineering, AlphaSeekers team
- **Related:** `src/lib/platform/class-join.ts`, `src/components/classes/class-join-form.tsx`,
  `src/app/[locale]/join/[classId]/page.tsx`, `src/lib/platform/class-create.ts`,
  ADR-0007 and ADR-0008 (database cost)

## Context

The team and students keep asking for "a Google Form for each class". Two things
sit behind that request:

1. **Their own questions per class** — phone or WhatsApp number, age, province,
   English level, "why do you want to join?". The join page asks only for name,
   email and a password.
2. **A spreadsheet of who signed up**, which is what a Google Form gives them.

Students also find inventing a password hard; most already have Gmail.

The platform's Google connection today only has the `calendar.events` scope, per
teacher, for Meet links. Creating forms would need the Forms and Drive scopes,
which Google classes as sensitive and may require app verification for.

## Options considered

**A. Auto-create a real Google Form per class (Forms API).** Rejected. Answers land
in a spreadsheet and the student is NOT in the class: no account, no Meet link,
no reminders. That is exactly the dead end `/join` was built to remove in
September 2026. Making it work needs an hourly job that reads responses and
enrols people by email, which breaks when anyone edits the form, when a student
types their email differently, or when the person who owns the form leaves. It
also adds a Google review and a per-account dependency.

**B. Keep pasting a Google Form link.** Already supported: staff can add their own
form link under "More options" when posting a class; students see it on the class
page after they join. Fine as a stop-gap, but answers live outside the platform.

**C. Questions on the platform's own join page (chosen).**

## Decision (proposed)

1. **Per-class questions.** When posting a class, staff tick ready-made questions
   (phone / WhatsApp, age, province, English level, reason for joining) and may add
   up to five of their own (short text, paragraph, or one-of-several choice). Stored
   as a small JSON list on `Class` (`joinQuestions`).
2. **Answers stored with the enrolment.** `/join/<id>` shows the questions under
   name and email; answers are saved as JSON on `Enrollment` (`answers`) in the
   same transaction that creates the enrolment. Name, email and the one-step
   sign-in stay fixed underneath, so joining still puts the student in the class.
3. **"Join with Google".** A Google button on `/join` (Google sign-in already exists
   on `/login`): one tap signs the student in and enrols them, no password to
   invent. The password path stays for students without Gmail.
4. **Responses as a spreadsheet.** The class page gets a responses table and a
   "Download for Google Sheets" (CSV, UTF-8 with BOM so Dari displays correctly)
   button. Optionally later: push to a Google Sheet the team owns.

## Consequences

- **Database cost: none extra.** Answers are written in the same request as the
  join, which already wakes the database; reading them happens on a staff page
  that already queries. Two nullable JSON columns, additive migration, a few KB per
  class. Nothing new runs on a timer.
- Every question label and the ready-made questions need Dari from the team before
  launch (the platform never ships machine-written Dari).
- Answers can contain personal data (phone, age). They are visible only to the
  class's teacher and staff with `classes.view`, removed when the student's account
  is deleted, and never sent to an AI provider.
- Google sign-in on `/join` must keep the existing rules: verified Google email
  only, never raises a role, refuses deactivated accounts.
