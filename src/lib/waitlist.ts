// ============================================================
// Waitlist domain logic — the core moat (CLAUDE.md §10/§11).
// join → offerNext (OFFERED + expiry window + notify) → confirm
// (becomes a booking) / expire (advance to next in line).
// All functions are tenant-scoped by the businessId passed in.
// ============================================================

import { prisma } from "@/lib/prisma"
import { WaitlistStatus } from "@prisma/client"
import { createBooking } from "@/lib/booking"
import { dispatchWhatsApp } from "@/lib/notify"
import { waitlistOfferBody } from "@/lib/messages-templates"
import { waitlistQueue, queuesEnabled } from "@/lib/queue"
import { triggerWaitlistAgent } from "@/agents/triggers"
import type { Locale } from "@/i18n/config"

const DEFAULT_OFFER_MINUTES = 30

interface JoinInput {
  businessId: string
  serviceId: string
  date: Date // local midnight
  slotTime: string // "HH:MM"
  customerName: string
  customerPhone: string
}

export type JoinResult =
  | { ok: true; waitlistId: string; position: number }
  | { ok: false; error: "alreadyWaiting" | "customerBlocked" }

/** Add a customer to the waitlist for a specific (service, date, slot). */
export async function joinWaitlist(input: JoinInput): Promise<JoinResult> {
  const { businessId, serviceId, date, slotTime, customerName, customerPhone } =
    input

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const customer = await prisma.customer.upsert({
    where: { businessId_phone: { businessId, phone: customerPhone } },
    update: { name: customerName },
    create: { businessId, name: customerName, phone: customerPhone },
  })
  if (customer.isBlocked) return { ok: false, error: "customerBlocked" }

  // No duplicate active entry for the same slot.
  const existing = await prisma.waitlist.findFirst({
    where: {
      businessId,
      serviceId,
      date: startOfDay,
      slotTime,
      customerId: customer.id,
      status: { in: [WaitlistStatus.WAITING, WaitlistStatus.OFFERED] },
    },
  })
  if (existing) return { ok: false, error: "alreadyWaiting" }

  // Position = current active queue length + 1.
  const ahead = await prisma.waitlist.count({
    where: {
      businessId,
      serviceId,
      date: startOfDay,
      slotTime,
      status: { in: [WaitlistStatus.WAITING, WaitlistStatus.OFFERED] },
    },
  })

  const entry = await prisma.waitlist.create({
    data: {
      businessId,
      serviceId,
      customerId: customer.id,
      date: startOfDay,
      slotTime,
      status: WaitlistStatus.WAITING,
      position: ahead + 1,
    },
  })

  return { ok: true, waitlistId: entry.id, position: entry.position }
}

/**
 * Offer the freed slot to the next WAITING customer (lowest position).
 * Marks them OFFERED with an expiry, notifies them, and schedules an
 * expiry job. No-op if nobody is waiting. Called when a slot frees up.
 */
