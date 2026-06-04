"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { motion } from "motion/react"
import {
  Bell, CalendarDays, CalendarX, UserX, Clock,
  CreditCard, Bot, Check, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  metadata: Record<string, string> | null
}

const TYPE_FILTERS = [
  "ALL",
  "BOOKING_NEW",
  "BOOKING_CANCELLED",
  "NO_SHOW",
  "WAITLIST_OFFER",
  "PAYMENT_RECEIVED",
  "AGENT_RUN",
] as const

function typeIcon(type: string) {
  const cls = "size-4"
  if (type === "BOOKING_NEW") return <CalendarDays className={cls} />
  if (type === "BOOKING_CONFIRMED") return <Check className={cls} />
  if (type === "BOOKING_CANCELLED") return <CalendarX className={cls} />
  if (type === "NO_SHOW") return <UserX className={cls} />
  if (type === "WAITLIST_OFFER") return <Clock className={cls} />
  if (type === "PAYMENT_RECEIVED") return <CreditCard className={cls} />
  if (type === "AGENT_RUN") return <Bot className={cls} />
  return <Bell className={cls} />
}

function typeBg(type: string): string {
  if (type === "BOOKING_NEW") return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
  if (type === "BOOKING_CONFIRMED") return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
  if (type === "NO_SHOW") return "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
  if (type === "WAITLIST_OFFER") return "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300"
  if (type === "PAYMENT_RECEIVED") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
  if (type === "AGENT_RUN") return "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
  return "bg-muted text-muted-foreground"
}

function relTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function NotificationsClient({
  notifications,
  page,
  hasMore,
}: {
  notifications: Notification[]
  page: number
  hasMore: boolean
}) {
  const t = useTranslations("notifications")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications.filter((n) => {
      if (typeFilter !== "ALL" && n.type !== typeFilter) return false
      if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false
      return true
    })
  }, [notifications, typeFilter, query])

  async function markAll() {
    startTransition(async () => {
      await fetch("/api/notifications/mark-read", { method: "POST" })
      toast.success(t("markedAllRead"))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {type === "ALL" ? t("filterAll") : type.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-9 ps-8 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={markAll} disabled={pending}>
            {t("markAllRead")}
          </Button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border overflow-hidden">
          {filtered.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn(
                "flex items-start gap-4 px-5 py-4 transition-colors",
                !n.isRead && "bg-primary/5",
              )}
            >
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", typeBg(n.type))}>
                {typeIcon(n.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm", !n.isRead && "font-semibold")}>{n.title}</p>
                  {!n.isRead && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">{relTime(n.createdAt)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => router.push(`?page=${page - 1}`)}
        >
          {t("prev")}
        </Button>
        <span className="text-sm text-muted-foreground">{t("page", { n: page })}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => router.push(`?page=${page + 1}`)}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  )
}
