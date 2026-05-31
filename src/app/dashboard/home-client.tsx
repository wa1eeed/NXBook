"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import { ArrowDown, ArrowUp, CalendarDays, ListChecks, Scissors, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function AnimatedCounter({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) { setDisplay(value); return }
    if (value === 0) { setDisplay(0); return }
    const duration = 600
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

  return <span>{display}</span>
}

// Icon map — resolved client-side so no React components cross the RSC boundary.
const ICON_MAP = {
  todayBookings: CalendarDays,
  activeServices: Scissors,
  totalCustomers: Users,
  waitlistActive: ListChecks,
} as const

export interface KpiCard {
  key: keyof typeof ICON_MAP
  value: number
  trend?: number | null
}

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  const td = useTranslations("dashboard")

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = ICON_MAP[c.key]
        const trend = c.trend
        const showTrend = typeof trend === "number" && trend !== 0
        const up = (trend ?? 0) > 0
        return (
          <Card key={c.key} className="transition-shadow hover:shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {td(`kpi.${c.key}`)}
              </CardTitle>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                <AnimatedCounter value={c.value} />
              </p>
              {showTrend && (
                <p className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-medium",
                  up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                )}>
                  {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {Math.abs(trend ?? 0)} {td("vsYesterday")}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
