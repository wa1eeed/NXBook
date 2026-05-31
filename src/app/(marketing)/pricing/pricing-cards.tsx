"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { PlanTier } from "@prisma/client"
import { startCheckout } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

  function subscribe(tier: PlanTier) {
    setError("")
    if (!isAuthed) {
      router.push("/register")
      return
    }
    startTransition(async () => {
      const res = await startCheckout(tier)
      if (res.ok) {
        window.location.href = res.url
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.tier}
            className={cn(
              p.tier === "GROWTH" && "border-primary shadow-md",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{locale === "ar" ? p.nameAr : p.nameEn}</span>
                {p.tier === "GROWTH" && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {t("popular")}
                  </span>
                )}
              </CardTitle>
              <p className="mt-2">
                <span className="text-3xl font-bold">{p.priceMonthly}</span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  {t("perMonth")}
                </span>
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => subscribe(p.tier)}
                disabled={pending}
                variant={p.tier === "GROWTH" ? "default" : "outline"}
                className="w-full"
              >
                {isAuthed ? t("subscribe") : t("getStarted")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && (
        <p className="text-center text-sm text-destructive">
          {t(`error.${error}`)}
        </p>
      )}
    </div>
  )
}
