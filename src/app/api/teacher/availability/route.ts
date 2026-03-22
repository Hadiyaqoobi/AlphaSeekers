import { NextRequest, NextResponse } from "next/server";

import { listTeacherAvailability, replaceTeacherAvailability, scheduleTeacherClasses } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, roleAllowed, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const teacherId = request.nextUrl.searchParams.get("teacherId") ?? user.id;

  if (user.role !== "ADMIN" && teacherId !== user.id) {
    return NextResponse.json({ message: "Not allowed to view this teacher" }, { status: 403 });
  }

  return NextResponse.json({ items: await listTeacherAvailability(teacherId) });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  if (!roleAllowed(user.role, ["TEACHER", "ADMIN"])) {
    return NextResponse.json({ message: "Only teachers/admins can update availability" }, { status: 403 });
  }

  const body = (await request.json()) as {
    teacherId?: string;
    slots?: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  };

  const teacherId = user.role === "ADMIN" ? body.teacherId ?? user.id : user.id;

  if (!body.slots || !Array.isArray(body.slots)) {
    return NextResponse.json({ message: "Invalid slots payload" }, { status: 400 });
  }

  for (const slot of body.slots) {
    if (typeof slot.dayOfWeek !== "number" || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      return NextResponse.json({ message: "dayOfWeek must be 0-6" }, { status: 400 });
    }
    if (typeof slot.startMinute !== "number" || typeof slot.endMinute !== "number") {
      return NextResponse.json({ message: "startMinute and endMinute are required" }, { status: 400 });
    }
    if (slot.endMinute <= slot.startMinute) {
      return NextResponse.json({ message: "End time must be after start time" }, { status: 400 });
    }
  }

  const saved = await replaceTeacherAvailability(teacherId, body.slots);

  // Fire-and-forget: immediately schedule sessions for this teacher's classes
  scheduleTeacherClasses(teacherId).catch((err) => {
    console.error("Post-availability scheduling failed:", err);
  });

  return NextResponse.json({ items: saved });
}
