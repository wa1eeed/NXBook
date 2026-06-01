"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function setBusinessActiveAction(
  businessId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin()

  const biz = await prisma.business.findUnique({ where: { id: businessId } })
  if (!biz) return { ok: false, error: "notFound" }

  await prisma.business.update({ where: { id: businessId }, data: { isActive } })
  await recordAudit({
    businessId,
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "admin.business.setActive",
    targetType: "business",
    targetId: businessId,
    metadata: { isActive },
  })

  revalidatePath(`/admin/businesses/${businessId}`)
  revalidatePath("/admin/businesses")
  return { ok: true }
}

export async function changePlanAction(
  businessId: string,
  planId: string,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin()

  const [biz, plan] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ])
  if (!biz) return { ok: false, error: "notFound" }
  if (!plan) return { ok: false, error: "planNotFound" }

  const existing = await prisma.subscription.findFirst({
    where: { businessId },
  })

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { planId, status: "ACTIVE" },
    })
  } else {
    const now = new Date()
    await prisma.subscription.create({
      data: {
        businessId,
        planId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  await recordAudit({
    businessId,
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "admin.business.changePlan",
    targetType: "business",
    targetId: businessId,
    metadata: { planId, planName: plan.nameEn },
  })

  revalidatePath(`/admin/businesses/${businessId}`)
  revalidatePath("/admin/businesses")
  return { ok: true }
}
