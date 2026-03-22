import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function LocaleNotFound() {
  let t: (key: string) => string;
  try {
    t = await getTranslations("notFound");
  } catch {
    t = (key: string) => {
      const fallback: Record<string, string> = {
        title: "Page not found",
        body: "The page you are looking for does not exist.",
        goHome: "Go home",
      };
      return fallback[key] ?? key;
    };
  }

  return (
    <section className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="panel panel-strong mx-auto max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-black text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("body")}</p>
        <Link className="btn-primary" href="/">
          {t("goHome")}
        </Link>
      </div>
    </section>
  );
}
