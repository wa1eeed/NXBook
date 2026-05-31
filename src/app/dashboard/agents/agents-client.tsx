"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Bot,
  Play,
  Check,
  Users,
  MessageCircle,
  RotateCcw,
  BarChart3,
  type LucideIcon,
} from "lucide-react"
import type { AgentType } from "@prisma/client"
import { toggleAgent, runAgentNow } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { MotionList, MotionItem } from "@/components/ui/motion-list"
import { cn } from "@/lib/utils"

export interface CatalogItem {
  type: AgentType
  nameEn: string
  nameAr: string
  descriptionEn: string
  descriptionAr: string
  minPlan: string
  enabled: boolean
  totalRuns: number
  lastRunAt: string | null
}

export interface LogRow {
  id: string
  agentType: string
  status: string
  response: string | null
  error: string | null
  createdAt: string
}

// Agents that make sense to trigger manually from the dashboard.
const RUNNABLE: AgentType[] = ["ANALYTICS", "RECOVERY"]

const AGENT_ICON: Partial<Record<AgentType, LucideIcon>> = {
  WAITLIST: Users,
  FOLLOWUP: MessageCircle,
  RECOVERY: RotateCcw,
  ANALYTICS: BarChart3,
}

export function AgentsClient({
  catalog,
  logs,
  balance,
}: {
  catalog: CatalogItem[]
  logs: LogRow[]
  balance: number
}) {
  const t = useTranslations("agents")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [ranType, setRanType] = useState<string | null>(null)

  const lastLogByType = new Map<string, LogRow>()
  for (const l of logs) {
    if (!lastLogByType.has(l.agentType)) lastLogByType.set(l.agentType, l)
  }

  function toggle(type: AgentType, enabled: boolean) {
    setError("")
    startTransition(async () => {
      const res = await toggleAgent(type, enabled)
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  function runNow(type: AgentType) {
    setError("")
    setRanType(null)
    startTransition(async () => {
      const res = await runAgentNow(type)
      if (res.ok) {
        setRanType(type)
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="rounded-lg border border-border px-4 py-2 text-sm">
          <span className="text-muted-foreground">{t("creditBalance")}: </span>
          <span className="font-semibold">{balance.toFixed(2)} SAR</span>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}

      <MotionList className="grid gap-4 md:grid-cols-2">
        {catalog.map((a) => {
          const Icon = AGENT_ICON[a.type] ?? Bot
          const lastLog = lastLogByType.get(a.type)
          const lastResult = lastLog?.response ?? lastLog?.error ?? null
          return (
          <MotionItem key={a.type}>
          <Card className="h-full transition-shadow hover:shadow-soft">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {locale === "ar" ? a.nameAr : a.nameEn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("minPlan")}: {a.minPlan}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.enabled}
                  disabled={pending}
                  onClick={() => toggle(a.type, !a.enabled)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    a.enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                      a.enabled ? "start-[22px]" : "start-0.5",
                    )}
                  />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? a.descriptionAr : a.descriptionEn}
              </p>

              {lastResult && (
                <p className="truncate rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("recentRuns")}:
                  </span>{" "}
                  {lastResult}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("totalRuns", { n: a.totalRuns })}</span>
                {a.enabled && RUNNABLE.includes(a.type) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => runNow(a.type)}
                  >
                    {ranType === a.type ? (
                      <Check className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {t("runNow")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          </MotionItem>
          )
        })}
      </MotionList>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("recentRuns")}</h2>
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
        )}
        {logs.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{l.agentType}</p>
              <p className="truncate text-muted-foreground">
                {l.response ?? l.error ?? "—"}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs",
                l.status === "COMPLETED"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
              )}
            >
              {l.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
