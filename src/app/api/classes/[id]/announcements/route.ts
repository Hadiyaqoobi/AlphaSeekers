import { NextRequest, NextResponse } from "next/server";

import { createClassAnnouncement, getClassById, isStudentEnrolledInClass, listClassAnnouncements } from "@/lib/platform/store";
import { deliverAndRecord, listClassDeliveryTargets } from "@/lib/platform/db-store";
import { getSessionUser } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // IDOR guard: only admin, the owning teacher, or an enrolled student may
  // read a class's announcements (matches the materials route).
  const klass = await getClassById(params.id);
  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  const canRead =
    user.role === "ADMIN" ||
    (user.role === "TEACHER" && user.id === klass.teacherId) ||
    (user.role === "STUDENT" && (await isStudentEnrolledInClass(user.id, params.id)));
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const announcements = await listClassAnnouncements(params.id);
  return NextResponse.json({ items: announcements });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.approved && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Account not approved" }, { status: 403 });
  }

  // Staff and the teacher may post to an unpublished class (it still has students).
  const klass = await getClassById(params.id, { includeUnpublished: true } as Parameters<typeof getClassById>[1]);
  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Keep teacher-ownership access, but require the permission on the non-owner
  // path so a scoped employee (role=ADMIN without classes.edit) cannot post.
  const access = await getAccessControl();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwner = access.userId === klass.teacherId;
  if (!isOwner && !can(access, "classes.edit")) {
    return NextResponse.json({ error: "Not your class" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.content !== "string" || body.content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Rejected, not silently cut: a teacher whose message lost its second half
  // without being told would assume students read all of it.
  const MAX_ANNOUNCEMENT_LENGTH = 500;
  const content = body.content.trim();
  if (content.length > MAX_ANNOUNCEMENT_LENGTH) {
    return NextResponse.json(
      {
        error: `Announcement is too long (${content.length} characters). The limit is ${MAX_ANNOUNCEMENT_LENGTH}.`,
        message: `Announcement is too long (${content.length} characters). The limit is ${MAX_ANNOUNCEMENT_LENGTH}.`,
      },
      { status: 400 },
    );
  }
  const announcement = await createClassAnnouncement({
    classId: params.id,
    authorId: user.id,
    authorName: user.name ?? "Teacher",
    content,
  });

  // Notify all enrolled students on every channel they have enabled (this used
  // to pass only an email, so Telegram/push were skipped), awaited and recorded as
  // Notification rows -- un-awaited sends could be dropped when the request ended.
  let notified = { recipients: 0, sent: 0 };
  try {
    const students = await listClassDeliveryTargets(params.id);
    notified = await deliverAndRecord(
      students,
      () => `${klass.name}: ${content}`,
      (student) => `class_announcement:${announcement.id}:${student.id}`,
    );
  } catch (error) {
    // The announcement is saved either way; delivery failures are logged.
    console.error("[announcements] delivery failed", params.id, error);
  }

  return NextResponse.json({ ...announcement, notified }, { status: 201 });
}
