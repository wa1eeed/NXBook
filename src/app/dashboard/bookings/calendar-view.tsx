"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  UserCheck,
  UserX,
  Clock,
  Users,
} from "lucide-react"
import { type BookingRow } from "./bookings-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatTime12 } from "@/lib/time"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarViewProps {
  bookings: BookingRow[]
  waitlistByDay: Record<string, number>
  onBookingAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  pending: boolean
}

type BookingStatus = "PENDING" | "CONFIRMED" | "ATTENDED" | "NO_SHOW" | "CANCELLED"

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-500",
  ATTENDED: "bg-emerald-500",
  NO_SHOW: "bg-red-500",
  CANCELLED: "bg-muted-foreground/40",
}

const STATUS_PILL: Record<string, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CONFIRMED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NO_SHOW:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED:
    "bg-muted text-muted-foreground",
}

const STATUS_LABEL_KEY: Record<string, string> = {
  PENDING: "filterPending",
  CONFIRMED: "filterConfirmed",
  ATTENDED: "filterAttended",
  NO_SHOW: "filterNoShow",
  CANCELLED: "filterCancelled",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns an array of 7 short weekday names starting from Sunday. */
function buildWeekHeaders(locale: string): string[] {
  const base = new Date(2023, 0, 1) // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      weekday: "short",
    }).format(d)
  })
}

/** Returns an array of calendar weeks for the given month. Each week = 7 Date|null entries. */
function buildCalendarMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0 = Sunday

  const days: (Date | null)[] = []

  // Leading empty cells
  for (let i = 0; i < startOffset; i++) days.push(null)

  // Fill days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Trailing empty cells to complete the last row
  while (days.length % 7 !== 0) days.push(null)

  // Chunk into weeks
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

/** Build a map: isoDate → BookingRow[] */
function groupByDate(bookings: BookingRow[]): Record<string, BookingRow[]> {
  const map: Record<string, BookingRow[]> = {}
  for (const b of bookings) {
    if (!map[b.date]) map[b.date] = []
    map[b.date].push(b)
  }
  return map
}

/** Count bookings per status for a given day */
function countByStatus(rows: BookingRow[]): Partial<Record<BookingStatus, number>> {
  const counts: Partial<Record<BookingStatus, number>> = {}
  for (const b of rows) {
    const s = b.status as BookingStatus
    counts[s] = (counts[s] ?? 0) + 1
  }
  return counts
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  date: Date | null
  bookings: BookingRow[]
  waitlist: number
  isToday: boolean
  isSelected: boolean
  onClick: () => void
  reduce: boolean
}

function DayCell({
  date,
  bookings,
  waitlist,
  isToday,
  isSelected,
  onClick,
  reduce,
}: DayCellProps) {
  const hasBookings = bookings.length > 0
  const counts = countByStatus(bookings)

  if (!date) {
    return (
      <div className="aspect-square min-h-[72px] rounded-lg bg-muted/20 lg:min-h-[88px]" />
    )
  }

  const statusOrder: BookingStatus[] = [
    "PENDING",
    "CONFIRMED",
    "ATTENDED",
    "NO_SHOW",
    "CANCELLED",
  ]
  const activeDots = statusOrder.filter((s) => (counts[s] ?? 0) > 0)

  return (
    <motion.button
      type="button"
      onClick={hasBookings ? onClick : undefined}
      whileHover={!reduce && hasBookings ? { scale: 1.04 } : undefined}
      whileTap={!reduce && hasBookings ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "relative flex min-h-[72px] flex-col rounded-xl border p-2 text-start transition-shadow lg:min-h-[88px] lg:p-2.5",
        hasBookings
          ? "cursor-pointer hover:shadow-[0_2px_12px_rgb(0_0_0/0.08)] dark:hover:shadow-[0_2px_12px_rgb(0_0_0/0.3)]"
          : "cursor-default",
        isSelected
          ? "border-primary/60 bg-primary/10"
          : isToday
            ? "border-primary/50 bg-primary/5"
            : hasBookings
              ? "border-border bg-card shadow-[0_1px_4px_rgb(0_0_0/0.06)] dark:shadow-[0_1px_4px_rgb(0_0_0/0.2)]"
              : "border-border/50 bg-background",
        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      aria-pressed={isSelected}
      aria-label={`${date.getDate()} — ${bookings.length} bookings`}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-sm font-semibold tabular-nums leading-none",
          isToday ? "text-primary" : "text-foreground",
          !hasBookings && !isToday && "text-muted-foreground",
        )}
      >
        {date.getDate()}
      </span>

      {/* Status dots row */}
      {activeDots.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-0.5 pt-1">
          {activeDots.map((s) => (
            <span
              key={s}
              className={cn(
                "inline-flex items-center rounded-full px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                STATUS_PILL[s],
              )}
            >
              {counts[s]}
            </span>
          ))}
        </div>
      )}

      {/* Waitlist badge */}
      {waitlist > 0 && (
        <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
          {waitlist}
        </span>
      )}
    </motion.button>
  )
}

