/**
 * Cloudflare R2 integration via S3-compatible API.
 *
 * BRD §3.1: "Cloudflare R2: 10GB free" for materials + library.
 * FRD §8: "Client-side direct upload to R2 via presigned URL."
 *
 * Requires env vars:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL (optional — defaults to the bucket endpoint)
 */

import { createHmac } from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getConfig() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
        return null;
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const publicUrl = process.env.R2_PUBLIC_URL ?? `${endpoint}/${bucket}`;

    return { endpoint, accessKeyId, secretAccessKey, bucket, publicUrl };
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
    return getConfig() !== null;
}

/**
 * Create a presigned PUT URL for direct client-side upload.
 * Uses AWS Signature V4 (R2 is S3-compatible).
 */
export function createPresignedUploadUrl(
    key: string,
    contentType: string,
    fileSizeBytes: number,
): { uploadUrl: string; publicUrl: string; maxSize: number } | null {
    const config = getConfig();
    if (!config) return null;

    if (fileSizeBytes > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
    }

    // Generate a presigned URL using AWS SigV4 (simplified for R2)
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = dateStamp + "T" + now.toISOString().slice(11, 19).replace(/:/g, "") + "Z";
    const expires = 3600; // 1 hour

    const region = "auto";
    const service = "s3";
    const credential = `${config.accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

    const canonicalQueryString = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${amzDate}`,
        `X-Amz-Expires=${expires}`,
        `X-Amz-SignedHeaders=content-type%3Bhost`,
    ]
        .sort()
        .join("&");

    const host = `${config.bucket}.${config.endpoint.replace("https://", "")}`;
    const canonicalRequest = [
        "PUT",
        `/${key}`,
        canonicalQueryString,
        `content-type:${contentType}`,
        `host:${host}`,
        "",
        "content-type;host",
        "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        `${dateStamp}/${region}/${service}/aws4_request`,
        createHmac("sha256", "").update(canonicalRequest).digest("hex"),
    ].join("\n");

    // Signing key derivation
    const kDate = createHmac("sha256", `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update(service).digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();

    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const uploadUrl = `${config.endpoint}/${config.bucket}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const publicUrl = `${config.publicUrl}/${key}`;

    return { uploadUrl, publicUrl, maxSize: MAX_FILE_SIZE };
}
