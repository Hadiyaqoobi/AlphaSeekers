"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { SiteSettings } from "@/lib/platform/site-settings";

type FormStatus = "idle" | "saving" | "saved" | "error";

const FIELDS: Array<{
  key: keyof SiteSettings;
  labelKey: string;
  placeholder: string;
  type: "url" | "email";
}> = [
  { key: "instagramUrl", labelKey: "instagram",   placeholder: "https://www.instagram.com/your-handle",   type: "url" },
  { key: "facebookUrl",  labelKey: "facebook",    placeholder: "https://www.facebook.com/your-page",      type: "url" },
  { key: "twitterUrl",   labelKey: "twitter",     placeholder: "https://x.com/your-handle",               type: "url" },
  { key: "linkedinUrl",  labelKey: "linkedin",    placeholder: "https://www.linkedin.com/company/...",    type: "url" },
  { key: "youtubeUrl",   labelKey: "youtube",     placeholder: "https://www.youtube.com/@your-channel",   type: "url" },
  { key: "telegramUrl",  labelKey: "telegram",    placeholder: "https://t.me/your-channel",               type: "url" },
  { key: "whatsappUrl",  labelKey: "whatsapp",    placeholder: "https://whatsapp.com/channel/...",        type: "url" },
  { key: "contactEmail", labelKey: "contactEmail", placeholder: "team@alphaseekers.org",                  type: "email" },
];

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const t = useTranslations("siteSettings");
  const [form, setForm] = useState<SiteSettings>(initial);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    // Server expects strings (empty string => clear the field). Convert nulls.
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v ?? ""]),
    );

    const res = await fetch("/api/admin/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setStatus("error");
      setError(body.message ?? t("failed"));
      return;
    }

    const updated = (await res.json()) as SiteSettings;
    setForm(updated);
    setStatus("saved");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl p-6 space-y-6"
      style={{ background: "#0D1419", border: "1px solid #1A2D3D" }}
    >
      <p className="text-sm" style={{ color: "#8AA4B8" }}>
        {t("helpUrl")}
      </p>

      <div className="space-y-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "#E8EEF2" }}
            >
              {t(field.labelKey)}
            </label>
            <input
              type={field.type}
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              style={{
                background: "#0A1118",
                border: "1px solid #1A2D3D",
                color: "#E8EEF2",
              }}
              placeholder={field.placeholder}
              value={form[field.key] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  [field.key]: e.target.value || null,
                }))
              }
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00E676";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#1A2D3D";
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60"
          style={{
            background: "#00E676",
            color: "#0A1118",
            boxShadow: "0 0 12px rgba(0,230,118,0.25)",
          }}
        >
          {status === "saving" ? t("saving") : t("save")}
        </button>

        {status === "saved" && (
          <span className="text-sm font-medium" style={{ color: "#00E676" }}>
            {t("saved")}
          </span>
        )}
        {status === "error" && (
          <span className="text-sm font-medium" style={{ color: "#EF4444" }}>
            {error ?? t("failed")}
          </span>
        )}
      </div>
    </form>
  );
}
