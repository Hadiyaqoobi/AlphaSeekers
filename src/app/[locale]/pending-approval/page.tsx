import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSessionUser } from "@/lib/security/session";

type PendingApprovalPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage({ params }: PendingApprovalPageProps) {
  const user = await getSessionUser();
  const t = await getTranslations({ locale: params.locale, namespace: "pending" });

  if (user?.approved) {
    redirect(`/${params.locale}/dashboard`);
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-6 py-16 lg:px-8">
      <div className="w-full text-center">
        {/* Animated Checkmark Circle */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neon-500/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neon-500/20">
            <svg
              className="h-8 w-8 text-neon-400 animate-[pulse_3s_ease-in-out_infinite]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Kicker */}
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-neon-400">
          {t("eyebrow")}
        </p>

        {/* Title */}
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink-main">
          {t("title")}
        </h1>

        {/* Body */}
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-ink-soft">
          {t("body")}
        </p>

        {/* Note Card */}
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/5 bg-dark-100 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-neon-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-left text-sm leading-relaxed text-ink-soft">
              {t("note")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-xl bg-neon-600 px-6 text-sm font-semibold text-black transition hover:bg-neon-500 focus:outline-none focus:ring-2 focus:ring-neon-500/20"
            href={`/${params.locale}/login`}
          >
            {t("goToLogin")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-xl border border-white/10 bg-dark-100 px-6 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}`}
          >
            {t("home")}
          </Link>
        </div>
      </div>
    </section>
  );
}
