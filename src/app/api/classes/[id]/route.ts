import { NextResponse } from "next/server";

import { getClassById, isStudentEnrolledInClass } from "@/lib/platform/store";
import { can, getAccessControl } from "@/lib/security/permissions";
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

  // Unpublished classes are fetched too, then limited below to the people who
  // already belong to them.
  const selected = await getClassById(params.id, { includeUnpublished: true });

  if (!selected) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  // Staff by PERMISSION, not by role: every scoped employee (moderator,
  // finance, support...) has role ADMIN, and a role check handed all of them
  // every class's private details.
  const isStaff = user.role === "ADMIN" && can(await getAccessControl(), "classes.view");
  const isOwner = user.role === "TEACHER" && user.id === selected.teacherId;
  const enrolled =
    !isStaff && !isOwner && user.role === "STUDENT"
      ? await isStudentEnrolledInClass(user.id, selected.id)
      : false;
  const canAccessPrivateDetails = isStaff || isOwner || enrolled;

  if (!selected.published && !canAccessPrivateDetails) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const safe = canAccessPrivateDetails
    ? selected
    : {
        ...selected,
        // Private join details are for enrolled students / staff only. The WhatsApp
        // group invite and Meet links must not leak to any approved-but-not-enrolled user.
        // (Check-in codes and Google event ids are never in `sessions` at all.)
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
