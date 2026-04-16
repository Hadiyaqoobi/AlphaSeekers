import { getTranslations } from "next-intl/server";

export default async function OfflinePage({ params }: { params: { locale: string } }) {
  let t: (key: string) => string;
  try {
    t = await getTranslations({ locale: params.locale, namespace: "offline" });
  } catch {
    t = (key: string) => {
      const fallback: Record<string, string> = {
        title: "You are offline",
        body: "Your schedule is cached and available. Connect to the internet to access all features.",
        cachedSchedule: "View cached schedule",
      };
      return fallback[key] ?? key;
    };
  }

  return (
    <section className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="panel panel-strong mx-auto max-w-sm space-y-4 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <span className="text-2xl">&#x1F4F6;</span>
        </div>
        <h1 className="text-2xl font-black text-ink-main">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{t("body")}</p>
        <a className="btn-primary" href={`/${params.locale}/dashboard`}>
          {t("cachedSchedule")}
        </a>
      </div>
    </section>
  );
}
