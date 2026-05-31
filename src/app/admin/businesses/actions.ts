"use server"

// Super-admin business management. Cross-tenant writes behind the
// super-admin guard, audit-logged (CLAUDE.md §5/§7).
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function setBusinessActive(
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

  revalidatePath("/admin/businesses")
  return { ok: true }
}

export interface BusinessDetails {
  id: string
  name: string
  slug: string
  type: string
  brandColor: string
  defaultLocale: string
  createdAt: string
  plan: string | null
  status: string | null
  trialEndsAt: string | null
  recentBookings: {
    id: string
    date: string
    customer: string
    service: string
    status: string
  }[]
  recentAudit: {
    id: string
    action: string
    actor: string | null
    createdAt: string
  }[]
  recentTransactions: {
    id: string
    amount: number
    status: string
    provider: string
    type: string
    createdAt: string
  }[]
}

// Cross-tenant read for the slide-over detail panel. The cross-tenant
// access is intentional and gated by requireSuperAdmin (CLAUDE.md §5).
export async function getBusinessDetails(
  businessId: string,
): Promise<BusinessDetails | null> {
  await requireSuperAdmin()

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      subscription: { include: { plan: { select: { nameEn: true } } } },
    },
  })
  if (!biz) return null

  const [bookings, audit, transactions] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
      take: 10,
      include: {
        customer: { select: { name: true } },
        service: { select: { nameEn: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, amount: true, status: true, provider: true, type: true, createdAt: true },
    }),
  ])

  return {
    id: biz.id,
    name: biz.name,
    slug: biz.slug,
    type: biz.type,
    brandColor: biz.brandColor,
    defaultLocale: biz.defaultLocale,
    createdAt: biz.createdAt.toISOString(),
    plan: biz.subscription?.plan.nameEn ?? null,
    status: biz.subscription?.status ?? null,
    trialEndsAt: biz.subscription?.trialEndsAt?.toISOString() ?? null,
    recentBookings: bookings.map((b) => ({
      id: b.id,
      date: b.date.toISOString(),
      customer: b.customer.name,
      service: b.service.nameEn,
      status: b.status,
    })),
    recentAudit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      actor: a.actorEmail ?? a.actorId ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    recentTransactions: transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      provider: tx.provider,
      type: tx.type,
      createdAt: tx.createdAt.toISOString(),
    })),
  }
}
