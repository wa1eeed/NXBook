"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "motion/react"
import { Check, Sparkles, Loader2 } from "lucide-react"
import type { PlanTier } from "@prisma/client"
import { startCheckout } from "./actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PlanView {
  tier: PlanTier
  nameEn: string
  nameAr: string
  priceMonthly: number
  priceYearly: number
  features: string[]
  includesAIAgents: boolean
}

type Cycle = "monthly" | "yearly"

export function PricingCards({
  plans,
  isAuthed,
}: {
  plans: PlanView[]
  isAuthed: boolean
}) {
  const t = useTranslations("pricing")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null)
  const [cycle, setCycle] = useState<Cycle>("monthly")

  function subscribe(tier: PlanTier) {
    setError("")
    if (!isAuthed) {
      router.push("/register")
      return
    }
    setBusyTier(tier)
    startTransition(async () => {
      const res = await startCheckout(tier)
      if (res.ok) {
        window.location.href = res.url
      } else {
        setError(res.error)
        setBusyTier(null)
      }
    })
  }

  // Compute yearly savings % for the toggle label (use GROWTH as reference).
  const ref = plans.find((p) => p.tier === "GROWTH") ?? plans[0]
  const yearlySavingsPct =
    ref && ref.priceMonthly > 0 && ref.priceYearly > 0
      ? Math.round((1 - ref.priceYearly / (ref.priceMonthly * 12)) * 100)
      : 0

  return (
    <div className="flex flex-col gap-8">
      {/* Billing-cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            cycle === "monthly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("monthly")}
        </button>
        <button
          type="button"
          onClick={() => setCycle("yearly")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            cycle === "yearly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("yearly")}
          {yearlySavingsPct > 0 && (
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              cycle === "yearly" ? "bg-primary-foreground/20" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
            )}>
              {t("savePercent", { n: yearlySavingsPct })}
            </span>
          )}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p, idx) => {
          const isPopular = p.tier === "GROWTH"
          const price = cycle === "monthly" ? p.priceMonthly : Math.round(p.priceYearly / 12)
          const total = cycle === "yearly" ? p.priceYearly : null
          return (
            <motion.div
              key={p.tier}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow",
                isPopular
                  ? "border-primary shadow-[0_8px_32px_rgb(0_0_0/0.12)] dark:shadow-[0_8px_32px_rgb(0_0_0/0.4)] md:-translate-y-2"
                  : "border-border hover:shadow-soft",
              )}
            >
              {isPopular && (
                <span className="absolute -top-3 start-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground rtl:translate-x-1/2">
                  <Sparkles className="size-3" />
                  {t("popular")}
                </span>
              )}

              <h3 className="text-lg font-bold">{locale === "ar" ? p.nameAr : p.nameEn}</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tabular-nums">{price}</span>
                <span className="text-sm text-muted-foreground">SAR {t("perMonth")}</span>
              </div>
              {total != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("billedYearly", { total })}
                </p>
              )}

              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => subscribe(p.tier)}
                disabled={pending}
                variant={isPopular ? "default" : "outline"}
                className="mt-6 w-full"
                size="lg"
              >
                {busyTier === p.tier && <Loader2 className="size-4 animate-spin" />}
                {isAuthed ? t("subscribe") : t("getStarted")}
              </Button>
            </motion.div>
          )
        })}
      </div>
      {error && (
        <p className="text-center text-sm text-destructive">
          {t(`error.${error}`)}
        </p>
      )}
    </div>
  )
}
