"use client"

// Animated KPI cards for the 360° overview. The counter pattern mirrors
// dashboard/home-client.tsx (requestAnimationFrame + useReducedMotion).
import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import { ArrowDown, ArrowUp, Banknote, Building2, CalendarDays, CreditCard, Receipt, TrendingUp, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    if (value === 0) {
      setDisplay(0)
      return
    }
    const duration = 700
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduce])

  return <span>{display.toLocaleString()}</span>
}

const ICON_MAP = {
  mrr: Banknote,
  arr: TrendingUp,
  activeBusinesses: Building2,
  bookingsThisMonth: CalendarDays,
  totalTransactions: Receipt,
  nxbookFees: Wallet,
  paymentBusinesses: CreditCard,
} as const

export interface AdminKpi {
  key: keyof typeof ICON_MAP
  value: number
  suffix?: string
  growthPct?: number | null
}

export function AdminKpiCards({ cards }: { cards: AdminKpi[] }) {
  const t = useTranslations("admin.overview")

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = ICON_MAP[c.key]
        const g = c.growthPct
        const showG = typeof g === "number" && Math.abs(g) >= 0.5
        const up = (g ?? 0) > 0
        return (
          <Card key={c.key} className="transition-shadow hover:shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(c.key)}
              </CardTitle>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                <AnimatedNumber value={c.value} />
                {c.suffix && (
                  <span className="ms-1 text-base font-normal text-muted-foreground">
                    {c.suffix}
                  </span>
                )}
              </p>
              {showG && (
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs font-medium",
                    up
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {up ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )}
                  {Math.abs(Math.round(g ?? 0))}% {t("vsLastMonth")}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
