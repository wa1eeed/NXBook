"use client"

// ============================================================
// Calendar View — monthly / weekly / daily booking calendar.
// Shows customer names (first 2 + overflow), status pills,
// waitlist badges. Includes filter toolbar: service / staff /
// customer name search. Detail panel slides in from the end
// side (RTL-aware) when a day is clicked.
// ============================================================

import Link from "next/link"
import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  UserCheck,
  UserX,
  X,
  Clock,
  Users,
  Search,
  CalendarDays,
  CalendarRange,
  Calendar,
  Plus,
} from "lucide-react"
import { type BookingRow } from "./bookings-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatTime12 } from "@/lib/time"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────

export interface CalendarOption { id: string; name: string }

export interface CalendarViewProps {
  bookings: BookingRow[]
  waitlistByDay: Record<string, number>
  services: CalendarOption[]
  staff: CalendarOption[]
  onBookingAction: (
    id: string,
    action: "confirm" | "attend" | "cancel" | "noShow",
  ) => void
  pending: boolean
}

type CalMode = "month" | "week" | "day"
type BookingStatus = "PENDING" | "CONFIRMED" | "ATTENDED" | "NO_SHOW" | "CANCELLED"

// ─── Constants ───────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-500",
  ATTENDED: "bg-emerald-500",
  NO_SHOW: "bg-red-500",
  CANCELLED: "bg-muted-foreground/30",
}

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_LABEL_KEY: Record<string, string> = {
  PENDING: "filterPending",
  CONFIRMED: "filterConfirmed",
  ATTENDED: "filterAttended",
  NO_SHOW: "filterNoShow",
  CANCELLED: "filterCancelled",
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ─── Helpers ─────────────────────────────────────────────────

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function todayIso(): string { return new Date().toISOString().slice(0, 10) }

function weekStart(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const offset = first.getDay()
  const cells: (Date | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function weekDays(anchor: Date): Date[] {
  const s = weekStart(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

function groupByDate(rows: BookingRow[]): Record<string, BookingRow[]> {
  const m: Record<string, BookingRow[]> = {}
  for (const b of rows) { (m[b.date] ??= []).push(b) }
  return m
}

function shortWeekNames(locale: string): string[] {
  const base = new Date(2023, 0, 1) // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(base, i)
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { weekday: "short" }).format(d)
  })
}

function formatMonthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    month: "long", year: "numeric",
  }).format(new Date(year, month, 1))
}

function formatDayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date)
}

function formatHour(h: number, locale: string): string {
  return formatTime12(`${String(h).padStart(2, "0")}:00`, locale)
}

function bookingStartHour(b: BookingRow): number {
  return Number(b.startTime.split(":")[0] ?? 0)
}

/** First 2 customer names for day cell display */
function customerChips(rows: BookingRow[]): { shown: string[]; overflow: number } {
  // Deduplicate by customer name, preserve order
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const b of rows) {
    if (!seen.has(b.customerName)) { seen.add(b.customerName); uniq.push(b.customerName) }
  }
  const shown = uniq.slice(0, 2)
  const overflow = Math.max(0, uniq.length - 2)
  return { shown, overflow }
}

// ─── Filter toolbar ───────────────────────────────────────────

interface FiltersProps {
  services: CalendarOption[]
  staff: CalendarOption[]
  serviceId: string
  staffId: string
  query: string
  onService: (v: string) => void
  onStaff: (v: string) => void
  onQuery: (v: string) => void
}

