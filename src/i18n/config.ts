// ============================================================
// i18n config — English primary, Arabic secondary.
// Locale is context-driven (not URL-driven): resolved from a
// cookie, falling back to the default. See CLAUDE.md §2.
// ============================================================

export const locales = ["en", "ar"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

// Cookie that stores the visitor's chosen locale.
export const LOCALE_COOKIE = "NEXT_LOCALE"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}

// Layout direction per locale. Arabic is RTL, everything else LTR.
export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}
