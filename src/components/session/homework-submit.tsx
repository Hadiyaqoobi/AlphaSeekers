"use client";

import { useCallback, useRef, useState } from "react";

type Submission = {
  id: string;
  content: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
  aiReview: string | null;
  teacherGrade: string | null;
  teacherNotes: string | null;
  submittedAt: string;
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  submissions: Submission[];
};

interface HomeworkSubmitProps {
  classId: string;
  sessionId: string;
  assignment: Assignment;
  onSubmitted?: () => void;
}

export function HomeworkSubmit({ classId, sessionId, assignment, onSubmitted }: HomeworkSubmitProps) {
  const existing = assignment.submissions[0] || null;
  const [content, setContent] = useState(existing?.content || "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
          purpose: "posts",
        }),
      });
      if (!presignRes.ok) throw new Error("Upload unavailable");
      const { uploadUrl, publicUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      setImageUrl(publicUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!content.trim() && !imageUrl) {
      setError("Add some text or upload a photo");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/sessions/${sessionId}/homework/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          content: content || undefined,
          imageUrl: imageUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Submission failed (${res.status})`);
      }

      onSubmitted?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, content, imageUrl, classId, sessionId, assignment.id, onSubmitted]);

  // Already submitted view
  if (existing && existing.aiReview) {
    return (
      <div className="rounded-2xl bg-dark-100 border border-line p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink-main">{assignment.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neon-100 text-neon-700 font-semibold">
            ✓ Submitted
          </span>
        </div>
        <p className="text-xs text-ink-soft mb-4">
          Submitted {new Date(existing.submittedAt).toLocaleString()}
        </p>

        {existing.aiReview && (
          <details open className="rounded-lg bg-dark-50 border border-line-soft p-3 mb-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-main">
              ✨ AI Review
            </summary>
            <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{existing.aiReview}</p>
          </details>
        )}

        {existing.teacherNotes ? (
          <div className="rounded-lg bg-neon-50 border border-neon-100 p-3">
            <p className="text-xs font-semibold text-neon-700 mb-1">
              Teacher feedback {existing.teacherGrade && `(${existing.teacherGrade})`}
            </p>
            <p className="text-sm text-neon-800 whitespace-pre-wrap">{existing.teacherNotes}</p>
          </div>
        ) : (
          <p className="text-xs text-ink-faint italic">Teacher review pending</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-dark-100 border border-line p-5">
      <h3 className="font-semibold text-ink-main mb-1">{assignment.title}</h3>
      <p className="text-sm text-ink-soft mb-4 whitespace-pre-wrap">{assignment.description}</p>
      {assignment.dueDate && (
        <p className="text-xs text-amber-700 mb-4">
          Due: {new Date(assignment.dueDate).toLocaleDateString()}
        </p>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your answers here..."
        rows={5}
        className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-neon-500/30 focus:border-neon-400 mb-3"
      />

      {imageUrl ? (
        <div className="relative mb-3 rounded-lg overflow-hidden border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Homework" className="w-full max-h-48 object-contain bg-dark-50" />
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-dark-100/90 flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full mb-3 px-4 py-3 rounded-lg border-2 border-dashed border-line text-sm text-ink-soft hover:border-neon-300 hover:text-neon-700 hover:bg-neon-50/30 transition-colors"
        >
          {uploading ? "Uploading..." : "📷 Upload photo of your work"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || (!content.trim() && !imageUrl)}
        className="w-full px-4 py-2.5 rounded-lg bg-neon-600 text-white font-semibold hover:bg-neon-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting..." : "Submit homework →"}
      </button>
    </div>
  );
}
