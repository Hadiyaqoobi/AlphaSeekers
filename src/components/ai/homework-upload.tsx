"use client";

import { useCallback, useRef, useState } from "react";

interface HomeworkUploadProps {
  enrolledClasses: { id: string; name: string }[];
  onReviewReceived: (review: string, className: string) => void;
  disabled?: boolean;
}

export function HomeworkUpload({ enrolledClasses, onReviewReceived, disabled }: HomeworkUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [classId, setClassId] = useState<string>(enrolledClasses[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setError(null);
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (evt) => setPreview(evt.target?.result as string);
    reader.readAsDataURL(selected);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || uploading) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      if (classId) formData.append("classId", classId);
      if (instructions) formData.append("instructions", instructions);

      const response = await fetch("/api/ai/review-homework", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Request failed (${response.status})`);
      }

      const data = await response.json();
      onReviewReceived(data.review, data.className);

      // Reset + close
      setFile(null);
      setPreview(null);
      setInstructions("");
      setIsOpen(false);
    } catch (err) {
      setError((err as Error).message || "Failed to review homework");
    } finally {
      setUploading(false);
    }
  }, [file, classId, instructions, uploading, onReviewReceived]);

  return (
    <>
      {/* Trigger button (sits in input bar) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`w-11 h-11 rounded-xl flex items-center justify-center bg-dark-100 text-ink-soft hover:bg-dark-200 transition-all ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        }`}
        aria-label="Upload homework photo"
        title="Upload homework for AI review"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !uploading && setIsOpen(false)}>
          <div className="bg-dark-100 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink-main">Review my homework</h3>
              <button
                type="button"
                onClick={() => !uploading && setIsOpen(false)}
                className="text-ink-faint hover:text-ink-soft"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image preview or uploader */}
            {preview ? (
              <div className="relative mb-4 rounded-xl overflow-hidden border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Homework preview" className="w-full max-h-64 object-contain bg-dark-50" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-dark-100/90 flex items-center justify-center hover:bg-dark-100"
                  aria-label="Remove photo"
                >
                  <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-4 border-2 border-dashed border-line rounded-xl p-8 text-center hover:border-neon-400 hover:bg-neon-50/30 transition-colors"
              >
                <svg className="w-10 h-10 mx-auto text-ink-faint mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <p className="text-sm font-medium text-ink-main">Tap to take a photo</p>
                <p className="text-xs text-ink-faint mt-1">or choose from your gallery</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Class selector */}
            {enrolledClasses.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-ink-soft mb-1">Which class is this for?</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm"
                >
                  {enrolledClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Instructions */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                What should I check? (optional)
              </label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Check my grammar, or Is my calculation correct?"
                className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm placeholder:text-ink-faint"
              />
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="w-full bg-neon-600 text-white font-semibold rounded-xl py-3 hover:bg-neon-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Reviewing..." : "Review my homework"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
