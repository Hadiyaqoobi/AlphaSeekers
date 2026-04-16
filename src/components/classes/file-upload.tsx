"use client";

import { useRef, useState } from "react";

import { useTranslations } from "next-intl";

type FileUploadProps = {
  purpose: "material" | "library";
  classId?: string;
  onUploadComplete: (fileUrl: string, fileSize: number) => void;
};

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ACCEPT_STRING = ALLOWED_TYPES.join(",");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 0.01 ? "< 0.01 MB" : `${mb.toFixed(2)} MB`;
}

function estimateCost(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  const low = gb * 1;
  const high = gb * 3;
  const avg = (low + high) / 2;
  return avg < 0.001 ? "< $0.001" : `$${avg.toFixed(3)}`;
}

export function FileUpload({ purpose, classId, onUploadComplete }: FileUploadProps) {
  const t = useTranslations("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setDone(false);
    setProgress(0);

    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > MAX_SIZE) {
      setError(t("fileTooLarge"));
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError(t("invalidType"));
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(selected);
  }

  function handleRemove() {
    setFile(null);
    setError(null);
    setDone(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
          purpose,
          classId,
        }),
      });

      if (!presignResponse.ok) {
        const body = (await presignResponse.json().catch(() => ({ message: t("uploadFailed") }))) as {
          message?: string;
        };
        setError(body.message ?? t("uploadFailed"));
        setUploading(false);
        return;
      }

      const { uploadUrl, publicUrl } = (await presignResponse.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setDone(true);
          setUploading(false);
          onUploadComplete(publicUrl, file.size);
        } else {
          setError(t("uploadFailed"));
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setError(t("uploadFailed"));
        setUploading(false);
      };

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    } catch {
      setError(t("uploadFailed"));
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* File input */}
      <label className="block cursor-pointer rounded border border-dashed border-line-DEFAULT p-3 text-center text-sm text-ink-soft hover:border-line-strong">
        <span className="font-medium text-ink-main">{t("selectFile")}</span>{" "}
        <span className="text-ink-soft">{t("dragDrop")}</span>
        <br />
        <span className="text-xs text-ink-faint">{t("maxSize")}</span>
        <input
          ref={inputRef}
          accept={ACCEPT_STRING}
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
          type="file"
        />
      </label>

      {/* File info */}
      {file && !done ? (
        <div className="flex items-center justify-between rounded bg-dark-50 px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-ink-main">{file.name}</p>
            <p className="text-xs text-ink-soft">
              {formatSize(file.size)} ({t("dataCost", { cost: estimateCost(file.size) })})
            </p>
          </div>
          {!uploading ? (
            <button
              className="text-xs text-red-600 hover:text-red-800"
              onClick={handleRemove}
              type="button"
            >
              {t("remove")}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Progress bar */}
      {uploading ? (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-dark-200">
            <div
              className="h-2 rounded-full bg-neon-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink-soft">{t("uploadProgress", { percent: progress })}</p>
        </div>
      ) : null}

      {/* Upload complete */}
      {done ? (
        <div className="flex items-center gap-2 rounded bg-neon-50 px-3 py-2 text-sm text-neon-700">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t("uploadComplete")}</span>
        </div>
      ) : null}

      {/* Error */}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {/* Upload button */}
      {file && !done && !uploading ? (
        <button className="btn-primary" onClick={handleUpload} type="button">
          {t("upload")}
        </button>
      ) : null}

      {/* Uploading indicator */}
      {uploading ? (
        <p className="text-xs text-ink-soft">{t("uploading")}</p>
      ) : null}
    </div>
  );
}
