// ============================================================
// Locale-aware notification message bodies. Customer-facing, so
// they render in the tenant's defaultLocale (Arabic or English).
// Kept separate from i18n UI strings since these are server-built
// message bodies, not React-rendered translations.
// ============================================================

import type { Locale } from "@/i18n/config"

interface MsgCtx {
  customerName: string
  businessName: string
  serviceName: string
  date: string
  time: string
}

export function bookingConfirmationBody(locale: Locale, c: MsgCtx): string {
  if (locale === "ar") {
    return `مرحباً ${c.customerName} 👋\nتم تأكيد حجزك في ${c.businessName}\n📋 الخدمة: ${c.serviceName}\n📅 التاريخ: ${c.date}\n🕐 الوقت: ${c.time}\nنتطلع لرؤيتك! 🌟`
  }
  return `Hi ${c.customerName} 👋\nYour booking at ${c.businessName} is confirmed.\n📋 Service: ${c.serviceName}\n📅 Date: ${c.date}\n🕐 Time: ${c.time}\nSee you soon! 🌟`
}

export function bookingReminderBody(
  locale: Locale,
  c: MsgCtx,
  hoursUntil: number,
): string {
  if (locale === "ar") {
    return `تذكير 🔔\nموعدك في ${c.businessName} بعد ${hoursUntil} ساعة\n📋 ${c.serviceName}\n📅 ${c.date} الساعة ${c.time}`
  }
  return `Reminder 🔔\nYour appointment at ${c.businessName} is in ${hoursUntil}h\n📋 ${c.serviceName}\n📅 ${c.date} at ${c.time}`
}

export function waitlistOfferBody(
  locale: Locale,
  c: MsgCtx,
  expiryMinutes: number,
  confirmUrl: string,
): string {
  if (locale === "ar") {
    return `خبر جيد ${c.customerName}! 🎉\nأصبح موعد متاح\n📋 ${c.serviceName}\n📅 ${c.date} الساعة ${c.time}\n⏰ لديك ${expiryMinutes} دقيقة للتأكيد\n✅ للتأكيد: ${confirmUrl}`
  }
  return `Good news ${c.customerName}! 🎉\nA slot just opened up\n📋 ${c.serviceName}\n📅 ${c.date} at ${c.time}\n⏰ You have ${expiryMinutes} min to confirm\n✅ Confirm: ${confirmUrl}`
}
