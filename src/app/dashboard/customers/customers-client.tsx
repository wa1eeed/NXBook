"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Star, Ban, ShieldCheck, Users, Search, X, Upload, Plus } from "lucide-react"
import {
  setCustomerBlocked,
  setCustomerVIP,
  updateCustomerNotes,
  updateCustomerAction,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { MotionList, MotionItem } from "@/components/ui/motion-list"
import { cn } from "@/lib/utils"

export interface RecentBooking {
  id: string
  date: string
  startTime: string
  status: string
  serviceName: string
  amount: number | null
}

export interface CustomerRow {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  isBlocked: boolean
  isVIP: boolean
  noShowScore: number
  loyaltyScore: number
  totalBookings: number
  totalNoShows: number
  totalSpent: number
  lastVisitAt: string | null
  createdAt: string
  bookingsCount: number
  recentBookings: RecentBooking[]
}

type Filter = "all" | "vip" | "blocked" | "highNoShow" | "inactive"
type Sort = "lastVisit" | "spent" | "bookings"
type DrawerTab = "profile" | "bookings" | "stats"

const FILTERS: { value: Filter; labelKey: string }[] = [
  { value: "all", labelKey: "filterAll" },
  { value: "vip", labelKey: "filterVIP" },
  { value: "blocked", labelKey: "filterBlocked" },
  { value: "highNoShow", labelKey: "filterHighNoShow" },
  { value: "inactive", labelKey: "filterInactive" },
]

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_KEY: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  ATTENDED: "attended",
  NO_SHOW: "noShow",
  CANCELLED: "cancelled",
}

const INACTIVE_DAYS = 60

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function daysSince(iso: string | null) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

