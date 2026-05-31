// ============================================================
// Platform-wide statistics for the super-admin 360° overview.
// EVERY query here is intentionally cross-tenant and MUST only be
// reached behind requireSuperAdmin() (CLAUDE.md §5). Callers are
// responsible for that guard; this module assumes it has run.
// ============================================================

import { prisma } from "@/lib/prisma"

export interface PlatformStats {
  mrr: number
  arr: number
  mrrLastMonth: number
  mrrGrowthPct: number
  totalBusinesses: number
  activeBusinesses: number
  trialingBusinesses: number
  inactiveBusinesses: number
  bizGrowthPct: number
  totalBookings: number
  bookingsThisMonth: number
  totalCustomers: number
  agentRuns: number
  transactionsThisMonth: number
  nxbookPayFees: number
  paymentBusinesses: number
  top5ByBookings: {
    id: string
    name: string
    slug: string
    bookingsThisMonth: number
  }[]
  planDistribution: { planName: string; count: number; color: string }[]
  mrrSeries: { month: string; mrr: number }[]
  bizGrowthSeries: { month: string; count: number }[]
  recentBusinesses: {
    id: string
    name: string
    planName: string | null
    status: string | null
    createdAt: string
  }[]
  recentAgentLogs: {
    id: string
    agentType: string
    status: string
    businessName: string
    createdAt: string
  }[]
}

