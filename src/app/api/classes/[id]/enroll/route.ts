import { NextResponse } from "next/server";

import { dropStudentFromClass, enrollStudentInClass } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, roleAllowed, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

export async function POST(_: Request, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  if (!roleAllowed(user.role, ["STUDENT", "ADMIN"])) {
    return NextResponse.json({ message: "Only students can enroll." }, { status: 403 });
  }

  try {
    const result = await enrollStudentInClass(user.id, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Enrollment failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const dropped = await dropStudentFromClass(user.id, params.id);

  if (!dropped) {
    return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Dropped from class", enrollment: dropped });
}
