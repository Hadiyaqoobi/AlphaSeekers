import { NextResponse } from "next/server";

import { registerForWebinar } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

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

  try {
    const registration = await registerForWebinar(params.id, user.id);
    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Registration failed" },
      { status: 400 },
    );
  }
}
