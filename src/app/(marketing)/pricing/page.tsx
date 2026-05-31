import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { PricingCards, type PlanView } from "./pricing-cards"

// Marketing pricing page — reads the seeded plans and offers checkout.
export default async function PricingPage() {
  const t = await getTranslations("pricing")
  const session = await auth()

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
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <LocaleSwitcher />
      </header>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>
      <PricingCards plans={views} isAuthed={!!session?.user?.id} />
    </main>
  )
}