export function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations("customers")
  const ts = useTranslations("status")
  const locale = useLocale()
  const router = useRouter()
  const reduce = useReducedMotion()
  const offscreen = locale === "ar" ? "-100%" : "100%"
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<Sort>("lastVisit")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<DrawerTab>("profile")

  // Editable draft state for the open customer.
  const [draftName, setDraftName] = useState("")
  const [draftPhone, setDraftPhone] = useState("")
  const [draftEmail, setDraftEmail] = useState("")
  const [noteDraft, setNoteDraft] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = customers.filter((c) => {
      if (filter === "vip" && !c.isVIP) return false
      if (filter === "blocked" && !c.isBlocked) return false
      if (filter === "highNoShow" && !(c.noShowScore > 2)) return false
      if (filter === "inactive" && daysSince(c.lastVisitAt) < INACTIVE_DAYS)
        return false
      if (q && !`${c.name} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q))
        return false
      return true
    })
    const sorted = [...list]
    if (sort === "spent") sorted.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sort === "bookings")
      sorted.sort((a, b) => b.totalBookings - a.totalBookings)
    else
      sorted.sort(
        (a, b) =>
          (b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0) -
          (a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0),
      )
    return sorted
  }, [customers, filter, query, sort])

  const selected = customers.find((c) => c.id === openId) ?? null

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (res?.ok) {
        if (okMsg) toast.success(okMsg)
        router.refresh()
      } else {
        toast.error(t(`error.${res?.error ?? "notFound"}`))
      }
    })
  }

  function openPanel(c: CustomerRow) {
    setOpenId(c.id)
    setTab("profile")
    setDraftName(c.name)
    setDraftPhone(c.phone)
    setDraftEmail(c.email ?? "")
    setNoteDraft(c.notes ?? "")
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/customers/import">
              <Upload className="size-4" />
              {t("importCustomers")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t("sortBy")}</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="lastVisit">{t("sortLastVisit")}</option>
              <option value="spent">{t("sortSpent")}</option>
              <option value="bookings">{t("sortBookings")}</option>
            </select>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} description={t("emptyDesc")} />
      ) : (
        <MotionList key={`${filter}-${query}-${sort}`} className="flex flex-col gap-2">
          {filtered.map((c) => (
            <MotionItem key={c.id}>
              <button
                type="button"
                onClick={() => openPanel(c)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start transition-shadow hover:shadow-soft"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.isVIP && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <Star className="size-3" /> VIP
                      </span>
                    )}
                    {c.isBlocked && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        {t("blocked")}
                      </span>
                    )}
                    {c.noShowScore > 2 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                        {t("filterHighNoShow")}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.phone}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col items-end text-xs text-muted-foreground sm:flex">
                  <span>
                    {t("lastVisit")}: {c.lastVisitAt?.slice(0, 10) ?? "—"}
                  </span>
                  <span>
                    {c.totalSpent} SAR · {t("bookings")}: {c.totalBookings}
                  </span>
                </div>
              </button>
            </MotionItem>
          ))}
        </MotionList>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpenId(null)}
            />
            <motion.div
              className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-s border-border bg-background shadow-xl"
              initial={reduce ? false : { x: offscreen }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: offscreen }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                    {initials(selected.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selected.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.isVIP && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <Star className="size-3" /> VIP
                        </span>
                      )}
                      {selected.isBlocked && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          {t("blocked")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("closePanel")}
                  onClick={() => setOpenId(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* Drawer tabs */}
              <div className="flex gap-1 border-b border-border px-4 pt-3">
                {(["profile", "bookings", "stats"] as DrawerTab[]).map((tb) => (
                  <button
                    key={tb}
                    type="button"
                    onClick={() => setTab(tb)}
                    className={cn(
                      "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
                      tab === tb
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`${tb}Tab`)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-5 p-4">
                {tab === "profile" && (
                  <ProfileTab
                    customer={selected}
                    draftName={draftName}
                    draftPhone={draftPhone}
                    draftEmail={draftEmail}
                    noteDraft={noteDraft}
                    setDraftName={setDraftName}
                    setDraftPhone={setDraftPhone}
                    setDraftEmail={setDraftEmail}
                    setNoteDraft={setNoteDraft}
                    pending={pending}
                    run={run}
                  />
                )}
                {tab === "bookings" && (
                  <BookingsTab customer={selected} ts={ts} />
                )}
                {tab === "stats" && <StatsTab customer={selected} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProfileTab({
  customer,
  draftName,
  draftPhone,
  draftEmail,
  noteDraft,
  setDraftName,
  setDraftPhone,
  setDraftEmail,
  setNoteDraft,
  pending,
  run,
}: {
  customer: CustomerRow
  draftName: string
  draftPhone: string
  draftEmail: string
  noteDraft: string
  setDraftName: (v: string) => void
  setDraftPhone: (v: string) => void
  setDraftEmail: (v: string) => void
  setNoteDraft: (v: string) => void
  pending: boolean
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void
}) {
  const t = useTranslations("customers")
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cn">{t("name")}</Label>
          <Input id="cn" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp">{t("phone")}</Label>
          <Input
            id="cp"
            value={draftPhone}
            onChange={(e) => setDraftPhone(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ce">{t("email")}</Label>
          <Input
            id="ce"
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            dir="ltr"
          />
        </div>
        <Button
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                updateCustomerAction(customer.id, {
                  name: draftName,
                  phone: draftPhone,
                  email: draftEmail,
                }),
              t("saved"),
            )
          }
        >
          {t("editProfile")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => setCustomerVIP(customer.id, !customer.isVIP), t("saved"))
          }
        >
          <Star
            className={cn(
              "size-4",
              customer.isVIP && "fill-current text-amber-500",
            )}
          />
          {t("vip")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => setCustomerBlocked(customer.id, !customer.isBlocked),
              t("saved"),
            )
          }
        >
          {customer.isBlocked ? (
            <ShieldCheck className="size-4" />
          ) : (
            <Ban className="size-4" />
          )}
          {customer.isBlocked ? t("unblock") : t("block")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-2">
        <Stat label={t("firstVisit")} value={customer.createdAt.slice(0, 10)} />
        <Stat label={t("spent")} value={`${customer.totalSpent} SAR`} />
        <Stat label={t("totalVisits")} value={customer.totalBookings} />
        <Stat label={t("noShows")} value={customer.totalNoShows} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("notes")}</h3>
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={t("notesPlaceholder")}
        />
        <Button
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            run(() => updateCustomerNotes(customer.id, noteDraft), t("saved"))
          }
        >
          {t("saveNotes")}
        </Button>
      </div>
    </>
  )
}

function BookingsTab({
  customer,
  ts,
}: {
  customer: CustomerRow
  ts: (k: string) => string
}) {
  const t = useTranslations("customers")
  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="outline" className="self-start" asChild>
        <Link href={`/dashboard/bookings/new?customerId=${customer.id}`}>
          <Plus className="size-4" />
          {t("newBookingForCustomer")}
        </Link>
      </Button>
      {customer.recentBookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noBookings")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {customer.recentBookings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{b.serviceName}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {b.date} {b.startTime}
                  {b.amount != null ? ` · ${b.amount} SAR` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_STYLE[b.status] ?? "",
                )}
              >
                {ts(STATUS_KEY[b.status] ?? "pending")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsTab({ customer }: { customer: CustomerRow }) {
  const t = useTranslations("customers")

  const topServices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of customer.recentBookings)
      counts.set(b.serviceName, (counts.get(b.serviceName) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [customer.recentBookings])

  const hours = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of customer.recentBookings) {
      const h = b.startTime.slice(0, 2) + ":00"
      counts.set(h, (counts.get(h) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [customer.recentBookings])

  const attended = customer.totalBookings - customer.totalNoShows
  const avgSpend = attended > 0 ? Math.round(customer.totalSpent / attended) : 0

  return (
    <div className="flex flex-col gap-5">
      <ScoreBar
        label={t("noShowScore")}
        value={customer.noShowScore}
        max={5}
        danger={customer.noShowScore > 2}
      />
      <ScoreBar
        label={t("loyalty")}
        value={customer.loyaltyScore}
        max={10}
        good
      />

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label={t("avgSpend")} value={`${avgSpend} SAR`} />
        <Stat label={t("totalVisits")} value={customer.totalBookings} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("topServices")}</h3>
        {topServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBookings")}</p>
        ) : (
          topServices.map(([name, count]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm"
            >
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground tabular-nums">{count}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("preferredTimes")}</h3>
        {hours.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBookings")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hours.map(([h, count]) => (
              <span
                key={h}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary tabular-nums"
              >
                {h} ({count})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  value,
  max,
  danger,
  good,
}: {
  label: string
  value: number
  max: number
  danger?: boolean
  good?: boolean
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.toFixed(1)} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            danger ? "bg-red-500" : good ? "bg-green-500" : "bg-primary",
          )}
          style={{ inlineSize: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2 text-center">
      <p className="font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
