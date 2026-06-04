import { getTranslations } from "next-intl/server"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { PricingCards, type PlanView } from "./pricing-cards"

// Marketing pricing page — reads the seeded plans and offers checkout.
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const t = await getTranslations("pricing")
  const session = await auth()
  const { reason } = await searchParams

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: "asc" },
  })

  const views: PlanView[] = plans.map((p) => ({
    tier: p.tier,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    includesAIAgents: p.includesAIAgents,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  }))

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <LocaleSwitcher />
      </header>

      {/* Trial-expired / suspended banner */}
      {(reason === "trial_expired" || reason === "suspended") && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {reason === "trial_expired" ? t("trialExpiredTitle") : t("suspendedTitle")}
            </p>
            <p className="mt-0.5 text-sm">
              {reason === "trial_expired" ? t("trialExpiredBody") : t("suspendedBody")}
            </p>
          </div>
        </div>
      )}

      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>
      <PricingCards plans={views} isAuthed={!!session?.user?.id} />
    </main>
  )
}
