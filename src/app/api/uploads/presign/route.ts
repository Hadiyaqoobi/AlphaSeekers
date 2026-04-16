import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { createPresignedUploadUrl, isR2Configured } from "@/lib/integrations/r2";
import { getSessionUser } from "@/lib/security/session";

const uploadSchema = z.object({
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(100),
    fileSize: z.number().int().positive().max(5 * 1024 * 1024), // 5MB
    purpose: z.enum(["material", "library", "posts"]).default("material"),
    classId: z.string().optional(),
});

/**
 * POST /api/uploads/presign
 * Returns a presigned URL for direct client-to-R2 upload.
 * Body: { filename, contentType, fileSize, purpose, classId? }
 */
export async function POST(request: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid upload request", errors: parsed.error.flatten().fieldErrors },
            { status: 400 },
        );
    }

    const { filename, contentType, fileSize, purpose, classId } = parsed.data;

    // Only TEACHER/ADMIN can upload materials and library
    // Any approved user can upload for "posts" (student voices)
    if (purpose === "material" || purpose === "library") {
        if (user.role !== "TEACHER" && user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }
    } else if (purpose === "posts") {
        if (!user.approved) {
            return NextResponse.json({ message: "Account pending approval" }, { status: 403 });
        }
    }

    if (!isR2Configured()) {
        return NextResponse.json(
            { message: "File uploads not configured. Contact administrator to set up R2." },
            { status: 503 },
        );
    }

    // Build a unique key: purpose/classId|userId/timestamp-filename
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    let prefix: string;
    if (purpose === "material" && classId) prefix = `materials/${classId}`;
    else if (purpose === "posts") prefix = `posts/${user.id}`;
    else prefix = "library";
    const key = `${prefix}/${timestamp}-${sanitized}`;

    try {
        const result = createPresignedUploadUrl(key, contentType, fileSize);
        if (!result) {
            return NextResponse.json({ message: "Upload service unavailable" }, { status: 503 });
        }

        return NextResponse.json({
            uploadUrl: result.uploadUrl,
            publicUrl: result.publicUrl,
            maxSize: result.maxSize,
            key,
        });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Upload failed" },
            { status: 400 },
        );
    }
}
