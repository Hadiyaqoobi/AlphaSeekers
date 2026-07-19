import { NextRequest, NextResponse } from "next/server";

import { createClassAnnouncement, getClassById, listClassAnnouncements, listClassEnrollments } from "@/lib/platform/store";
import { deliverWithFallback } from "@/lib/integrations/notifications";
import { getSessionUser } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const klass = await getClassById(params.id);
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

  const content = body.content.trim().slice(0, 500);
  const announcement = await createClassAnnouncement({
    classId: params.id,
    authorId: user.id,
    authorName: user.name ?? "Teacher",
    content,
  });

  // Notify all enrolled students
  try {
    const enrollments = await listClassEnrollments(params.id);
    const message = `${klass.name}: ${content}`;
    for (const enrollment of enrollments) {
      deliverWithFallback(
        { userId: enrollment.studentId, email: enrollment.email },
        message,
      ).catch(() => {
        // Best-effort notification
      });
    }
  } catch {
    // Notification delivery is best-effort
  }

  return NextResponse.json(announcement, { status: 201 });
}