function Filters({ services, staff, serviceId, staffId, query, onService, onStaff, onQuery }: FiltersProps) {
  const t = useTranslations("bookings")
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-48 flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-9 ps-8 text-sm"
        />
      </div>
      {/* Service filter */}
      <select
        value={serviceId}
        onChange={(e) => onService(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
      >
        <option value="">{t("filterService")}</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {/* Staff filter */}
      {staff.length > 0 && (
        <select
          value={staffId}
          onChange={(e) => onStaff(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
        >
          <option value="">{t("filterStaff")}</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  )
}

// ─── Day Cell (month view) ────────────────────────────────────

interface DayCellProps {
  date: Date | null
  rows: BookingRow[]
  waitlist: number
  isToday: boolean
  isSelected: boolean
  onClick: () => void
  reduce: boolean
}

function DayCell({ date, rows, waitlist, isToday, isSelected, onClick, reduce }: DayCellProps) {
  if (!date) return <div className="min-h-[80px] rounded-xl bg-muted/10 lg:min-h-[100px]" />

  const hasBookings = rows.length > 0
  const { shown, overflow } = customerChips(rows.filter((b) => b.status !== "CANCELLED"))

  // Count active statuses for dots
  const statusCounts: Partial<Record<BookingStatus, number>> = {}
  for (const b of rows) {
    if (b.status !== "CANCELLED") {
      statusCounts[b.status as BookingStatus] = (statusCounts[b.status as BookingStatus] ?? 0) + 1
    }
  }
  const activeDots = (["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW"] as BookingStatus[])
    .filter((s) => (statusCounts[s] ?? 0) > 0)

  return (
    <motion.button
      type="button"
      onClick={hasBookings ? onClick : undefined}
      whileHover={!reduce && hasBookings ? { scale: 1.02, y: -1 } : undefined}
      whileTap={!reduce && hasBookings ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      aria-pressed={isSelected}
      aria-label={`${date.getDate()}, ${rows.length} bookings`}
      className={cn(
        "relative flex min-h-[80px] flex-col rounded-xl border p-2 text-start transition-all lg:min-h-[100px] lg:p-2.5",
        hasBookings ? "cursor-pointer" : "cursor-default",
        isSelected
          ? "border-primary/60 bg-primary/10 shadow-[0_2px_12px_rgb(0_0_0/0.1)] dark:shadow-[0_2px_12px_rgb(0_0_0/0.3)]"
          : isToday
            ? "border-primary/40 bg-primary/5"
            : hasBookings
              ? "border-border bg-card shadow-[0_1px_4px_rgb(0_0_0/0.06)] dark:shadow-[0_1px_4px_rgb(0_0_0/0.2)]"
              : "border-border/40 bg-background/50",
        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
    >
      {/* Day number */}
      <span className={cn(
        "text-sm font-bold tabular-nums leading-none",
        isToday ? "text-primary" : hasBookings ? "text-foreground" : "text-muted-foreground",
      )}>
        {date.getDate()}
      </span>

      {/* Customer name chips */}
      {shown.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {shown.map((name, i) => {
            const booking = rows.find((b) => b.customerName === name && b.status !== "CANCELLED")
            const bg = booking ? (STATUS_BG[booking.status] ?? "") : ""
            return (
              <span
                key={i}
                className={cn(
                  "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                  bg || "bg-muted text-muted-foreground",
                )}
              >
                {name}
              </span>
            )
          })}
          {overflow > 0 && (
            <span className="text-[9px] font-semibold text-muted-foreground">
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* Status dots (tiny row at bottom) */}
      {activeDots.length > 0 && (
        <div className="mt-auto flex gap-0.5 pt-1">
          {activeDots.map((s) => (
            <span key={s} className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />
          ))}
        </div>
      )}

      {/* Waitlist badge */}
      {waitlist > 0 && (
        <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white leading-none">
          {waitlist}
        </span>
      )}
    </motion.button>
  )
}

// ─── Booking Card (detail panel + week/day views) ────────────

interface BookingCardProps {
  booking: BookingRow
  onAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  pending: boolean
  locale: string
  compact?: boolean
}

function BookingCard({ booking: b, onAction, pending, locale, compact = false }: BookingCardProps) {
  const t = useTranslations("bookings")
  const isActive = b.status === "PENDING" || b.status === "CONFIRMED"

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card/70 backdrop-blur-sm",
      "transition-shadow hover:shadow-[0_2px_8px_rgb(0_0_0/0.08)] dark:hover:shadow-[0_2px_8px_rgb(0_0_0/0.25)]",
      compact ? "p-2.5" : "p-3.5",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("font-semibold leading-tight", compact ? "text-sm" : "text-base")}>
              {b.customerName}
            </span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              STATUS_BG[b.status],
            )}>
              {t(STATUS_LABEL_KEY[b.status] ?? "filterPending")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {b.serviceName}{b.staffName ? ` · ${b.staffName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3 shrink-0" />
          <span className="tabular-nums">{formatTime12(b.startTime, locale)}</span>
        </div>
      </div>

      {isActive && !compact && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {b.status === "PENDING" && (
            <ActionBtn
              color="blue"
              icon={<Check className="size-3" />}
              label={t("confirm")}
              onClick={() => onAction(b.id, "confirm")}
              disabled={pending}
            />
          )}
          <ActionBtn
            color="emerald"
            icon={<UserCheck className="size-3" />}
            label={t("markAttended")}
            onClick={() => onAction(b.id, "attend")}
            disabled={pending}
          />
          <ActionBtn
            color="red"
            icon={<UserX className="size-3" />}
            label={t("markNoShow")}
            onClick={() => onAction(b.id, "noShow")}
            disabled={pending}
          />
          <ActionBtn
            color="muted"
            icon={<X className="size-3" />}
            label={t("cancel")}
            onClick={() => onAction(b.id, "cancel")}
            disabled={pending}
          />
        </div>
      )}
    </div>
  )
}

function ActionBtn({
  color, icon, label, onClick, disabled,
}: {
  color: "blue" | "emerald" | "red" | "muted"
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled: boolean
}) {
  const styles: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60",
    emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60",
    red: "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60",
    muted: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
        styles[color],
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Detail Panel (slide-over for month view) ────────────────

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

function DetailPanel({ date, bookings, waitlist, locale, onAction, onClose, pending, offscreen, reduce }: DetailPanelProps) {
  const t = useTranslations("bookings")
  const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <motion.div
      initial={reduce ? false : { x: offscreen, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: offscreen, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/95 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("calDayDetail", { date: "" })}
          </p>
          <h3 className="mt-0.5 font-bold text-foreground">
            {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
              weekday: "long", day: "numeric", month: "long",
            }).format(new Date(date + "T00:00:00"))}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Status summary strip */}
      <div className="flex border-b border-border/60 bg-muted/20">
        {(["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW"] as BookingStatus[]).map((s) => {
          const count = bookings.filter((b) => b.status === s).length
          if (!count) return null
          return (
            <div key={s} className="flex-1 py-3 text-center">
              <span className={cn(
                "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                STATUS_BG[s],
              )}>
                {count}
              </span>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{t(STATUS_LABEL_KEY[s])}</p>
            </div>
          )
        })}
      </div>

      {/* Booking cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {sorted.map((b, i) => (
          <motion.div
            key={b.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.055 }}
          >
            <BookingCard booking={b} onAction={onAction} pending={pending} locale={locale} />
          </motion.div>
        ))}
      </div>

      {/* Footer: waitlist + add booking */}
      <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
        {waitlist > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
            <Users className="size-3.5 shrink-0" />
            <span><span className="font-bold">{waitlist}</span> {t("calWaitlist", { n: waitlist })}</span>
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full" asChild>
          <Link href={`/dashboard/bookings/new?date=${date}`}>
            <Plus className="size-4" />
            {t("calAddForDay")}
          </Link>
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Week View ───────────────────────────────────────────────

interface WeekViewProps {
  days: Date[]
  byDate: Record<string, BookingRow[]>
  waitlistByDay: Record<string, number>
  today: string
  locale: string
  onAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  pending: boolean
  reduce: boolean
}

function WeekView({ days, byDate, waitlistByDay, today, locale, onAction, pending, reduce }: WeekViewProps) {
  const weekNames = shortWeekNames(locale)

  return (
    <div className="overflow-auto rounded-xl border border-border bg-card">
      {/* Day headers */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="border-e border-border bg-muted/30 p-2" />
        {days.map((d, i) => {
          const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate())
          const isToday = iso === today
          const count = (byDate[iso] ?? []).length
          return (
            <div key={i} className={cn(
              "border-e border-border p-2 text-center last:border-e-0",
              isToday && "bg-primary/5",
            )}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {weekNames[d.getDay()]}
              </p>
              <p className={cn(
                "mt-0.5 text-xl font-bold tabular-nums leading-tight",
                isToday ? "text-primary" : "text-foreground",
              )}>
                {d.getDate()}
              </p>
              {count > 0 && (
                <span className="mt-0.5 inline-block rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {count}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Hour rows (6 AM – 11 PM) */}
      <div className="min-h-[600px]">
        {HOURS.slice(6, 23).map((h) => (
          <div key={h} className="grid border-b border-border/30 last:border-b-0" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            {/* Hour label */}
            <div className="border-e border-border/50 bg-muted/20 py-1 pe-2 text-end">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatHour(h, locale)}
              </span>
            </div>
            {/* Day columns */}
            {days.map((d, di) => {
              const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate())
              const dayBookings = (byDate[iso] ?? []).filter((b) => bookingStartHour(b) === h)
              return (
                <div key={di} className={cn(
                  "min-h-[40px] border-e border-border/30 p-0.5 last:border-e-0",
                  iso === today && "bg-primary/5",
                )}>
                  {dayBookings.map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        "mb-0.5 truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight",
                        STATUS_BG[b.status] ?? "bg-muted text-muted-foreground",
                      )}
                      title={`${b.customerName} · ${b.serviceName} · ${formatTime12(b.startTime, locale)}`}
                    >
                      {b.customerName}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Day View ────────────────────────────────────────────────

interface DayViewProps {
  date: Date
  bookings: BookingRow[]
  waitlist: number
  locale: string
  onAction: (id: string, action: "confirm" | "attend" | "cancel" | "noShow") => void
  pending: boolean
  reduce: boolean
}

function DayView({ date, bookings, waitlist, locale, onAction, pending, reduce }: DayViewProps) {
  const t = useTranslations("bookings")
  const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        {(["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW"] as BookingStatus[]).map((s) => {
          const count = bookings.filter((b) => b.status === s).length
          if (!count) return null
          return (
            <div key={s} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold", STATUS_BG[s])}>
              <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
              {count} {t(STATUS_LABEL_KEY[s])}
            </div>
          )
        })}
        {waitlist > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
            <Users className="size-3.5" />
            {waitlist} {t("calWaitlist", { n: waitlist })}
          </div>
        )}
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
          <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Button size="sm" className="mt-4" asChild>
            <Link href={`/dashboard/bookings/new?date=${toIso(date.getFullYear(), date.getMonth(), date.getDate())}`}>
              <Plus className="size-4" />
              {t("calAddForDay")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="relative flex flex-col gap-0">
          {/* Timeline vertical line */}
          <div className="absolute start-[52px] top-0 bottom-0 w-px bg-border/60" />
          {sorted.map((b, i) => (
            <motion.div
              key={b.id}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-4 pb-4"
            >
              {/* Time */}
              <div className="w-12 shrink-0 pt-1 text-end">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatTime12(b.startTime, locale)}
                </span>
              </div>
              {/* Dot */}
              <div className={cn(
                "relative z-10 mt-2 size-3 shrink-0 rounded-full ring-2 ring-background",
                STATUS_DOT[b.status] ?? "bg-muted",
              )} />
              {/* Card */}
              <div className="min-w-0 flex-1">
                <BookingCard booking={b} onAction={onAction} pending={pending} locale={locale} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main CalendarView ────────────────────────────────────────

export function CalendarView({
  bookings,
  waitlistByDay,
  services,
  staff,
  onBookingAction,
  pending,
}: CalendarViewProps) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const isRTL = locale === "ar"
  const reduce = useReducedMotion()

  // Offscreen direction for panels (RTL-aware)
  const offscreen = isRTL ? "-100%" : "100%"

  const today = todayIso()
  const todayDate = new Date()

  // ── View state
  const [calMode, setCalMode] = useState<CalMode>("month")
  const [viewDate, setViewDate] = useState<Date>(todayDate)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // ── Filters
  const [serviceId, setServiceId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [query, setQuery] = useState("")

  // ── Derived
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      if (serviceId && b.serviceId !== serviceId) return false
      if (staffId && b.staffId !== staffId) return false
      if (q && !b.customerName.toLowerCase().includes(q) && !b.customerPhone.includes(q)) return false
      return true
    })
  }, [bookings, serviceId, staffId, query])

  const byDate = useMemo(() => groupByDate(filteredBookings), [filteredBookings])

  // Month navigation
  function prevPeriod() {
    if (calMode === "month") setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (calMode === "week") setViewDate((d) => addDays(d, -7))
    else setViewDate((d) => addDays(d, -1))
  }
  function nextPeriod() {
    if (calMode === "month") setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (calMode === "week") setViewDate((d) => addDays(d, 7))
    else setViewDate((d) => addDays(d, 1))
  }
  function goToday() { setViewDate(todayDate) }

  // Computed calendar data
  const matrix = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth])
  const weekNames = useMemo(() => shortWeekNames(locale), [locale])
  const monthLabel = formatMonthLabel(viewYear, viewMonth, locale)
  const currentWeekDays = useMemo(() => weekDays(viewDate), [viewDate])
  const dayBookings = useMemo(() => {
    const iso = toIso(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate())
    return byDate[iso] ?? []
  }, [byDate, viewDate])
  const dayWaitlist = useMemo(() => {
    const iso = toIso(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate())
    return waitlistByDay[iso] ?? 0
  }, [waitlistByDay, viewDate])

  // Selected day (month view)
  const selectedBookings = selectedDay ? (byDate[selectedDay] ?? []) : []
  const selectedWaitlist = selectedDay ? (waitlistByDay[selectedDay] ?? 0) : 0

  // Period label for non-month views
  const periodLabel = calMode === "month"
    ? monthLabel
    : calMode === "week"
      ? `${new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short" }).format(currentWeekDays[0])} – ${new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(currentWeekDays[6])}`
      : formatDayLabel(viewDate, locale)

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: navigation + period label */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevPeriod}
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("calPrev")}
          >
            {isRTL ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          <button
            type="button"
            onClick={nextPeriod}
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("calNext")}
          >
            {isRTL ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {t("calToday")}
          </button>
          <h2 className="text-base font-bold text-foreground sm:text-lg">{periodLabel}</h2>
        </div>

        {/* Right: view mode tabs + add booking */}
        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            {(
              [
                { mode: "month" as CalMode, icon: <Calendar className="size-4" />, label: t("calMonth") },
                { mode: "week" as CalMode, icon: <CalendarRange className="size-4" />, label: t("calWeek") },
                { mode: "day" as CalMode, icon: <CalendarDays className="size-4" />, label: t("calDay") },
              ] as { mode: CalMode; icon: React.ReactNode; label: string }[]
            ).map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalMode(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all",
                  calMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard/bookings/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t("newBooking")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Filters
        services={services}
        staff={staff}
        serviceId={serviceId}
        staffId={staffId}
        query={query}
        onService={setServiceId}
        onStaff={setStaffId}
        onQuery={setQuery}
      />

      {/* ── Month view ── */}
      {calMode === "month" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px]">
          {/* Calendar grid */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {weekNames.map((n, i) => (
                <div key={i} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {n}
                </div>
              ))}
            </div>
            {/* Weeks */}
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-2"
            >
              {matrix.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5 pb-1.5 last:pb-0">
                  {week.map((day, di) => {
                    const iso = day ? toIso(day.getFullYear(), day.getMonth(), day.getDate()) : null
                    return (
                      <DayCell
                        key={iso ?? `e-${wi}-${di}`}
                        date={day}
                        rows={iso ? (byDate[iso] ?? []) : []}
                        waitlist={iso ? (waitlistByDay[iso] ?? 0) : 0}
                        isToday={iso === today}
                        isSelected={iso === selectedDay}
                        onClick={() => iso && setSelectedDay(iso === selectedDay ? null : iso)}
                        reduce={!!reduce}
                      />
                    )
                  })}
                </div>
              ))}
            </motion.div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 border-t border-border/60 p-3">
              {([["PENDING", "bg-amber-400"], ["CONFIRMED", "bg-blue-500"], ["ATTENDED", "bg-emerald-500"], ["NO_SHOW", "bg-red-500"]] as [string, string][]).map(([s, dot]) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", dot)} />
                  {t(STATUS_LABEL_KEY[s])}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-orange-500" />
                {t("calWaitlistLegend")}
              </span>
            </div>
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selectedDay && (
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
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Week view ── */}
      {calMode === "week" && (
        <motion.div
          key={`week-${currentWeekDays[0].toISOString()}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <WeekView
            days={currentWeekDays}
            byDate={byDate}
            waitlistByDay={waitlistByDay}
            today={today}
            locale={locale}
            onAction={onBookingAction}
            pending={pending}
            reduce={!!reduce}
          />
        </motion.div>
      )}

      {/* ── Day view ── */}
      {calMode === "day" && (
        <motion.div
          key={`day-${viewDate.toISOString()}`}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DayView
            date={viewDate}
            bookings={dayBookings}
            waitlist={dayWaitlist}
            locale={locale}
            onAction={onBookingAction}
            pending={pending}
            reduce={!!reduce}
          />
        </motion.div>
      )}
    </div>
  )
}
