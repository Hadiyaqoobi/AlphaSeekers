import { NextResponse } from "next/server";

import { getClassById, isStudentEnrolledInClass } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const selected = await getClassById(params.id);

  if (!selected) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const canAccessPrivateDetails =
    user.role === "ADMIN" ||
    (user.role === "TEACHER" && user.id === selected.teacherId) ||
    (user.role === "STUDENT" && (await isStudentEnrolledInClass(user.id, selected.id)));

  const safe = canAccessPrivateDetails
    ? selected
    : {
        ...selected,
        // Private join details are for enrolled students / staff only. The WhatsApp
        // group invite and Meet links must not leak to any approved-but-not-enrolled user.
        whatsappGroupUrl: null,
        sessions: selected.sessions.map((session) => ({
          ...session,
          meetLink: null,
        })),
        materials: [],
      };

  return NextResponse.json(safe, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}
