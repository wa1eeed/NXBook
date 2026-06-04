"use server"

// ============================================================
// Billing actions — cancel subscription (sets cancelAtPeriodEnd).
// Tenant-scoped via requireBusiness(); audited.
// ============================================================

import { revalidatePath } from "next/cache"
import { requireBusiness, canManage } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"

export type BillingResult = { ok: true } | { ok: false; error: string }

export async function cancelSubscriptionAction(): Promise<BillingResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const sub = await prisma.subscription.findUnique({
    where: { businessId: ctx.businessId },
  })
  if (!sub) return { ok: false, error: "noSubscription" }

  await prisma.subscription.update({
    where: { businessId: ctx.businessId },
    data: { cancelAtPeriodEnd: true },
  })

  await recordAudit({
    businessId: ctx.businessId,
    action: "subscription.cancel",
    targetType: "subscription",
    targetId: sub.id,
    metadata: { effectiveAt: sub.currentPeriodEnd.toISOString() },
  })

  revalidatePath("/dashboard/billing")
  return { ok: true }
}

export async function resumeSubscriptionAction(): Promise<BillingResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const sub = await prisma.subscription.findUnique({
    where: { businessId: ctx.businessId },
  })
  if (!sub) return { ok: false, error: "noSubscription" }

  await prisma.subscription.update({
    where: { businessId: ctx.businessId },
    data: { cancelAtPeriodEnd: false },
  })

  await recordAudit({
    businessId: ctx.businessId,
    action: "subscription.resume",
    targetType: "subscription",
    targetId: sub.id,
  })

  revalidatePath("/dashboard/billing")
  return { ok: true }
}
