/**
 * Cloudflare R2 integration via the S3-compatible API.
 *
 * BRD §3.1: "Cloudflare R2: 10GB free" for materials + library.
 * FRD §8: "Client-side direct upload to R2 via presigned URL."
 *
 * Requires env vars (standardized across code / .env.example / render.yaml):
 *   R2_ACCOUNT_ID          — Cloudflare account id (used to build the endpoint)
 *   R2_ACCESS_KEY_ID       — R2 access key id
 *   R2_SECRET_ACCESS_KEY   — R2 secret access key
 *   R2_BUCKET              — bucket name
 *   R2_PUBLIC_BASE_URL     — (optional) public base URL for reads; defaults to the bucket endpoint
 *
 * Presigning is delegated to the AWS SDK (@aws-sdk/s3-request-presigner) which
 * produces a valid SigV4 signature. Hand-rolling SigV4 (the previous approach)
 * produced cryptographically invalid URLs that R2 rejected on every upload.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const PRESIGN_EXPIRES_SECONDS = 3600; // 1 hour

type R2Config = {
    endpoint: string;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
};

function getConfig(): R2Config | null {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
        return null;
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    // Public base URL is where objects are served from (e.g. a custom domain or the
    // r2.dev subdomain). Falls back to the S3 endpoint path for the bucket.
    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? `${endpoint}/${bucket}`).replace(/\/+$/, "");

    return { endpoint, accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
    return getConfig() !== null;
}

// Cache the S3 client at module scope — creating it per request is wasteful and
// the credentials/endpoint never change at runtime.
let cachedClient: S3Client | null = null;
let cachedClientKey = "";

function getClient(config: R2Config): S3Client {
    const key = `${config.endpoint}|${config.accessKeyId}`;
    if (cachedClient && cachedClientKey === key) {
        return cachedClient;
    }

    cachedClient = new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
    cachedClientKey = key;
    return cachedClient;
}

/**
 * Create a presigned PUT URL for direct client-side upload.
 *
 * Returns null when R2 is not configured (callers surface a "not configured"
 * message). Throws for invalid requests (e.g. oversized file).
 *
 * NOTE: this is async — SigV4 presigning via the AWS SDK resolves credentials
 * asynchronously. Callers must `await` the result.
 */
export async function createPresignedUploadUrl(
    key: string,
    contentType: string,
    fileSizeBytes: number,
): Promise<{ uploadUrl: string; publicUrl: string; maxSize: number } | null> {
    const config = getConfig();
    if (!config) return null;

    if (fileSizeBytes > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
    }

    const client = getClient(config);

    const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    const publicUrl = `${config.publicBaseUrl}/${key}`;

    return { uploadUrl, publicUrl, maxSize: MAX_FILE_SIZE };
}

/**
 * Create a presigned GET URL for reading a private object (e.g. gated library
 * materials). Returns null when R2 is not configured.
 */
export async function createPresignedDownloadUrl(
    key: string,
    expiresInSeconds: number = PRESIGN_EXPIRES_SECONDS,
): Promise<string | null> {
    const config = getConfig();
    if (!config) return null;

    const client = getClient(config);

    const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
