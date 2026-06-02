"use server"

// ============================================================
// Public booking actions for a tenant landing page. These are
// unauthenticated (customers aren't users), so the businessId is
// resolved from the public slug — never trusted from the client —
// and every query is scoped to that resolved id.
// ============================================================

import { z } from "zod"
import { headers } from "next/headers"
import * as Sentry from "@sentry/nextjs"
import { prisma } from "@/lib/prisma"
import { getAvailableSlots, createBooking, type Slot } from "@/lib/booking"
import { onBookingCreated } from "@/lib/booking-lifecycle"
import { joinWaitlist } from "@/lib/waitlist"
import { rateLimit, LIMITS, clientIp } from "@/lib/ratelimit"
import { getPaymentProvider } from "@/lib/payment-gateway"

// Per-IP rate-limit guard for public write actions. Returns true when
// the request should be blocked.
async function tooManyRequests(action: string): Promise<boolean> {
  const ip = clientIp(await headers())
  const res = await rateLimit(
    `${action}:ip:${ip}`,
    LIMITS.publicBooking.limit,
    LIMITS.publicBooking.windowSec,
  )
  return !res.ok
}

async function resolveBusiness(slug: string) {
  return prisma.business.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  })
}

export async function listSlots(
  slug: string,
  serviceId: string,
  dateISO: string,
): Promise<Slot[]> {
  const biz = await resolveBusiness(slug)
  if (!biz) return []
  const date = new Date(dateISO + "T00:00:00")
  if (Number.isNaN(date.getTime())) return []
  // Confirm the service belongs to this business before exposing slots.
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: biz.id, isActive: true, isVisible: true },
    select: { id: true },
  })
  if (!service) return []
  return getAvailableSlots(biz.id, serviceId, date)
}

const bookSchema = z.object({
  slug: z.string(),
  serviceId: z.string(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(30),
})

export type PublicBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string }

export async function submitBooking(
  input: z.infer<typeof bookSchema>,
): Promise<PublicBookingResult> {
  const parsed = bookSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  if (await tooManyRequests("booking")) return { ok: false, error: "rateLimited" }

  const biz = await resolveBusiness(d.slug)
  if (!biz) return { ok: false, error: "notFound" }

  const res = await createBooking({
    businessId: biz.id,
    serviceId: d.serviceId,
    date: new Date(d.dateISO + "T00:00:00"),
    startTime: d.startTime,
    customerName: d.name,
    customerPhone: d.phone,
    bookedVia: "landing_page",
  })

  if (!res.ok) return { ok: false, error: res.error }

  // Fire confirmation + schedule reminders (best-effort; never blocks).
  try {
    await onBookingCreated(res.bookingId)
  } catch {
    // notification/queue failures must not fail the booking
  }

  return { ok: true, bookingId: res.bookingId }
}

const waitlistSchema = z.object({
  slug: z.string(),
  serviceId: z.string(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(30),
})

export type WaitlistJoinResult =
  | { ok: true; position: number }
  | { ok: false; error: string }

export async function joinWaitlistAction(
  input: z.infer<typeof waitlistSchema>,
): Promise<WaitlistJoinResult> {
  const parsed = waitlistSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  if (await tooManyRequests("waitlist")) return { ok: false, error: "rateLimited" }

  const biz = await resolveBusiness(d.slug)
  if (!biz) return { ok: false, error: "notFound" }

  const service = await prisma.service.findFirst({
    where: { id: d.serviceId, businessId: biz.id, isActive: true, isVisible: true },
    select: { id: true },
  })
  if (!service) return { ok: false, error: "notFound" }

  const res = await joinWaitlist({
    businessId: biz.id,
    serviceId: d.serviceId,
    date: new Date(d.dateISO + "T00:00:00"),
    slotTime: d.startTime,
    customerName: d.name,
    customerPhone: d.phone,
  })
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, position: res.position }
}

// ─── Paid booking flow ─────────────────────────────────────
// When a business has paymentEnabled, the customer pays a deposit
// (or full price) before the booking is confirmed. We create the
// booking PENDING + a PENDING Transaction, then hand off to the
// tenant's gateway. The webhook flips both to PAID/CONFIRMED.
// FAIL-OPEN (CLAUDE.md): if the gateway can't be reached we still
// keep the booking so the customer isn't lost.

