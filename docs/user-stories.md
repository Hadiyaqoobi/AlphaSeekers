# AlphaSeekers User Stories (10) + Automated Coverage

This document lists 10 core user stories for AlphaSeekers and maps each story to automated checks in `scripts/smoke.mjs`.

## US-01: Request Access (Student/Teacher)

As a new student or teacher, I want to register for access so that I can join the platform once approved.

Acceptance criteria:
- Registration creates a new account in a pending state.
- Pending accounts cannot sign in until an admin approves them.

Automated test:
- `npm run smoke` (US-01)

## US-02: Approve Users (Admin)

As an admin, I want to approve pending students/teachers so that only vetted users can access the platform.

Acceptance criteria:
- Admin can list pending users.
- Admin can approve a pending user.
- Once approved, the user can sign in.
- Teachers/students cannot access admin approval endpoints.

Automated test:
- `npm run smoke` (US-02)

## US-03: Browse And Search Classes (Student)

As a student, I want to browse and search the class catalog so that I can find a class that fits my goal.

Acceptance criteria:
- Approved students can load the class list.
- Searching by class name returns matching classes.
- Approved students can browse library resources and opportunities.

Automated test:
- `npm run smoke` (US-03)

## US-04: Class Detail Is Safe Before Enrollment (Student)

As a student, I want class details to hide private join links until I enroll so that access is protected.

Acceptance criteria:
- Before enrollment, Meet links are not returned to the student.
- Before enrollment, materials are not returned to the student.

Automated test:
- `npm run smoke` (US-04)

## US-05: Enroll And Unenroll (Student)

As a student, I want to enroll in a class and later unenroll so that my access matches my enrollment.

Acceptance criteria:
- Student can enroll successfully.
- After enrollment, Meet links become visible for that class.
- Student can unenroll successfully.
- After unenrollment, Meet links and materials are no longer accessible.

Automated test:
- `npm run smoke` (US-05)

## US-06: Schedule Shows Multi-Segment Classes (Student)

As a student, I want my schedule to include continuation details for classes longer than 60 minutes so that I can transition seamlessly.

Acceptance criteria:
- The schedule endpoint includes a `continuation` segment when a class has multiple sessions close together.

Automated test:
- `npm run smoke` (US-06)

## US-07: Manage Availability (Teacher)

As a teacher, I want to manage my availability so that scheduling can respect when I can teach.

Acceptance criteria:
- Teacher can read their availability.
- Teacher can update their availability.
- Students cannot update teacher availability.

Automated test:
- `npm run smoke` (US-07)

## US-08: Upload Materials (Teacher/Admin)

As a teacher, I want to upload materials to my own class so students can download them before/after sessions.

Acceptance criteria:
- Assigned teacher can upload materials for their class.
- Teachers cannot upload materials to other teachers' classes.
- Admin can upload materials to any class.

Automated test:
- `npm run smoke` (US-08)

## US-09: Admin Class Lifecycle (Create, Schedule, Archive)

As an admin, I want to create classes, trigger scheduling, and archive classes so the catalog stays current.

Acceptance criteria:
- Admin can create a class.
- Scheduler can generate upcoming session(s) for active classes.
- Admin can archive a class.
- Archived classes no longer appear in the student catalog.

Automated test:
- `npm run smoke` (US-09)

## US-10: Webinar Registration Unlocks Join Link (Student)

As a student, I want to register for a webinar so I can receive the join link.

Acceptance criteria:
- Before registration, the join link is hidden.
- After registration, the join link is visible for that student.

Automated test:
- `npm run smoke` (US-10)
