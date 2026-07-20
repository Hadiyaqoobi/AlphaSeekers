"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type PostType = "article" | "creative_writing" | "poetry" | "art" | "spotlight";

type SavedPost = {
  id: string;
  slug: string;
  status: string;
  reviewNotes?: string | null;
};

interface PostEditorProps {
  locale: string;
  initialPost?: {
    id: string;
    type: string;
    title: string;
    titleDari: string | null;
    content: string | null;
    contentDari: string | null;
    excerpt: string | null;
    coverImageUrl: string | null;
    galleryUrls: string | null;
    language: string;
    category: string | null;
    tags: string | null;
    anonymous: boolean;
    status: string;
    reviewNotes: string | null;
  } | null;
}

const TYPE_OPTIONS: { value: PostType; label: string; icon: string }[] = [
  { value: "article", label: "Article", icon: "📝" },
  { value: "creative_writing", label: "Story", icon: "📖" },
  { value: "poetry", label: "Poetry", icon: "✦" },
  { value: "art", label: "Art", icon: "🎨" },
  { value: "spotlight", label: "Spotlight", icon: "✨" },
];

export function PostEditor({ locale, initialPost }: PostEditorProps) {
  const router = useRouter();
  const isDari = locale === "fa";

  const [postId, setPostId] = useState<string | null>(initialPost?.id ?? null);
  const [type, setType] = useState<PostType>((initialPost?.type as PostType) || "article");
  const [title, setTitle] = useState(initialPost?.title || "");
  const [titleDari, setTitleDari] = useState(initialPost?.titleDari || "");
  const [content, setContent] = useState(initialPost?.content || "");
  const [contentDari, setContentDari] = useState(initialPost?.contentDari || "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialPost?.coverImageUrl || "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(() => {
    if (!initialPost?.galleryUrls) return [];
    try {
      const parsed = JSON.parse(initialPost.galleryUrls);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [language] = useState<"en" | "da" | "both">(
    (initialPost?.language as "en" | "da" | "both") || "en",
  );
  const [category, setCategory] = useState(initialPost?.category || "");
  const [tags, setTags] = useState(initialPost?.tags || "");
  const [anonymous, setAnonymous] = useState(initialPost?.anonymous || false);
  const [alsoDari, setAlsoDari] = useState(Boolean(initialPost?.contentDari));

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [aiLoading, setAiLoading] = useState<"grammar" | "improve" | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const isEditable = !initialPost || ["draft", "rejected"].includes(initialPost.status);

  // Auto-save (debounced, every 30s after a change)
  useEffect(() => {
    if (!isEditable) return;

    const snapshot = JSON.stringify({
      type,
      title,
      titleDari,
      content,
      contentDari,
      coverImageUrl,
      galleryUrls,
      language,
      category,
      tags,
      anonymous,
    });

    if (snapshot === lastSaved.current) return;
    if (!title.trim() || title.length < 3) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft(false);
    }, 3000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, title, titleDari, content, contentDari, coverImageUrl, galleryUrls, language, category, tags, anonymous]);

  const saveDraft = useCallback(
    async (manual: boolean) => {
      if (saving || !title.trim() || title.length < 3) {
        if (manual) setError("Title must be at least 3 characters");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const body = {
          type,
          title: title.trim(),
          titleDari: titleDari.trim() || null,
          content: content || null,
          contentDari: alsoDari ? contentDari || null : null,
          coverImageUrl: coverImageUrl || null,
          galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
          language: alsoDari ? "both" : language,
          category: category || null,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          anonymous,
        };

        const url = postId ? `/api/me/posts/${postId}` : "/api/me/posts";
        const method = postId ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || `Save failed (${res.status})`);
        }

        const saved: SavedPost = await res.json();
        setPostId(saved.id);
        lastSaved.current = JSON.stringify({
          type, title, titleDari, content, contentDari, coverImageUrl, galleryUrls, language, category, tags, anonymous,
        });

        const now = new Date().toLocaleTimeString();
        setSaveMessage(`${isDari ? "ذخیره شد" : "Saved"} · ${now}`);
        setTimeout(() => setSaveMessage(""), 3000);

        return saved;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [saving, title, type, titleDari, content, contentDari, coverImageUrl, galleryUrls, language, category, tags, anonymous, postId, alsoDari, isDari],
  );

  const handleSubmitForReview = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    const saved = await saveDraft(true);
    if (!saved) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/me/posts/${saved.id}/submit`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Submission failed");
      }

      router.push(`/${locale}/stories`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }, [saveDraft, router, locale]);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
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

        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => null);
          throw new Error(data?.message || "Upload unavailable");
        }

        const { uploadUrl, publicUrl } = await presignRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Upload to storage failed");

        return publicUrl as string;
      } catch (err) {
        setError((err as Error).message);
        return null;
      }
    },
    [],
  );

  const handleCoverUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB");
        return;
      }

      setUploadingCover(true);
      const url = await uploadImage(file);
      if (url) setCoverImageUrl(url);
      setUploadingCover(false);
    },
    [uploadImage],
  );

  const handleGalleryUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setUploadingCover(true);
      const urls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) continue;
        const url = await uploadImage(file);
        if (url) urls.push(url);
      }
      setGalleryUrls((prev) => [...prev, ...urls].slice(0, 10));
      setUploadingCover(false);
    },
    [uploadImage],
  );

  const askAiForHelp = useCallback(
    async (mode: "grammar" | "improve") => {
      if (!content.trim()) {
        setError("Write something first, then ask the AI for help");
        return;
      }

      setAiLoading(mode);
      setAiResult(null);
      setError(null);

      const instruction =
        mode === "grammar"
          ? `Check the following text for grammar and spelling mistakes. List each issue briefly, then suggest the correction. Keep the student's voice.\n\n${content}`
          : `Read this student's writing. Suggest 3 concrete ways to make it clearer and more engaging while keeping their voice. Be specific and kind.\n\n${content}`;

      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: instruction, locale, stream: false }),
        });

        if (!res.ok) throw new Error("AI request failed");
        const data = await res.json();
        setAiResult(data.answer || "No suggestions returned.");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setAiLoading(null);
      }
    },
    [content, locale],
  );

  if (!isEditable) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
        <h2 className="text-lg font-bold text-amber-900 mb-2">
          {initialPost?.status === "pending_review"
            ? isDari ? "در حال بررسی" : "Pending review"
            : isDari ? "منتشر شده" : "Already published"}
        </h2>
        <p className="text-amber-800 text-sm">
          {initialPost?.status === "pending_review"
            ? isDari
              ? "این پست در حال بررسی توسط تیم است. در حال حاضر قابل ویرایش نیست."
              : "This post is being reviewed by our team. You can't edit it right now."
            : isDari
              ? "این پست منتشر شده و قابل ویرایش نیست."
              : "Published posts can't be edited."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Rejection note */}
      {initialPost?.status === "rejected" && initialPost.reviewNotes && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
          <p className="text-sm font-semibold text-red-800 mb-1">
            {isDari ? "بازخورد از تیم" : "Feedback from our team"}
          </p>
          <p className="text-sm text-red-700">{initialPost.reviewNotes}</p>
          <p className="text-xs text-red-600 mt-2">
            {isDari ? "پس از ویرایش، دوباره ارسال کنید." : "Edit and resubmit when you're ready."}
          </p>
        </div>
      )}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">
          {isDari ? "نوع پست" : "What type of post?"}
        </label>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                type === opt.value
                  ? "bg-neon-600 text-white border-neon-600"
                  : "bg-dark-100 text-ink-main border-line hover:border-neon-300"
              }`}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-ink-main mb-2">
          {isDari ? "عنوان" : "Title"}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isDari ? "عنوان داستان خود را بنویسید..." : "Give your story a title..."}
          className="w-full text-2xl font-bold border-0 border-b border-line bg-transparent py-2 focus:outline-none focus:border-neon-500 placeholder:text-ink-faint"
        />
      </div>

      {/* Cover image */}
      {type !== "poetry" && type !== "art" && (
        <div>
          <label className="block text-sm font-semibold text-ink-main mb-2">
            {isDari ? "تصویر جلد (اختیاری)" : "Cover image (optional)"}
          </label>
          {coverImageUrl ? (
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-dark-100 border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-dark-100/90 flex items-center justify-center hover:bg-dark-100"
              >
                <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="w-full aspect-[16/9] border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center hover:border-neon-400 hover:bg-neon-50/30 transition-colors"
            >
              <svg className="w-10 h-10 text-ink-faint mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              </svg>
              <p className="text-sm font-medium text-ink-soft">
                {uploadingCover ? (isDari ? "در حال آپلود..." : "Uploading...") : isDari ? "برای آپلود تصویر کلیک کنید" : "Click to upload a cover image"}
              </p>
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
        </div>
      )}

      {/* Art gallery (art posts) */}
      {type === "art" && (
        <div>
          <label className="block text-sm font-semibold text-ink-main mb-2">
            {isDari ? "آثار هنری" : "Your artwork"}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {galleryUrls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-dark-100">
                <Image src={url} alt={`Art ${i + 1}`} fill className="object-cover" sizes="33vw" />
                <button
                  type="button"
                  onClick={() => setGalleryUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-dark-100/90 flex items-center justify-center hover:bg-dark-100"
                >
                  <svg className="w-3.5 h-3.5 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {galleryUrls.length < 10 && (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingCover}
                className="aspect-square border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center hover:border-neon-400 hover:bg-neon-50/30 transition-colors"
              >
                <svg className="w-8 h-8 text-ink-faint mb-1" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-xs text-ink-soft">{isDari ? "افزودن" : "Add image"}</span>
              </button>
            )}
          </div>
          <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
          <p className="text-xs text-ink-faint">{galleryUrls.length}/10 images</p>
        </div>
      )}

      {/* Content editor */}
      <div>
        <label className="block text-sm font-semibold text-ink-main mb-2">
          {type === "poetry" ? (isDari ? "شعر خود را اینجا بنویسید" : "Write your poem") : type === "spotlight" ? (isDari ? "معرفی خود" : "About you and your dream") : isDari ? "داستان خود" : "Your story"}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === "poetry"
              ? (isDari ? "شعر خود را بنویسید..." : "Write your poem...")
              : type === "spotlight"
                ? (isDari ? 'یک نقل قول: "آلفاسیکرز به من..."' : 'A quote about AlphaSeekers, what you\'re studying, your dream...')
                : (isDari ? "داستان خود را اینجا بنویسید... (پشتیبانی از markdown: **پررنگ**, *کج*, ## عنوان)" : "Start writing here... Supports markdown: **bold**, *italic*, ## heading, - bullet list")
          }
          rows={18}
          className={`w-full rounded-xl border border-line bg-dark-100 px-4 py-3 text-[15px] leading-relaxed font-sans placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-neon-500/30 focus:border-neon-400 ${
            type === "poetry" ? "text-center italic" : ""
          }`}
        />
        <p className="text-xs text-ink-faint mt-2">
          {isDari ? "**پررنگ** · *کج* · ## عنوان · - لیست" : "**bold** · *italic* · ## heading · - bullet list · [link](url)"}
        </p>
      </div>

      {/* Dari toggle */}
      <div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoDari}
            onChange={(e) => setAlsoDari(e.target.checked)}
            className="w-4 h-4 rounded border-line text-neon-600 focus:ring-neon-500"
          />
          <span className="text-sm text-ink-main">
            {isDari ? "همچنین به دری بنویسم" : "Also write in Dari"}
          </span>
        </label>
      </div>

      {alsoDari && (
        <div>
          <label className="block text-sm font-semibold text-ink-main mb-2">عنوان دری</label>
          <input
            type="text"
            value={titleDari}
            onChange={(e) => setTitleDari(e.target.value)}
            placeholder="عنوان شما به دری..."
            dir="rtl"
            className="w-full text-xl font-bold border-0 border-b border-line bg-transparent py-2 focus:outline-none focus:border-neon-500 placeholder:text-ink-faint mb-4"
            style={{ fontFamily: "var(--font-dari, Vazirmatn, serif)" }}
          />
          <label className="block text-sm font-semibold text-ink-main mb-2">داستان به دری</label>
          <textarea
            value={contentDari}
            onChange={(e) => setContentDari(e.target.value)}
            placeholder="داستان خود را به دری بنویسید..."
            dir="rtl"
            rows={14}
            className="w-full rounded-xl border border-line bg-dark-100 px-4 py-3 text-[15px] leading-relaxed placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-neon-500/30 focus:border-neon-400"
            style={{ fontFamily: "var(--font-dari, Vazirmatn, serif)" }}
          />
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
            {isDari ? "دسته‌بندی" : "Category"}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm"
          >
            <option value="">{isDari ? "انتخاب..." : "Select..."}</option>
            <option value="education">{isDari ? "آموزش" : "Education"}</option>
            <option value="personal">{isDari ? "شخصی" : "Personal"}</option>
            <option value="technology">{isDari ? "تکنالوژی" : "Technology"}</option>
            <option value="culture">{isDari ? "فرهنگ" : "Culture"}</option>
            <option value="art">{isDari ? "هنر" : "Art"}</option>
            <option value="poetry">{isDari ? "شعر" : "Poetry"}</option>
            <option value="spotlight">{isDari ? "معرفی" : "Spotlight"}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
            {isDari ? "برچسب‌ها" : "Tags"}
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={isDari ? "آموزش، انگلیسی (با کاما)" : "education, english (comma-separated)"}
            className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="w-4 h-4 rounded border-line text-neon-600 focus:ring-neon-500"
          />
          <span className="text-sm text-ink-main">
            {isDari ? "به صورت ناشناس منتشر کنید" : "Post anonymously"}
          </span>
        </label>
      </div>

      {/* AI writing help */}
      <div className="rounded-2xl bg-gradient-to-br from-neon-50 via-white to-sky-50 border border-neon-100 p-5">
        <p className="text-sm font-semibold text-ink-main mb-3">
          ✨ {isDari ? "نیاز به کمک با نوشتن دارید؟" : "Need help with your writing?"}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => askAiForHelp("grammar")}
            disabled={aiLoading !== null || !content.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-100 border border-line text-sm text-ink-main font-medium hover:bg-neon-50 hover:border-neon-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiLoading === "grammar" ? "…" : "📝"} {isDari ? "بررسی گرامر" : "Check grammar"}
          </button>
          <button
            type="button"
            onClick={() => askAiForHelp("improve")}
            disabled={aiLoading !== null || !content.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-100 border border-line text-sm text-ink-main font-medium hover:bg-neon-50 hover:border-neon-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiLoading === "improve" ? "…" : "✨"} {isDari ? "بهبود نوشته" : "Improve my writing"}
          </button>
        </div>
        {aiResult && (
          <div className="rounded-lg bg-dark-100 border border-line p-4 text-sm text-ink-main whitespace-pre-wrap">
            {aiResult}
          </div>
        )}
      </div>

      {/* Error / Save message */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saveMessage && <p className="text-xs text-ink-faint">{saveMessage}</p>}

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-line pt-6">
        <button
          type="button"
          onClick={() => saveDraft(true)}
          disabled={saving || submitting}
          className="inline-flex items-center px-5 py-2.5 rounded-xl border border-line text-ink-main font-semibold hover:bg-dark-50 disabled:opacity-50 transition-colors"
        >
          {saving ? (isDari ? "در حال ذخیره..." : "Saving...") : isDari ? "ذخیره پیش‌نویس" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={handleSubmitForReview}
          disabled={saving || submitting || !title.trim()}
          className="inline-flex items-center px-6 py-2.5 rounded-xl bg-neon-600 text-white font-bold hover:bg-neon-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "..." : isDari ? "ارسال برای بررسی" : "Submit for review"} →
        </button>
      </div>
    </div>
  );
}
