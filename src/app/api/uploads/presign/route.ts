import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { createPresignedUploadUrl, isR2Configured } from "@/lib/integrations/r2";
import { prisma } from "@/lib/prisma";
import { can, getAccessControl } from "@/lib/security/permissions";
import { getSessionUser } from "@/lib/security/session";

const uploadSchema = z.object({
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(100),
    fileSize: z.number().int().positive().max(5 * 1024 * 1024), // 5MB
    purpose: z.enum(["material", "library", "posts"]).default("material"),
    classId: z.string().trim().min(1).max(100).optional(),
});

/**
 * What each purpose may upload. The bucket is PUBLIC, so a free-text type
 * meant anyone could host text/html (a phishing page on our domain's bucket)
 * or image/svg+xml (script). Images are raster formats only; documents are the
 * ones the material/library picker offers (file-upload.tsx). Posts are also
 * used for homework photos, which some phones produce as HEIC.
 */
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_TYPES: Record<"material" | "library" | "posts", readonly string[]> = {
    material: [
        ...IMAGE_TYPES,
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
    ],
    library: [
        ...IMAGE_TYPES,
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
    ],
    posts: [...IMAGE_TYPES, "image/heic", "image/heif"],
};

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

    const { filename, fileSize, purpose, classId } = parsed.data;
    const contentType = parsed.data.contentType.toLowerCase();

    if (!ALLOWED_TYPES[purpose].includes(contentType)) {
        return NextResponse.json(
            { code: "type_not_allowed", message: "This file type cannot be uploaded here." },
            { status: 400 },
        );
    }

    // material: the class's own teacher, or staff holding classes.edit — for
    //   THAT class. It used to be any teacher or any role=ADMIN, for any class
    //   id or none at all.
    // library: staff holding library.edit (the same permission that saves a
    //   library entry, so nobody can upload what they could never publish).
    // posts: any approved user (student voices, homework photos).
    if (purpose === "material") {
        if (!classId) {
            return NextResponse.json({ message: "classId is required" }, { status: 400 });
        }
        const klass = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
        if (!klass) {
            return NextResponse.json({ message: "Class not found" }, { status: 404 });
        }
        if (klass.teacherId !== user.id) {
            const access = user.role === "ADMIN" ? await getAccessControl() : null;
            if (!can(access, "classes.edit")) {
                return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
            }
        }
    } else if (purpose === "library") {
        const access = user.role === "ADMIN" ? await getAccessControl() : null;
        if (!can(access, "library.edit")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }
    } else if (purpose === "posts") {
        if (!user.approved) {
            return NextResponse.json({ message: "Account pending approval" }, { status: 403 });
        }
    }

    if (!isR2Configured()) {
        return NextResponse.json(
            {
                code: "not_configured",
                message: "File uploads not configured. Contact administrator to set up R2.",
            },
            { status: 503 },
        );
    }

    // Build a unique key: purpose/classId|userId/timestamp-filename
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    let prefix: string;
    if (purpose === "material") prefix = `materials/${classId}`;
    else if (purpose === "posts") prefix = `posts/${user.id}`;
    else prefix = "library";
    const key = `${prefix}/${timestamp}-${sanitized}`;

    try {
        const result = await createPresignedUploadUrl(key, contentType, fileSize);
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
