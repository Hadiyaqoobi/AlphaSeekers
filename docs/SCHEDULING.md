# Class Scheduling

Every class chooses one of two scheduling modes when it is created. The mode is
stored on the class (`Class.schedulingMode`, a `SchedulingMode` enum, default
`AUTO`) and decides who sets the date & time of each session.

## The two modes

### Automatic (`AUTO`) — default

The availability-driven auto-scheduler owns the calendar. It reads the class's
`schedulePreference` and the teacher's availability and creates sessions on its
own. This is the historical behavior: creating an `AUTO` class produces its first
session immediately, and the scheduler keeps proposing future sessions.

Auto-proposed sessions have `Session.confirmedAt = null`. They are real sessions
students can join; the null flag simply records that a human did not hand-place
them.

Pick `AUTO` when the class runs on a predictable cadence and you want the system
to keep the calendar filled without manual work.

### Manual (`MANUAL`)

The instructor sets and confirms the exact time of every session. Two things
change versus `AUTO`:

- **Class creation does not auto-create a session.** A `MANUAL` class is created
  with an empty calendar. It stays empty until the instructor adds sessions.
- **The auto-scheduler skips the class entirely.** It never proposes, moves, or
  fills sessions for a `MANUAL` class, so it can never overwrite an
  instructor-placed time.

Instructor-placed sessions carry `Session.confirmedAt` set to the moment they
were created or confirmed (non-null = instructor-confirmed).

Pick `MANUAL` when times vary week to week, or when the instructor wants full
control over exactly when the class meets.

## Choosing the mode

Both class-creation forms — the admin form
(`src/components/forms/admin-class-form.tsx`) and the staff form
(`src/components/staff/staff-class-form.tsx`) — expose a **Scheduling** control
with the two options above. The chosen value is sent as `schedulingMode` in the
JSON body of the create request (`POST /api/admin/classes` and
`POST /api/staff/classes`). `AUTO` is preselected.

## The instructor schedule page

Instructors manage a `MANUAL` class's calendar on the schedule page:

```
/teacher/classes/[classId]/schedule
```

From there the instructor adds a new session at an explicit date & time,
reschedules an existing one, or confirms a proposed time. These actions are
backed by the helpers in `src/lib/scheduling/sessions.ts`:

- `createManualSession({ classId, startTime, durationMinutes? })`
- `rescheduleSession({ sessionId, startTime, durationMinutes? })`
- `confirmSession(sessionId)`

Each helper returns `{ ok: true, sessionId }` or `{ ok: false, error }`,
generates the session's Meet link, and emits a student-notification event so
enrolled students are told about the new or moved session. Authorization is the
calling route's responsibility — the helpers assume an already-authorized caller
and act on the class's own teacher.

Session times are validated: the start must be a real date and cannot be in the
past (a small grace window absorbs clock skew), and the duration is clamped to a
sane range, falling back to the class's default when not supplied.

## How Meet links are generated

Meet links are created per session through Google Calendar
(`src/lib/integrations/meet.ts`). Generating a working link requires that the
class's teacher has connected their Google account (an OAuth refresh token stored
in `GoogleAccountLink`). When that is in place, the session gets a live Meet link
and a `GENERATED` status.

If Google is not connected — no configured OAuth credentials, no linked teacher,
or the teacher has not connected Google Calendar — the link is left **pending**
(`PENDING` status, no link yet) rather than failing the session. The session is
still created; the Meet link fills in once Google is connected. (In non-production
runtimes that allow it, a mock link may be generated instead of pending.)

This is the same Meet-link path for both modes: an `AUTO` session created by the
scheduler and a `MANUAL` session created by the instructor generate their links
identically.