// Stable palette for plan slices — reused by the pie chart client.
const PLAN_COLORS = ["#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444"]

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** First day of the month `back` months before `from` (back=0 → current month). */
function monthStart(from: Date, back: number): Date {
  return new Date(from.getFullYear(), from.getMonth() - back, 1)
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = monthStart(now, 1)

  const [
    totalBusinesses,
    activeBusinesses,
    activeSubs,
    totalBookings,
    bookingsThisMonth,
    totalCustomers,
    agentRuns,
    allBusinessesForSeries,
    recentBusinessesRaw,
    recentAgentLogsRaw,
    plans,
    txThisMonthAgg,
    nxbookPayAgg,
    paymentBusinesses,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    // All subscriptions that matter for MRR/plan distribution, with the
    // info needed to bucket them and recompute last month's MRR.
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      include: {
        plan: { select: { nameEn: true, priceMonthly: true } },
        business: { select: { createdAt: true } },
      },
    }),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.customer.count(),
    prisma.agentLog.count(),
    prisma.business.findMany({ select: { createdAt: true } }),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        subscription: {
          select: { status: true, plan: { select: { nameEn: true } } },
        },
      },
    }),
    prisma.agentLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        agentType: true,
        status: true,
        createdAt: true,
        business: { select: { name: true } },
      },
    }),
    prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    // Cross-tenant payment aggregates (behind requireSuperAdmin, §5).
    prisma.transaction.aggregate({
      where: { status: "PAID", createdAt: { gte: thisMonthStart } },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        status: "PAID",
        provider: "NXBOOK_PAY",
        createdAt: { gte: thisMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.paymentGateway.count({ where: { isActive: true } }),
  ])

  // ── MRR: only paying (ACTIVE) subscriptions contribute; trials are 0.
  const payingSubs = activeSubs.filter((s) => s.status === "ACTIVE")
  const mrr = payingSubs.reduce((sum, s) => sum + s.plan.priceMonthly, 0)

  // ── Last month's MRR approximation: count paying subs whose business
  // existed before the start of this month (i.e. were active last month).
  const mrrLastMonth = payingSubs
    .filter((s) => s.business.createdAt < thisMonthStart)
    .reduce((sum, s) => sum + s.plan.priceMonthly, 0)

  const mrrGrowthPct =
    mrrLastMonth > 0
      ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100
      : mrr > 0
        ? 100
        : 0

  const trialingBusinesses = activeSubs.filter(
    (s) => s.status === "TRIALING",
  ).length
  const inactiveBusinesses = totalBusinesses - activeBusinesses

  // ── Business growth %: new businesses this month vs last month.
  const newThisMonth = allBusinessesForSeries.filter(
    (b) => b.createdAt >= thisMonthStart,
  ).length
  const newLastMonth = allBusinessesForSeries.filter(
    (b) => b.createdAt >= lastMonthStart && b.createdAt < thisMonthStart,
  ).length
  const bizGrowthPct =
    newLastMonth > 0
      ? ((newThisMonth - newLastMonth) / newLastMonth) * 100
      : newThisMonth > 0
        ? 100
        : 0

  // ── 6-month series buckets (oldest → newest).
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const start = monthStart(now, 5 - i)
    const end = monthStart(now, 4 - i)
    return { start, end, label: MONTH_LABELS[start.getMonth()] }
  })

  // Business growth per month: count Business.createdAt in each bucket.
  const bizGrowthSeries = buckets.map((b) => ({
    month: b.label,
    count: allBusinessesForSeries.filter(
      (biz) => biz.createdAt >= b.start && biz.createdAt < b.end,
    ).length,
  }))

  // MRR series: cumulative paying MRR for subs whose business existed by
  // the end of each bucket month (approximation — we lack historical
  // subscription snapshots, so we use business creation as the proxy).
  const mrrSeries = buckets.map((b) => ({
    month: b.label,
    mrr: payingSubs
      .filter((s) => s.business.createdAt < b.end)
      .reduce((sum, s) => sum + s.plan.priceMonthly, 0),
  }))

  // ── Plan distribution (only plans with at least one subscription show).
  const planDistribution = plans
    .filter((p) => p._count.subscriptions > 0)
    .map((p, i) => ({
      planName: p.nameEn,
      count: p._count.subscriptions,
      color: PLAN_COLORS[i % PLAN_COLORS.length],
    }))

  // ── Top 5 businesses by bookings created this month.
  const grouped = await prisma.booking.groupBy({
    by: ["businessId"],
    where: { createdAt: { gte: thisMonthStart } },
    _count: { _all: true },
    orderBy: { _count: { businessId: "desc" } },
    take: 5,
  })
  const topIds = grouped.map((g) => g.businessId)
  const topBiz = topIds.length
    ? await prisma.business.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, slug: true },
      })
    : []
  const topBizMap = new Map(topBiz.map((b) => [b.id, b]))
  const top5ByBookings = grouped
    .map((g) => {
      const biz = topBizMap.get(g.businessId)
      if (!biz) return null
      return {
        id: biz.id,
        name: biz.name,
        slug: biz.slug,
        bookingsThisMonth: g._count._all,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const recentBusinesses = recentBusinessesRaw.map((b) => ({
    id: b.id,
    name: b.name,
    planName: b.subscription?.plan.nameEn ?? null,
    status: b.subscription?.status ?? null,
    createdAt: b.createdAt.toISOString(),
  }))

  const recentAgentLogs = recentAgentLogsRaw.map((l) => ({
    id: l.id,
    agentType: l.agentType,
    status: l.status,
    businessName: l.business.name,
    createdAt: l.createdAt.toISOString(),
  }))

  return {
    mrr,
    arr: mrr * 12,
    mrrLastMonth,
    mrrGrowthPct,
    totalBusinesses,
    activeBusinesses,
    trialingBusinesses,
    inactiveBusinesses,
    bizGrowthPct,
    totalBookings,
    bookingsThisMonth,
    totalCustomers,
    agentRuns,
    transactionsThisMonth: txThisMonthAgg._count,
    // Platform fee on NXBook Pay volume (2.5% flat).
    nxbookPayFees: Math.round((nxbookPayAgg._sum.amount ?? 0) * 0.025 * 100) / 100,
    paymentBusinesses,
    top5ByBookings,
    planDistribution,
    mrrSeries,
    bizGrowthSeries,
    recentBusinesses,
    recentAgentLogs,
  }
}
