"use server"

// ============================================================
// Bookings dashboard server actions — tenant-scoped lifecycle
// transitions. Each wraps a booking-lifecycle function after
// resolving the business from the session.
// ============================================================

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"
import {
  confirmBooking,
  attendBooking,
  cancelBooking,
  noShowBooking,
  type TransitionResult,
} from "@/lib/booking-lifecycle"

type Action = "confirm" | "attend" | "cancel" | "noShow"

export async function transitionBooking(
  bookingId: string,
  action: Action,
): Promise<TransitionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  let res: TransitionResult
  switch (action) {
    case "confirm":
      res = await confirmBooking(ctx.businessId, bookingId)
      break
    case "attend":
      res = await attendBooking(ctx.businessId, bookingId)
      break
    case "cancel":
      res = await cancelBooking(ctx.businessId, bookingId)
      break
    case "noShow":
      res = await noShowBooking(ctx.businessId, bookingId)
      break
  }

  if (res.ok) revalidatePath("/dashboard/bookings")
  return res
}

// ─── Reschedule ───────────────────────────────────────────

type SlotDTO = { startTime: string; endTime: string; remaining: number }

// Get available slots for a service on a given date (used by the
// reschedule slide-over and the manual-booking wizard).
export async function getAvailableSlotsAction(
  serviceId: string,
  dateStr: string,
): Promise<SlotDTO[]> {
  const ctx = await requireBusiness()
  const { getAvailableSlots } = await import("@/lib/booking")
  const date = new Date(dateStr)
  const slots = await getAvailableSlots(ctx.businessId, serviceId, date)
  return slots.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    remaining: s.remaining,
  }))
}

// Move a booking to a new date/slot for the same service. Resets the
// booking to PENDING so the customer re-confirms the new time.
export async function rescheduleBookingAction(
  bookingId: string,
  newDate: string,
  newStartTime: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: ctx.businessId },
  })
  if (!booking) return { ok: false, error: "notFound" }

  const { getAvailableSlots } = await import("@/lib/booking")
  const date = new Date(newDate)
  const slots = await getAvailableSlots(ctx.businessId, booking.serviceId, date)
  const slot = slots.find((s) => s.startTime === newStartTime)
  if (!slot) return { ok: false, error: "slotUnavailable" }
  if (slot.remaining <= 0) return { ok: false, error: "slotFull" }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      date,
      startTime: newStartTime,
      endTime: slot.endTime,
      status: "PENDING",
      confirmedAt: null,
    },
  })
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "booking.reschedule",
    targetType: "booking",
    targetId: bookingId,
  })
  revalidatePath("/dashboard/bookings")
  return { ok: true }
}

// ─── Manual booking creation (dashboard) ──────────────────

interface ManualBookingInput {
  serviceId: string
  date: string
  startTime: string
  customerId?: string
  newCustomer?: { name: string; phone: string; email?: string }
  notes?: string
}

export async function createManualBookingAction(
  input: ManualBookingInput,
): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  // Resolve the customer's name + phone. createBooking() upserts by
  // [businessId, phone] internally, so we pass those rather than an id.
  let name: string | undefined
  let phone: string | undefined
  let email: string | undefined

  if (input.customerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId: ctx.businessId },
      select: { name: true, phone: true },
    })
    if (!existing) return { ok: false, error: "invalidInput" }
    name = existing.name
    phone = existing.phone
  } else if (input.newCustomer) {
    name = input.newCustomer.name
    phone = input.newCustomer.phone
    email = input.newCustomer.email
  }

  if (!name || !phone) return { ok: false, error: "invalidInput" }

  // Pre-create/update the customer so an email on a brand-new customer
  // is persisted (createBooking only upserts name + phone).
  if (email) {
    await prisma.customer.upsert({
      where: { businessId_phone: { businessId: ctx.businessId, phone } },
      create: { businessId: ctx.businessId, name, phone, email },
      update: { email },
    })
  }

  const { createBooking } = await import("@/lib/booking")
  const result = await createBooking({
    businessId: ctx.businessId,
    serviceId: input.serviceId,
    customerName: name,
    customerPhone: phone,
    date: new Date(input.date),
    startTime: input.startTime,
    notes: input.notes,
    bookedVia: "dashboard",
  })
  if (!result.ok) return { ok: false, error: result.error }

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "booking.manualCreate",
    targetType: "booking",
    targetId: result.bookingId,
  })
  revalidatePath("/dashboard/bookings")
  return { ok: true, bookingId: result.bookingId }
}
