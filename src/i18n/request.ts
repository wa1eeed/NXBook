// ============================================================
// next-intl request config (no i18n routing).
// Reads the active locale from the NEXT_LOCALE cookie and loads
// the matching messages. Falls back to the default locale.
// ============================================================

import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
