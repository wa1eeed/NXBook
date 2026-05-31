"use server"

// ============================================================
// Server action to change the active locale. Sets the
// NEXT_LOCALE cookie; the next render picks it up via
// src/i18n/request.ts. Used by the LocaleSwitcher.
// ============================================================

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { isLocale, LOCALE_COOKIE, type Locale } from "./config"

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  })

  revalidatePath("/", "layout")
}
