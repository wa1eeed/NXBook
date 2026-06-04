"use client"

// ============================================================
// Notification Bell — shown in the dashboard header.
// Fetches unread count on mount (+ every 30s polling).
// Opens an animated dropdown with recent notifications.
// Mark-all-read and mark-individual-read actions.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "motion/react"
import {
  Bell,
  X,
  Check,
  CalendarDays,
  CalendarX,
  UserX,
  Clock,
  CreditCard,
  Bot,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  metadata: Record<string, string> | null
}

// ─── Type icon map ────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
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
  if (type === "BOOKING_CANCELLED") return "bg-muted text-muted-foreground"
  if (type === "NO_SHOW") return "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
  if (type === "WAITLIST_OFFER") return "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300"
  if (type === "PAYMENT_RECEIVED") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
  if (type === "AGENT_RUN") return "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
  return "bg-muted text-muted-foreground"
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── Component ───────────────────────────────────────────────

export function NotificationBell() {
  const t = useTranslations("notifications")
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch notifications from the API
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {
      // ignore
    }
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  async function markAllRead() {
    setLoading(true)
    try {
      await fetch("/api/notifications/mark-read", { method: "POST" })
      setUnread(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    setOpen((v) => !v)
    if (!open) fetchNotifications()
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={t("bellLabel")}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg transition-colors",
          open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Bell className="size-4.5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="absolute end-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_rgb(0_0_0/0.15)] dark:shadow-[0_8px_32px_rgb(0_0_0/0.4)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="font-semibold">{t("title")}</p>
                {unread > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("unreadCount", { n: unread })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={loading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {t("markAllRead")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Bell className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("empty")}</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/30",
                      !n.isRead && "bg-primary/5",
                    )}
                  >
                    {/* Icon */}
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", typeBg(n.type))}>
                      <NotifIcon type={n.type} />
                    </span>
                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-tight", !n.isRead && "font-semibold")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">{relTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/20 p-2">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {t("viewAll")}
                <ChevronRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
