// ============================================================
// Business detail data fetcher for the admin/businesses/[id] page.
// Cross-tenant read gated by requireSuperAdmin (CLAUDE.md §5).
// ============================================================

import { requireSuperAdmin } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export interface BusinessDetailData {
  // Core
  id: string
  name: string
  slug: string
  type: string
  isActive: boolean
  defaultLocale: string
  brandColor: string
  createdAt: string

  // Subscription
  planId: string | null
  planName: string | null
  subscriptionStatus: string | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null

  // KPIs
  bookingsThisMonth: number
  totalCustomers: number
  totalRevenue: number

  // Bookings tab
  bookings: {
    id: string
    date: string
    startTime: string
    status: string
    customerName: string
    customerPhone: string
    serviceName: string
    staffName: string | null
    amount: number | null
  }[]

  // Customers tab
  customers: {
    id: string
    name: string
    phone: string
    bookingsCount: number
    totalSpent: number
    noShowScore: number
    loyaltyScore: number
    isVIP: boolean
  }[]

  // Revenue tab
  revenueKpis: {
    totalRevenue: number
    successfulCount: number
    pendingCount: number
  }
  monthlyRevenue: { label: string; value: number }[]
  recentTransactions: {
    id: string
    createdAt: string
    amount: number
    status: string
    provider: string
    customerName: string | null
  }[]

  // Audit & Agents tab
  auditLogs: {
    id: string
    action: string
    actorEmail: string | null
    actorId: string | null
    createdAt: string
    metadata: string | null
  }[]
  agents: {
    id: string
    type: string
    isActive: boolean
    lastRunAt: string | null
    totalRuns: number
  }[]
  gateway: {
    provider: string
    isActive: boolean
  } | null

  // All plans (for change-plan dropdown)
  allPlans: { id: string; nameEn: string; tier: string }[]
}

export async function getBusinessDetail(
  id: string,
): Promise<BusinessDetailData | null> {
  await requireSuperAdmin()

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      subscription: {
        include: { plan: { select: { id: true, nameEn: true, tier: true } } },
      },
    },
  })
  if (!business) return null

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Build last 6 months labels
  const months: { label: string; start: Date; end: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString("en", { month: "short", year: "2-digit" })
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    months.push({ label, start, end })
  }

  const [
    bookingsThisMonth,
    totalCustomers,
    bookings,
    customers,
    transactions,
    transactionKpis,
    auditLogs,
    agents,
    gateway,
    allPlans,
    monthlyRevRows,
  ] = await Promise.all([
    prisma.booking.count({
      where: { businessId: id, createdAt: { gte: startOfMonth } },
    }),
    prisma.customer.count({ where: { businessId: id } }),
    prisma.booking.findMany({
      where: { businessId: id },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 100,
      include: {
        customer: { select: { name: true, phone: true } },
        service: { select: { nameEn: true } },
        staff: { select: { name: true } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: id },
      orderBy: [{ isVIP: "desc" }, { totalSpent: "desc" }],
      take: 100,
      include: { _count: { select: { bookings: true } } },
    }),
    prisma.transaction.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        booking: { include: { customer: { select: { name: true } } } },
      },
    }),
    prisma.transaction.aggregate({
      where: { businessId: id },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.auditLog.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agent.findMany({ where: { businessId: id } }),
    prisma.paymentGateway.findUnique({
      where: { businessId: id },
      select: { provider: true, isActive: true },
    }),
    prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      select: { id: true, nameEn: true, tier: true },
    }),
    // Monthly revenue aggregation per bucket
    Promise.all(
      months.map(async (m) => {
        const agg = await prisma.transaction.aggregate({
          where: {
            businessId: id,
            status: "PAID",
            createdAt: { gte: m.start, lt: m.end },
          },
          _sum: { amount: true },
        })
        return { label: m.label, value: agg._sum.amount ?? 0 }
      }),
    ),
  ])

  const totalRevenue = transactionKpis._sum.amount ?? 0
  const pendingCount = await prisma.transaction.count({
    where: { businessId: id, status: "PENDING" },
  })

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    type: business.type,
    isActive: business.isActive,
    defaultLocale: business.defaultLocale,
    brandColor: business.brandColor,
    createdAt: business.createdAt.toISOString(),

    planId: business.subscription?.planId ?? null,
    planName: business.subscription?.plan.nameEn ?? null,
    subscriptionStatus: business.subscription?.status ?? null,
    trialEndsAt: business.subscription?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd:
      business.subscription?.currentPeriodEnd?.toISOString() ?? null,

    bookingsThisMonth,
    totalCustomers,
    totalRevenue,

    bookings: bookings.map((b) => ({
      id: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      status: b.status,
      customerName: b.customer.name,
      customerPhone: b.customer.phone,
      serviceName: b.service.nameEn,
      staffName: b.staff?.name ?? null,
      amount: b.paymentAmount,
    })),

    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      bookingsCount: c._count.bookings,
      totalSpent: c.totalSpent,
      noShowScore: c.noShowScore,
      loyaltyScore: c.loyaltyScore,
      isVIP: c.isVIP,
    })),

    revenueKpis: {
      totalRevenue,
      successfulCount: transactionKpis._count,
      pendingCount,
    },
    monthlyRevenue: monthlyRevRows,
    recentTransactions: transactions.map((tx) => ({
      id: tx.id,
      createdAt: tx.createdAt.toISOString(),
      amount: tx.amount,
      status: tx.status,
      provider: tx.provider,
      customerName: tx.booking?.customer?.name ?? null,
    })),

    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      actorEmail: a.actorEmail,
      actorId: a.actorId,
      createdAt: a.createdAt.toISOString(),
      metadata: a.metadata ? JSON.stringify(a.metadata).slice(0, 120) : null,
    })),
    agents: agents.map((a) => ({
      id: a.id,
      type: a.type,
      isActive: a.isActive,
      lastRunAt: a.lastRunAt?.toISOString() ?? null,
      totalRuns: a.totalRuns,
    })),
    gateway: gateway?.isActive ? { provider: gateway.provider, isActive: true } : null,

    allPlans: allPlans.map((p) => ({ id: p.id, nameEn: p.nameEn, tier: p.tier })),
  }
}