// ─── Booking Card (in detail panel) ──────────────────────────────────────────

interface BookingCardProps {
  booking: BookingRow
  onAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  pending: boolean
  locale: string
}

function BookingCard({ booking: b, onAction, pending, locale }: BookingCardProps) {
  const t = useTranslations("bookings")
  const isActive = b.status === "PENDING" || b.status === "CONFIRMED"

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-3 backdrop-blur-sm",
        "transition-shadow hover:shadow-[0_2px_8px_rgb(0_0_0/0.08)] dark:hover:shadow-[0_2px_8px_rgb(0_0_0/0.25)]",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm leading-tight">{b.customerName}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                STATUS_PILL[b.status],
              )}
            >
              {t(STATUS_LABEL_KEY[b.status] ?? "filterPending")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {b.serviceName}
            {b.staffName ? ` · ${b.staffName}` : ""}
          </p>
        </div>
        {/* Time */}
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3 shrink-0" />
          <span className="tabular-nums">
            {formatTime12(b.startTime, locale)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {isActive && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {b.status === "PENDING" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAction(b.id, "confirm")}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60"
            >
              <Check className="size-3" />
              {t("confirm")}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction(b.id, "attend")}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
          >
            <UserCheck className="size-3" />
            {t("markAttended")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction(b.id, "noShow")}
            className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60"
          >
            <UserX className="size-3" />
            {t("markNoShow")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction(b.id, "cancel")}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3" />
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  date: string
  bookings: BookingRow[]
  waitlist: number
  locale: string
  onAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  onClose: () => void
  pending: boolean
  offscreen: string
  reduce: boolean
}

function DetailPanel({
  date,
  bookings,
  waitlist,
  locale,
  onAction,
  onClose,
  pending,
  offscreen,
  reduce,
}: DetailPanelProps) {
  const t = useTranslations("bookings")

  const formatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date + "T00:00:00"))

  const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <motion.div
        className={cn(
          "fixed inset-y-0 end-0 z-50 flex w-full max-w-sm flex-col border-s border-border",
          "bg-background/95 shadow-2xl backdrop-blur-md",
        )}
        initial={reduce ? false : { x: offscreen, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={reduce ? undefined : { x: offscreen, opacity: 0 }}
        transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={formatted}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3.5">
          <div>
            <p className="font-semibold text-sm leading-tight">{formatted}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("resultsCount", { n: bookings.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("cancel")}
            className="shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Status summary strip */}
        {bookings.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-border/60 bg-muted/30 px-4 py-2.5 scrollbar-none">
            {(
              ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW"] as BookingStatus[]
            ).map((s) => {
              const count = bookings.filter((b) => b.status === s).length
              if (!count) return null
              return (
                <span
                  key={s}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    STATUS_PILL[s],
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])}
                  />
                  {count}
                </span>
              )
            })}
            {waitlist > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                <Users className="size-3" />
                {waitlist}
              </span>
            )}
          </div>
        )}

        {/* Booking cards with stagger */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Clock className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <motion.div
              className="flex flex-col gap-2 p-3"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.055 } },
              }}
            >
              {sorted.map((b) => (
                <motion.div
                  key={b.id}
                  variants={{
                    hidden: { opacity: 0, y: 10, scale: 0.97 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.22, ease: "easeOut" },
                    },
                  }}
                >
                  <BookingCard
                    booking={b}
                    onAction={onAction}
                    pending={pending}
                    locale={locale}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Waitlist footer */}
        {waitlist > 0 && (
          <div className="border-t border-border bg-orange-50/60 px-4 py-3 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
              <Users className="size-4 shrink-0" />
              <span>
                <span className="font-semibold">{waitlist}</span> on waitlist today
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ─── Week Strip (mobile fallback) ─────────────────────────────────────────────

interface WeekStripProps {
  weekDays: (Date | null)[]
  byDate: Record<string, BookingRow[]>
  waitlistByDay: Record<string, number>
  selectedDay: string | null
  today: string
  onSelect: (iso: string) => void
}

function WeekStrip({
  weekDays,
  byDate,
  waitlistByDay,
  selectedDay,
  today,
  onSelect,
}: WeekStripProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {weekDays.map((d, i) => {
        if (!d) return <div key={i} className="w-10 shrink-0" />
        const iso = d.toISOString().slice(0, 10)
        const rows = byDate[iso] ?? []
        const isToday = iso === today
        const isSelected = iso === selectedDay
        const hasBookings = rows.length > 0
        return (
          <button
            key={iso}
            type="button"
            onClick={() => hasBookings && onSelect(iso)}
            className={cn(
              "flex w-10 shrink-0 flex-col items-center gap-1 rounded-xl py-2 transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                  ? "bg-primary/10 text-primary"
                  : hasBookings
                    ? "bg-muted/60 text-foreground hover:bg-muted"
                    : "text-muted-foreground",
              isToday && !isSelected && "ring-2 ring-primary ring-offset-1",
            )}
          >
            <span className="text-[10px] font-medium uppercase leading-none opacity-70">
              {new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(d)}
            </span>
            <span className="text-sm font-bold tabular-nums leading-none">
              {d.getDate()}
            </span>
            {hasBookings && (
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  isSelected ? "bg-primary-foreground/70" : "bg-primary/60",
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Calendar Component ───────────────────────────────────────────────────

export function CalendarView({
  bookings,
  waitlistByDay,
  onBookingAction,
  pending,
}: CalendarViewProps) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const reduce = useReducedMotion()

  const today = useMemo(() => todayIso(), [])
  const isRTL = locale === "ar"
  const offscreen = isRTL ? "-100%" : "100%"

  // ── Calendar nav state ────────────────────────────────────────────────────
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed

  // ── Detail panel state ────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // ── Derived data ──────────────────────────────────────────────────────────
  const byDate = useMemo(() => groupByDate(bookings), [bookings])
  const weekHeaders = useMemo(() => buildWeekHeaders(locale), [locale])
  const calendarMatrix = useMemo(
    () => buildCalendarMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  // Month label
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date(viewYear, viewMonth, 1)),
    [viewYear, viewMonth, locale],
  )

  // Current week for the mobile strip (the week containing today or selected)
  const focusDate = selectedDay ? new Date(selectedDay + "T00:00:00") : now
  const weekOfFocus = useMemo(() => {
    const sunday = new Date(focusDate)
    sunday.setDate(focusDate.getDate() - focusDate.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      return d
    })
  }, [focusDate])

  // ── Navigation ────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
    setSelectedDay(null)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
    setSelectedDay(null)
  }

  function goToday() {
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedDay(today)
  }

  function selectDay(iso: string) {
    setSelectedDay((prev) => (prev === iso ? null : iso))
  }

  const selectedBookings = selectedDay ? (byDate[selectedDay] ?? []) : []
  const selectedWaitlist = selectedDay ? (waitlistByDay[selectedDay] ?? 0) : 0

  // ── Monthly booking count for the header ──────────────────────────────────
  const monthTotal = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`
    return Object.entries(byDate)
      .filter(([d]) => d.startsWith(prefix))
      .reduce((sum, [, rows]) => sum + rows.length, 0)
  }, [byDate, viewYear, viewMonth])

  return (
    <div className="relative">
      {/* ─── DESKTOP CALENDAR ─── (hidden on sm, shown on md+) */}
      <div className="hidden md:block">
        <Card className="overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">{monthLabel}</h2>
              {monthTotal > 0 && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {t("resultsCount", { n: monthTotal })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToday}
                className="h-8 px-3 text-xs"
              >
                {t("dateToday")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={prevMonth}
                className="h-8 w-8"
                aria-label="Previous month"
              >
                {isRTL ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8"
                aria-label="Next month"
              >
                {isRTL ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <CardContent className="p-4">
            {/* Weekday headers */}
            <div className="mb-2 grid grid-cols-7 gap-1.5">
              {weekHeaders.map((name, i) => (
                <div
                  key={i}
                  className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Grid rows — animate in on month change */}
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-col gap-1.5"
            >
              {calendarMatrix.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5">
                  {week.map((day, di) => {
                    const iso = day
                      ? isoDate(day.getFullYear(), day.getMonth(), day.getDate())
                      : null
                    return (
                      <DayCell
                        key={iso ?? `empty-${wi}-${di}`}
                        date={day}
                        bookings={iso ? (byDate[iso] ?? []) : []}
                        waitlist={iso ? (waitlistByDay[iso] ?? 0) : 0}
                        isToday={iso === today}
                        isSelected={iso === selectedDay}
                        onClick={() => iso && selectDay(iso)}
                        reduce={!!reduce}
                      />
                    )
                  })}
                </div>
              ))}
            </motion.div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 border-t border-border/60 pt-3">
              {(
                [
                  ["PENDING", "Pending"],
                  ["CONFIRMED", "Confirmed"],
                  ["ATTENDED", "Attended"],
                  ["NO_SHOW", "No-show"],
                ] as [BookingStatus, string][]
              ).map(([s, label]) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                  {label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                Waitlist
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── MOBILE CALENDAR ─── (shown on sm, hidden on md+) */}
      <div className="md:hidden">
        <Card>
          {/* Mobile header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
            <h2 className="text-sm font-semibold">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToday}
                className="h-7 px-2 text-xs"
              >
                {t("dateToday")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={prevMonth}
                className="h-7 w-7"
                aria-label="Previous month"
              >
                {isRTL ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronLeft className="size-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-7 w-7"
                aria-label="Next month"
              >
                {isRTL ? (
                  <ChevronLeft className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          <CardContent className="p-3">
            <WeekStrip
              weekDays={weekOfFocus}
              byDate={byDate}
              waitlistByDay={waitlistByDay}
              selectedDay={selectedDay}
              today={today}
              onSelect={selectDay}
            />

            {/* Selected day bookings — compact list for mobile */}
            {selectedDay && selectedBookings.length > 0 && (
              <motion.div
                key={selectedDay}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3"
              >
                {[...selectedBookings]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onAction={onBookingAction}
                      pending={pending}
                      locale={locale}
                    />
                  ))}
                {selectedWaitlist > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2.5 text-xs text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                    <Users className="size-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{selectedWaitlist}</span> on waitlist
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {selectedDay && selectedBookings.length === 0 && (
              <p className="mt-3 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
                {t("empty")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Detail panel slide-over (desktop only) ─── */}
      <AnimatePresence>
        {selectedDay && selectedBookings.length > 0 && (
          <div className="hidden md:block">
            <DetailPanel
              date={selectedDay}
              bookings={selectedBookings}
              waitlist={selectedWaitlist}
              locale={locale}
              onAction={onBookingAction}
              onClose={() => setSelectedDay(null)}
              pending={pending}
              offscreen={offscreen}
              reduce={!!reduce}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
