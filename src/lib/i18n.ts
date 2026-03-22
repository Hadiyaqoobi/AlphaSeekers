import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES = new Set<Locale>(["fa"]);

export const isRtlLocale = (locale: Locale): boolean => RTL_LOCALES.has(locale);
