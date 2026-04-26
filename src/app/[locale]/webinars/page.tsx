import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { WebinarsComingSoon } from "@/components/coming-soon/webinars-coming-soon";
import { formatDateTime } from "@/lib/format-date";
import { DeleteContentButton } from "@/components/admin/delete-content-button";
import { WebinarForm } from "@/components/forms/webinar-form";
import { WebinarRegisterButton } from "@/components/forms/webinar-register-button";
import { listRegisteredWebinarIds, listWebinars } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type WebinarsPageProps = {
  params: { locale: string };
};

export default async function WebinarsPage({ params }: WebinarsPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "webinars" });
  const user = await getSessionUser();

  const items = await listWebinars();

  // Show coming soon for everyone when no content exists
  if (items.length === 0 && !user?.role?.includes("ADMIN")) {
    return <WebinarsComingSoon />;
  }

  // If there IS content but user isn't logged in, send to login
  if (!user && items.length > 0) {
    redirect(`/${locale}/login`);
  }
  const registeredIds = user ? new Set(await listRegisteredWebinarIds(user.id)) : new Set<string>();

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header — sky-themed for Webinars to differentiate from Opportunities */}
      <header className="mb-10 flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 ring-1 ring-sky-200">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            {t("title")}
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-gray-900">
            {t("subtitle")}
          </h1>
        </div>
      </header>

      {/* Admin Form */}
      {user?.role === "ADMIN" ? (
        <div className="mb-8">
          <WebinarForm />
        </div>
      ) : null}

      {/* Webinar Cards Grid */}
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              className="group flex flex-col rounded-2xl border border-gray-100 bg-dark-100 shadow-sm transition-all duration-200 hover:shadow-lg"
              key={item.id}
            >
              {/* Date Badge */}
              <div className="border-b border-gray-50 px-6 pt-6 pb-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-gray-600">
                    {formatDateTime(item.startsAt, locale)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-neon-700 transition-colors">
                  {item.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500">
                  {item.description}
                </p>

                {/* Join Link */}
                {user && (user.role === "ADMIN" || (user.approved && registeredIds.has(item.id))) ? (
                  <a
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-600 transition hover:text-neon-700"
                    href={item.meetLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t("openJoinLink")}
                  </a>
                ) : (
                  <p className="mt-4 text-sm text-gray-400">{t("registerPrompt")}</p>
                )}

                {/* Registration Status */}
                {user ? (
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-50 pt-4">
                    {registeredIds.has(item.id) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-50 px-3 py-1 text-xs font-semibold text-neon-700">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            clipRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            fillRule="evenodd"
                          />
                        </svg>
                        {t("registeredBadge")}
                      </span>
                    ) : (
                      <WebinarRegisterButton webinarId={item.id} />
                    )}
                    {user.role === "ADMIN" ? (
                      <DeleteContentButton id={item.id} kind="webinar" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <WebinarsComingSoon />
      )}
    </section>
  );
}