export async function offerNextInLine(
  businessId: string,
  serviceId: string,
  date: Date,
  slotTime: string,
  offerMinutes = DEFAULT_OFFER_MINUTES,
): Promise<{ offered: boolean; waitlistId?: string }> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  // Don't double-offer if someone already holds an active offer.
  const activeOffer = await prisma.waitlist.findFirst({
    where: {
      businessId,
      serviceId,
      date: startOfDay,
      slotTime,
      status: WaitlistStatus.OFFERED,
      offerExpires: { gt: new Date() },
    },
  })
  if (activeOffer) return { offered: false }

  const next = await prisma.waitlist.findFirst({
    where: {
      businessId,
      serviceId,
      date: startOfDay,
      slotTime,
      status: WaitlistStatus.WAITING,
    },
    orderBy: { position: "asc" },
    include: {
      customer: true,
      business: { select: { name: true, defaultLocale: true } },
    },
  })
  if (!next) return { offered: false }

  const now = new Date()
  const offerExpires = new Date(now.getTime() + offerMinutes * 60 * 1000)

  await prisma.waitlist.update({
    where: { id: next.id },
    data: {
      status: WaitlistStatus.OFFERED,
      offeredAt: now,
      offerExpires,
    },
  })

  // Messaging: if the Waitlist AI agent is enabled, let it craft and send
  // the (possibly AI-personalized) offer + record its run. Otherwise send
  // the plain template directly here. This avoids a double-send.
  const agent = await prisma.agent.findUnique({
    where: { businessId_type: { businessId, type: "WAITLIST" } },
    select: { isActive: true },
  })

  if (agent?.isActive) {
    await triggerWaitlistAgent(businessId, next.id)
  } else {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { nameEn: true, nameAr: true },
    })
    const locale = next.business.defaultLocale as Locale
    const serviceName =
      locale === "ar" && service?.nameAr ? service.nameAr : service?.nameEn ?? ""
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const confirmUrl = `${appUrl}/waitlist/${next.id}/confirm`

    await dispatchWhatsApp({
      businessId,
      to: next.customer.phone,
      type: "waitlist_offer",
      body: waitlistOfferBody(
        locale,
        {
          customerName: next.customer.name,
          businessName: next.business.name,
          serviceName,
          date: startOfDay.toISOString().slice(0, 10),
          time: slotTime,
        },
        offerMinutes,
        confirmUrl,
      ),
    })
  }

  // Schedule the expiry sweep (worker advances the queue if not confirmed).
  if (queuesEnabled()) {
    await waitlistQueue().add(
      "expire",
      { waitlistId: next.id },
      { delay: offerMinutes * 60 * 1000 },
    )
  }

  return { offered: true, waitlistId: next.id }
}

export type ConfirmResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string }

/**
 * Confirm an active offer → converts it into a booking and marks the
 * waitlist entry CONFIRMED. Used by the public confirm link + worker.
 */
export async function confirmOffer(waitlistId: string): Promise<ConfirmResult> {
  const entry = await prisma.waitlist.findUnique({
    where: { id: waitlistId },
    include: { customer: true },
  })
  if (!entry) return { ok: false, error: "notFound" }
  if (entry.status !== WaitlistStatus.OFFERED) {
    return { ok: false, error: "notOffered" }
  }
  if (entry.offerExpires && entry.offerExpires < new Date()) {
    await prisma.waitlist.update({
      where: { id: waitlistId },
      data: { status: WaitlistStatus.EXPIRED },
    })
    return { ok: false, error: "expired" }
  }

  const res = await createBooking({
    businessId: entry.businessId,
    serviceId: entry.serviceId,
    date: entry.date,
    startTime: entry.slotTime,
    customerName: entry.customer.name,
    customerPhone: entry.customer.phone,
    bookedVia: "waitlist",
  })
  if (!res.ok) return { ok: false, error: res.error }

  await prisma.waitlist.update({
    where: { id: waitlistId },
    data: { status: WaitlistStatus.CONFIRMED, confirmedAt: new Date() },
  })

  return { ok: true, bookingId: res.bookingId }
}

/**
 * Expire a stale offer and advance to the next person in line.
 * Called by the waitlist worker (delayed job) and the cron sweep.
 */
export async function expireOffer(waitlistId: string): Promise<void> {
  const entry = await prisma.waitlist.findUnique({ where: { id: waitlistId } })
  if (!entry || entry.status !== WaitlistStatus.OFFERED) return
  // If the offer was confirmed/extended in the meantime, leave it.
  if (entry.offerExpires && entry.offerExpires > new Date()) return

  await prisma.waitlist.update({
    where: { id: waitlistId },
    data: { status: WaitlistStatus.EXPIRED },
  })

  // Roll the freed slot to the next waiting customer.
  await offerNextInLine(
    entry.businessId,
    entry.serviceId,
    entry.date,
    entry.slotTime,
  )
}
