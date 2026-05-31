// ============================================================
// Booking engine — pure slot math + booking creation.
// Slots come from a service's weekly availability, sized by the
// service duration (+ buffer), with per-slot capacity tracking
// (max / booked / remaining). All DB access is tenant-scoped by
// the businessId passed in (callers resolve it from the session).
// ============================================================

import { prisma } from "@/lib/prisma"
import { BookingStatus } from "@prisma/client"

export interface Slot {
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  capacity: number
  booked: number
  remaining: number
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Active booking statuses that consume a slot's capacity.
const OCCUPYING: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ATTENDED,
]

/**
 * Compute bookable slots for a service on a given date (local, midnight).
 * A slot's length = service.durationMin; the cursor advances by
 * durationMin + bufferMin so back-to-back bookings include prep/cleanup.
 */
export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  date: Date,
): Promise<Slot[]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true },
    include: { availability: { where: { isActive: true } } },
  })
  if (!service) return []

  const dayOfWeek = date.getDay() // 0 = Sunday
  const windows = service.availability.filter((a) => a.dayOfWeek === dayOfWeek)
  if (windows.length === 0) return []

  // Business closed that day?
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const holiday = await prisma.businessHoliday.findFirst({
    where: { businessId, date: { gte: startOfDay, lt: endOfDay } },
  })
  if (holiday) return []

  // Existing bookings on that date for this service, grouped by startTime.
  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      serviceId,
      date: { gte: startOfDay, lt: endOfDay },
      status: { in: OCCUPYING },
    },
    select: { startTime: true },
  })
  const bookedCount = new Map<string, number>()
  for (const b of bookings) {
    bookedCount.set(b.startTime, (bookedCount.get(b.startTime) ?? 0) + 1)
  }

  const step = service.durationMin + service.bufferMin
  const slots: Slot[] = []

  for (const w of windows) {
    const open = toMinutes(w.startTime)
    const close = toMinutes(w.endTime)
    for (let t = open; t + service.durationMin <= close; t += step) {
      const startTime = toHHMM(t)
      const booked = bookedCount.get(startTime) ?? 0
      slots.push({
        startTime,
        endTime: toHHMM(t + service.durationMin),
        capacity: service.maxCapacity,
        booked,
        remaining: Math.max(0, service.maxCapacity - booked),
      })
    }
  }

  return slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}

export interface CreateBookingInput {
  businessId: string
  serviceId: string
  date: Date // local midnight of the booking day
  startTime: string // "HH:MM"
  customerName: string
  customerPhone: string
  staffId?: string
  notes?: string
  bookedVia?: string
}

export type BookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: "serviceNotFound" | "slotUnavailable" | "slotFull" | "customerBlocked" }

/**
 * Create a booking transactionally: validates the slot exists and has
 * remaining capacity (re-checked inside the tx to avoid overbooking),
 * upserts the customer by [businessId, phone], and records the booking.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingResult> {
  const {
    businessId,
    serviceId,
    date,
    startTime,
    customerName,
    customerPhone,
    staffId,
    notes,
    bookedVia = "landing_page",
  } = input

  const slots = await getAvailableSlots(businessId, serviceId, date)
  const slot = slots.find((s) => s.startTime === startTime)
  if (!slot) return { ok: false, error: "slotUnavailable" }
  if (slot.remaining <= 0) return { ok: false, error: "slotFull" }

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  try {
    const bookingId = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { businessId_phone: { businessId, phone: customerPhone } },
        update: { name: customerName },
        create: { businessId, name: customerName, phone: customerPhone },
      })
      if (customer.isBlocked) throw new Error("BLOCKED")

      // Re-check capacity inside the tx (guards against races).
      const occupying = await tx.booking.count({
        where: {
          businessId,
          serviceId,
          date: { gte: startOfDay, lt: endOfDay },
          startTime,
          status: { in: OCCUPYING },
        },
      })
      if (occupying >= slot.capacity) throw new Error("FULL")

      const booking = await tx.booking.create({
        data: {
          businessId,
          serviceId,
          customerId: customer.id,
          staffId: staffId || null,
          date: startOfDay,
          startTime,
          endTime: slot.endTime,
          status: "PENDING",
          notes: notes || null,
          bookedVia,
        },
      })

      await tx.customer.update({
        where: { id: customer.id },
        data: { totalBookings: { increment: 1 } },
      })

      return booking.id
    })

    return { ok: true, bookingId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FULL") return { ok: false, error: "slotFull" }
    if (msg === "BLOCKED") return { ok: false, error: "customerBlocked" }
    return { ok: false, error: "slotUnavailable" }
  }
}
