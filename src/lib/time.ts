// ============================================================
// Time formatting — all storage is 24-hour "HH:MM" (matches the
// HTML <input type="time"> contract), but the ENTIRE customer-
// and tenant-facing UI displays 12-hour AM/PM per product spec.
// ============================================================

/**
 * "09:00" → "9:00 AM"
 * "21:30" → "9:30 PM"
 * "00:15" → "12:15 AM"
 * "12:00" → "12:00 PM"
 *
 * Locale-aware AM/PM label: Arabic uses "ص" / "م" (صباحاً / مساءً).
 * The default is "en"; pass "ar" from a server component via getLocale()
 * or a client component via useLocale().
 */
export function formatTime12(hhmm: string, locale: string = "en"): string {
  if (!hhmm) return ""
  const [hStr, mStr] = hhmm.split(":")
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm

  const isPm = h >= 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(m).padStart(2, "0")
  const suffix =
    locale === "ar"
      ? isPm
        ? "م" // مساءً
        : "ص" // صباحاً
      : isPm
        ? "PM"
        : "AM"
  return `${h12}:${mm} ${suffix}`
}

/**
 * "09:00"–"10:30" → "9:00 AM – 10:30 AM"
 * Uses an en-dash for visual rhythm.
 */
export function formatTimeRange12(
  startHHMM: string,
  endHHMM: string,
  locale: string = "en",
): string {
  return `${formatTime12(startHHMM, locale)} – ${formatTime12(endHHMM, locale)}`
}

/**
 * Group a list of 24-hour HH:MM strings by AM/PM half-day. Useful for
 * the public booking page where we render slots in two blocks.
 */
export function groupByMeridiem<T extends { startTime: string }>(
  items: T[],
): { am: T[]; pm: T[] } {
  const am: T[] = []
  const pm: T[] = []
  for (const i of items) {
    const h = Number(i.startTime.split(":")[0] ?? "0")
    if (h < 12) am.push(i)
    else pm.push(i)
  }
  return { am, pm }
}
