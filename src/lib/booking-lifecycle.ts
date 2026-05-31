// ============================================================
// Booking lifecycle transitions (CLAUDE.md §11):
//   PENDING → CONFIRMED → ATTENDED / NO_SHOW / CANCELLED
// On creation: schedule 24h + 1h reminders + send confirmation.
// On cancel/no-show: free the slot → offer the waitlist, and
// (no-show) bump the customer's noShowScore.
// All tenant-scoped by businessId.
// ============================================================

import { prisma } from "@/lib/prisma"
import { BookingStatus } from "@prisma/client"
import { dispatchWhatsApp } from "@/lib/notify"
import { bookingConfirmationBody } from "@/lib/messages-templates"
import { offerNextInLine } from "@/lib/waitlist"
import { recordAudit } from "@/lib/audit"
import {
  reminderQueue,
  notificationQueue,
  queuesEnabled,
} from "@/lib/queue"
import type { Locale } from "@/i18n/config"

/**
 * Post-booking side effects: send confirmation + schedule reminders.
 * Safe to call right after createBooking(). Degrades silently if the
 * queue/providers aren't configured.
 */
export async function onBookingCreated(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      service: { select: { nameEn: true, nameAr: true } },
      business: { select: { name: true, defaultLocale: true } },
    },
  })
  if (!booking) return

  const locale = booking.business.defaultLocale as Locale
  const serviceName =
    locale === "ar" && booking.service.nameAr
      ? booking.service.nameAr
      : booking.service.nameEn
  const dateStr = booking.date.toISOString().slice(0, 10)

  // Immediate confirmation.
  await dispatchWhatsApp({
    businessId: booking.businessId,
    to: booking.customer.phone,
    type: "booking_confirmation",
    body: bookingConfirmationBody(locale, {
      customerName: booking.customer.name,
      businessName: booking.business.name,
      serviceName,
      date: dateStr,
      time: booking.startTime,
    }),
  })

  if (!queuesEnabled()) return

  // Schedule 24h + 1h reminders relative to the booking start time.
  const [h, m] = booking.startTime.split(":").map(Number)
  const start = new Date(booking.date)
  start.setHours(h, m, 0, 0)
  const now = Date.now()

  for (const hoursUntil of [24, 1]) {
    const fireAt = start.getTime() - hoursUntil * 60 * 60 * 1000
    const delay = fireAt - now
    if (delay > 0) {
      await reminderQueue().add(
        `reminder_${hoursUntil}h`,
        { bookingId, hoursUntil },
        { delay },
      )
    }
  }
  // Touch the notification queue so it exists for the worker.
  void notificationQueue
}

/** Free a booking's slot and offer it to the waitlist. */
async function freeSlotAndOfferWaitlist(booking: {
  businessId: string
  serviceId: string
  date: Date
  startTime: string
}): Promise<void> {
  await offerNextInLine(
    booking.businessId,
    booking.serviceId,
    booking.date,
    booking.startTime,
  )
}

export type TransitionResult = { ok: true } | { ok: false; error: string }

async function loadOwned(businessId: string, bookingId: string) {
  return prisma.booking.findFirst({
    where: { id: bookingId, businessId },
  })
}

export async function confirmBooking(
  businessId: string,
  bookingId: string,
): Promise<TransitionResult> {
  const b = await loadOwned(businessId, bookingId)
  if (!b) return { ok: false, error: "notFound" }
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
  })
  return { ok: true }
}

export async function attendBooking(
  businessId: string,
  bookingId: string,
): Promise<TransitionResult> {
  const b = await loadOwned(businessId, bookingId)
  if (!b) return { ok: false, error: "notFound" }
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ATTENDED, attendedAt: new Date() },
    }),
    prisma.customer.update({
      where: { id: b.customerId },
      data: { lastVisitAt: new Date(), loyaltyScore: { increment: 1 } },
    }),
  ])

  // Schedule the Follow-up agent (best-effort; no-op if disabled/no queue).
  try {
    const { scheduleFollowup } = await import("@/agents/triggers")
    await scheduleFollowup(businessId, bookingId)
  } catch {
    // never block the attendance transition on agent scheduling
  }

  return { ok: true }
}

export async function cancelBooking(
  businessId: string,
  bookingId: string,
  reason?: string,
): Promise<TransitionResult> {
  const b = await loadOwned(businessId, bookingId)
  if (!b) return { ok: false, error: "notFound" }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    },
  })

  // Freed slot → offer to the next waitlisted customer.
  await freeSlotAndOfferWaitlist(b)
  await recordAudit({
    businessId,
    action: "booking.cancel",
    targetType: "booking",
    targetId: bookingId,
    metadata: reason ? { reason } : undefined,
  })
  return { ok: true }
}

export async function noShowBooking(
  businessId: string,
  bookingId: string,
): Promise<TransitionResult> {
  const b = await loadOwned(businessId, bookingId)
  if (!b) return { ok: false, error: "notFound" }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.NO_SHOW },
    }),
    // Bump no-show intelligence.
    prisma.customer.update({
      where: { id: b.customerId },
      data: {
        totalNoShows: { increment: 1 },
        noShowScore: { increment: 1 },
      },
    }),
  ])

  // A no-show frees the slot too — offer it onward.
  await freeSlotAndOfferWaitlist(b)
  await recordAudit({
    businessId,
    action: "booking.no_show",
    targetType: "booking",
    targetId: bookingId,
    metadata: { customerId: b.customerId },
  })
  return { ok: true }
}