const payBookSchema = z.object({
  slug: z.string(),
  serviceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(6).max(30),
  notes: z.string().max(300).optional(),
})

export type InitiatePaymentResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string }

export async function initiateBookingPaymentAction(
  input: z.infer<typeof payBookSchema>,
): Promise<InitiatePaymentResult> {
  const parsed = payBookSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  if (await tooManyRequests("booking")) return { ok: false, error: "rateLimited" }

  // 1. Resolve business (with payment config) — businessId is never trusted from the client.
  const business = await prisma.business.findFirst({
    where: { slug: d.slug, isActive: true },
    select: { id: true, paymentProvider: true, depositPercent: true },
  })
  if (!business) return { ok: false, error: "notFound" }

  // 2. Confirm the service belongs to this business + that it actually
  // requires online payment. Per-service is the authoritative gate now —
  // not the business-wide paymentEnabled flag (CLAUDE.md §11).
  const service = await prisma.service.findFirst({
    where: { id: d.serviceId, businessId: business.id, isActive: true, isVisible: true },
    select: { id: true, nameEn: true, price: true, paymentMode: true },
  })
  if (!service) return { ok: false, error: "notFound" }
  if (service.paymentMode !== "ONLINE") {
    return { ok: false, error: "paymentNotRequired" }
  }
  if (service.price <= 0) {
    // Free services can't be online-paid even if mis-flagged.
    return { ok: false, error: "paymentNotRequired" }
  }

  const bookingDate = new Date(d.date + "T00:00:00")
  const slots = await getAvailableSlots(business.id, d.serviceId, bookingDate)
  const slot = slots.find((s) => s.startTime === d.startTime)
  if (!slot || slot.remaining <= 0) return { ok: false, error: "slotUnavailable" }

  // 3. Create the booking PENDING.
  const result = await createBooking({
    businessId: business.id,
    serviceId: d.serviceId,
    date: bookingDate,
    startTime: d.startTime,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    notes: d.notes,
    bookedVia: "landing_page",
  })
  if (!result.ok) return { ok: false, error: result.error }

  // 4. Compute the deposit (0% => full price).
  const depositPct = business.depositPercent > 0 ? business.depositPercent : 100
  const amountSar = Math.round((service.price * depositPct) / 100 * 100) / 100

  // 5. Mark the booking unpaid + amount.
  await prisma.booking.update({
    where: { id: result.bookingId },
    data: { paymentStatus: "UNPAID", paymentAmount: amountSar },
  })

  // 6. Record a PENDING Transaction.
  const tx = await prisma.transaction.create({
    data: {
      businessId: business.id,
      bookingId: result.bookingId,
      amount: amountSar,
      provider: business.paymentProvider ?? "MOYASAR",
      status: "PENDING",
      type: "BOOKING",
      metadata: { serviceId: d.serviceId, customerPhone: d.customerPhone },
    },
  })

  // 7. Hand off to the gateway.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  try {
    const provider = await getPaymentProvider(business.id)
    const payment = await provider.createPayment({
      amountSar,
      description: `${service.nameEn} — ${d.customerName}`,
      callbackUrl: `${appUrl}/payment/result?ref=${tx.id}&slug=${d.slug}`,
      metadata: { transactionId: tx.id, bookingId: result.bookingId, businessId: business.id },
    })
    await prisma.transaction.update({ where: { id: tx.id }, data: { providerRef: payment.providerRef } })
    return { ok: true, paymentUrl: payment.transactionUrl }
  } catch (err) {
    // FAIL-OPEN: keep the booking, surface the result page in fallback mode.
    Sentry.captureException(err)
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } })
    try {
      await onBookingCreated(result.bookingId)
    } catch {
      // notifications must not fail the flow
    }
    return { ok: true, paymentUrl: `${appUrl}/payment/result?ref=${tx.id}&slug=${d.slug}&fallback=1` }
  }
}
