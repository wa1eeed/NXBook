import { getLocale } from "next-intl/server"
import { requireSuperAdmin } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { Locale } from "@/i18n/config"
import { PlansClient, type PlanRow, type TrialPolicy } from "./plans-client"

// Plans & pricing — editable plan economics + the global trial policy.
// Cross-tenant config behind the super-admin guard (CLAUDE.md §5).
export default async function AdminPlans() {
  await requireSuperAdmin()
  const locale = (await getLocale()) as Locale

  const [plans, config] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.platformConfig.findFirst(),
  ])

  const rows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    name: locale === "ar" ? p.nameAr : p.nameEn,
    tier: p.tier,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    trialDays: p.trialDays,
    isTrialUpgradeForced: p.isTrialUpgradeForced,
    maxStaff: p.maxStaff,
    maxServices: p.maxServices,
    maxAgents: p.maxAgents,
    subscribers: p._count.subscriptions,
  }))

  const raw = (config?.trialPolicy ?? null) as Partial<TrialPolicy> | null
  const trialPolicy: TrialPolicy = {
    enabled: raw?.enabled ?? false,
    defaultDays: raw?.defaultDays ?? 14,
    upgradeForced: raw?.upgradeForced ?? false,
  }

  return <PlansClient plans={rows} trialPolicy={trialPolicy} />
}
