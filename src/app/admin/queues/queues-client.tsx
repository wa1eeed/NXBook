"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { RefreshCw, Trash2 } from "lucide-react"
import {
  getQueueStats,
  flushQueueAction,
  type QueueStat,
  type QueueKey,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COLS = ["waiting", "active", "delayed", "completed", "failed"] as const

export function QueuesClient({ initial }: { initial: QueueStat[] }) {
  const t = useTranslations("admin.queues")
  const [stats, setStats] = useState<QueueStat[]>(initial)
  const [, startTransition] = useTransition()
  const [flushing, setFlushing] = useState<QueueKey | null>(null)
  const [flushed, setFlushed] = useState<QueueKey | null>(null)

  const refresh = useCallback(() => {
    void getQueueStats().then(setStats)
  }, [])

  // Auto-refresh every 30s while the page is mounted.
  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  function flush(name: QueueKey) {
    if (!window.confirm(t("flushConfirm"))) return
    setFlushing(name)
    setFlushed(null)
    startTransition(async () => {
      const res = await flushQueueAction(name)
      setFlushing(null)
      if (res.ok) {
        setFlushed(name)
        refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t("autoRefresh")}</span>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {stats.map((s) => (
          <Card key={s.name}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base capitalize">{s.name}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={flushing === s.name}
                onClick={() => flush(s.name)}
                className="text-destructive"
              >
                <Trash2 className="size-4" /> {t("flush")}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                {COLS.map((c) => (
                  <div key={c}>
                    <p className="text-xl font-bold tabular-nums">
                      {s.counts[c] ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t(c)}</p>
                  </div>
                ))}
              </div>

              {flushed === s.name && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t("flushed")}
                </p>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("failedJobs")}
                </p>
                {s.failed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noFailed")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {s.failed.map((j) => (
                      <li
                        key={j.id}
                        className="rounded-md bg-muted/40 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{j.name || j.id}</span>
                        {j.failedReason && (
                          <span className="ms-1 text-muted-foreground">
                            — {j.failedReason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
