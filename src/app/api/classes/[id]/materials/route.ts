import { NextRequest, NextResponse } from "next/server";

import { normaliseHttpUrl } from "@/lib/security/safe-url";

import { createClassMaterial, getClassById, isStudentEnrolledInClass, listClassMaterials } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, roleAllowed, unauthorized } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";

type Params = {
  params: { id: string };
};

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const klass = await getClassById(params.id);

  if (!klass) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const allowed =
    user.role === "ADMIN" ||
    (user.role === "TEACHER" && user.id === klass.teacherId) ||
    (user.role === "STUDENT" && (await isStudentEnrolledInClass(user.id, klass.id)));

  if (!allowed) {
    return NextResponse.json({ message: "Not allowed to view materials" }, { status: 403 });
  }

  return NextResponse.json({ items: await listClassMaterials(params.id) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  if (!roleAllowed(user.role, ["TEACHER", "ADMIN"])) {
    return NextResponse.json({ message: "Only teachers/admins can upload materials" }, { status: 403 });
  }

  const klass = await getClassById(params.id);

  if (!klass) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  // Owning teacher keeps access; any non-owner (including a scoped employee
  // with role=ADMIN) must hold classes.edit to upload.
  const access = await getAccessControl();
  if (!access) {
    return unauthorized();
  }
  const isOwner = access.userId === klass.teacherId;
  if (!isOwner && !can(access, "classes.edit")) {
    return NextResponse.json({ message: "Only the assigned teacher can upload materials" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    fileUrl?: string;
    fileSize?: number;
  };

  if (!body.title) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  // Accepts either an uploaded file URL or a link the teacher pasted (Drive,
  // OneDrive, a public PDF). Either way it ends up in an href, so it must be
  // http(s) -- see isSafeHttpUrl.
  const fileUrl = normaliseHttpUrl(body.fileUrl);
  if (!fileUrl) {
    return NextResponse.json(
      { message: "A valid http(s) link or uploaded file is required" },
      { status: 400 },
    );
  }

  // Size is unknown for a pasted link; 0 means "not measured", and the cap only
  // applies to files we actually received.
  const fileSize = typeof body.fileSize === "number" && body.fileSize > 0 ? body.fileSize : 0;
  if (fileSize > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 });
  }

  const material = await createClassMaterial({
    classId: params.id,
    title: body.title,
    fileUrl,
    fileSize,
    uploadedBy: user.id,
  });

  return NextResponse.json(material, { status: 201 });
}
