"use client"

// ============================================================
// Public booking flow: service → date → slot → details → done.
// Full slots are tappable too → they switch the flow into
// "waitlist" mode, and the details step joins the waitlist
// instead of booking. Uses the tenant's brand color as accent.
//
// Per-service payment mode (CLAUDE.md §11):
//   · ON_ARRIVAL → straight from details to "done"
//   · ONLINE     → details → payment summary → gateway → /payment/result
// Display: 12-hour AM/PM throughout, slots grouped by AM/PM blocks.
// ============================================================

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CalendarCheck,
  Clock,
  CreditCard,
  MapPin,
  ChevronRight,
  Loader2,
} from "lucide-react"
import {
  listSlots,
  submitBooking,
  joinWaitlistAction,
  initiateBookingPaymentAction,
} from "./actions"
import type { Slot } from "@/lib/booking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatTime12, groupByMeridiem } from "@/lib/time"
import { cn } from "@/lib/utils"

export interface PublicService {
  id: string
  nameEn: string
  nameAr: string | null
  descriptionEn: string | null
  descriptionAr: string | null
  durationMin: number
  price: number
  maxCapacity: number
  paymentMode: "ON_ARRIVAL" | "ONLINE"
}

type Step = "service" | "slot" | "details" | "payment" | "done"
type Mode = "book" | "waitlist"

// Next 14 days as YYYY-MM-DD (local).
function nextDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < n; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    out.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
        x.getDate(),
      ).padStart(2, "0")}`,
    )
  }
  return out
}

export function BookingFlow({
  slug,
  services,
  accent,
  depositPercent = 0,
  cancellationHours = 24,
}: {
  slug: string
  services: PublicService[]
  accent: string
  // `paymentEnabled` no longer needed — payment is decided per-service.
  paymentEnabled?: boolean
  depositPercent?: number
  cancellationHours?: number
}) {
  const t = useTranslations("booking")
  const locale = useLocale()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>("service")
  const [mode, setMode] = useState<Mode>("book")
  const [service, setService] = useState<PublicService | null>(null)
  const [dateISO, setDateISO] = useState<string>("")
  const [slots, setSlots] = useState<Slot[]>([])
  const [slot, setSlot] = useState<Slot | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [position, setPosition] = useState<number | null>(null)
  const [error, setError] = useState("")

  const days = nextDays(14)

  function title(s: PublicService) {
    return locale === "ar" && s.nameAr ? s.nameAr : s.nameEn
  }
  function desc(s: PublicService) {
    return locale === "ar" && s.descriptionAr ? s.descriptionAr : s.descriptionEn
  }

  function pickService(s: PublicService) {
    setService(s)
    setStep("slot")
    setDateISO("")
    setSlots([])
    setSlot(null)
    setError("")
  }

  function pickDate(d: string) {
    setDateISO(d)
    setSlot(null)
    if (!service) return
    startTransition(async () => {
      setSlots(await listSlots(slug, service.id, d))
    })
  }

  function pickSlot(sl: Slot) {
    setSlot(sl)
    setMode(sl.remaining <= 0 ? "waitlist" : "book")
  }

  // Online payment is per-SERVICE (not per-business), and never applies
  // when joining a waitlist.
  const requiresPayment =
    !!service && service.paymentMode === "ONLINE" && mode === "book"

  function submit() {
    if (!service || !slot) return
    setError("")
    // Paid bookings route to the payment summary step first.
    if (requiresPayment) {
      setStep("payment")
      return
    }
    startTransition(async () => {
      if (mode === "waitlist") {
        const res = await joinWaitlistAction({
          slug,
          serviceId: service.id,
          dateISO,
          startTime: slot.startTime,
          name,
          phone,
        })
        if (res.ok) {
          setPosition(res.position)
          setStep("done")
        } else setError(res.error)
      } else {
        const res = await submitBooking({
          slug,
          serviceId: service.id,
          dateISO,
          startTime: slot.startTime,
          name,
          phone,
        })
        if (res.ok) {
          // Route to the rich confirmation page (calendar links, share, cancel).
          window.location.href = `/${slug}/confirmation/${res.bookingId}`
        } else setError(res.error)
      }
    })
  }

  function pay() {
    if (!service || !slot) return
    setError("")
    startTransition(async () => {
      const res = await initiateBookingPaymentAction({
        slug,
        serviceId: service.id,
        date: dateISO,
        startTime: slot.startTime,
        customerName: name,
        customerPhone: phone,
      })
      if (res.ok) {
        window.location.href = res.paymentUrl
      } else setError(res.error)
    })
  }

  const depositAmount = (s: PublicService) =>
    Math.round(((s.price * (depositPercent > 0 ? depositPercent : 100)) / 100) * 100) / 100

  // ─── DONE step ────────────────────────────────────────────
  if (step === "done") {
    const waitlisted = mode === "waitlist"
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ backgroundColor: accent }}
        >
          {waitlisted ? "⏳" : "✓"}
        </div>
        <h2 className="text-xl font-bold">
          {waitlisted ? t("waitlistJoined") : t("confirmed")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {service && title(service)} · {dateISO} ·{" "}
          {slot && formatTime12(slot.startTime, locale)}
        </p>
        {waitlisted && position != null && (
          <p className="mt-1 text-sm font-medium" style={{ color: accent }}>
            {t("waitlistPosition", { n: position })}
          </p>
        )}
      </div>
    )
  }

  // ─── Progress dots (only after service step) ─────────────
  const progress = (() => {
    const map: Record<Step, number> = {
      service: 0,
      slot: 1,
      details: 2,
      payment: 3,
      done: 3,
    }
    return map[step]
  })()
  const maxSteps = requiresPayment ? 4 : 3
  const stepLabels = requiresPayment
    ? [t("stepService"), t("stepTime"), t("stepDetails"), t("stepPay")]
    : [t("stepService"), t("stepTime"), t("stepDetails")]

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator (hidden on service step where it's noise) */}
      {step !== "service" && (
        <ol
          className="flex items-center gap-2"
          aria-label={t("progressLabel")}
        >
          {Array.from({ length: maxSteps }).map((_, i) => {
            const active = i <= progress
            return (
              <li key={i} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                    active
                      ? "text-white"
                      : "border border-border bg-background text-muted-foreground",
                  )}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-xs font-medium sm:inline",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stepLabels[i]}
                </span>
                {i < maxSteps - 1 && (
                  <span className="h-px flex-1 bg-border" />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {/* ─── Step: service ─────────────────────────────────── */}
      {step === "service" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("chooseService")}</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => pickService(s)}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border p-4 text-start transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{title(s)}</p>
                {desc(s) && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {desc(s)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {t("durationMins", { n: s.durationMin })}
                  </span>
                  {s.price > 0 ? (
                    <span className="font-medium text-foreground">
                      {s.price} SAR
                    </span>
                  ) : (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {t("free")}
                    </span>
                  )}
                  {s.price > 0 && (
                    <PaymentBadge mode={s.paymentMode} accent={accent} />
                  )}
                </div>
              </div>
              <ChevronRight
                className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                style={{ color: accent }}
              />
            </button>
          ))}
        </div>
      )}

      {/* ─── Step: slot ────────────────────────────────────── */}
      {step === "slot" && service && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("service")}
            className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {title(service)}
          </button>
          <h2 className="text-lg font-semibold">{t("chooseTime")}</h2>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const dt = new Date(d + "T00:00:00")
              const active = d === dateISO
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  className={cn(
                    "flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-sm transition-all",
                    active
                      ? "text-white shadow-soft"
                      : "border-border hover:-translate-y-0.5 hover:border-primary/40",
                  )}
                  style={
                    active ? { backgroundColor: accent, borderColor: accent } : undefined
                  }
                >
                  <span className="text-xs">
                    {dt.toLocaleDateString(locale, { weekday: "short" })}
                  </span>
                  <span className="text-lg font-semibold leading-tight">
                    {dt.getDate()}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {dt.toLocaleDateString(locale, { month: "short" })}
                  </span>
                </button>
              )
            })}
          </div>

          {dateISO && pending && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loadingSlots")}
            </div>
          )}
          {dateISO && !pending && slots.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("noSlots")}
            </div>
          )}

          {dateISO && !pending && slots.length > 0 && (
            <SlotPicker
              slots={slots}
              selected={slot}
              onPick={pickSlot}
              accent={accent}
              capacity={service.maxCapacity}
              t={t}
              locale={locale}
            />
          )}

          {slot && (
            <Button
              onClick={() => setStep("details")}
              className="mt-2 h-12 text-base"
              style={{ backgroundColor: accent }}
            >
              {slot.remaining <= 0 ? t("joinWaitlist") : t("continue")}
            </Button>
          )}
        </div>
      )}

      {/* ─── Step: details ─────────────────────────────────── */}
      {step === "details" && service && slot && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("slot")}
            className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {dateISO} · {formatTime12(slot.startTime, locale)}
          </button>
          <h2 className="text-lg font-semibold">{t("yourDetails")}</h2>
          {mode === "waitlist" && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {t("waitlistNotice")}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="bname">{t("name")}</Label>
            <Input
              id="bname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bphone">{t("phone")}</Label>
            <Input
              id="bphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+9665…"
              dir="ltr"
            />
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(`error.${error}`)}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={pending || name.length < 2 || phone.length < 6}
            className="mt-2 h-12 text-base"
            style={{ backgroundColor: accent }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending
              ? t("booking")
              : mode === "waitlist"
                ? t("joinWaitlist")
                : requiresPayment
                  ? t("continueToPayment")
                  : t("bookNow")}
          </Button>
        </div>
      )}

      {/* ─── Step: payment summary (only for ONLINE services) */}
      {step === "payment" && service && slot && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("details")}
            className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {dateISO} · {formatTime12(slot.startTime, locale)}
          </button>
          <h2 className="text-lg font-semibold">{t("paymentSummary")}</h2>

          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-4" style={{ color: accent }} />
                <span className="font-medium">{title(service)}</span>
              </div>
              <span className="text-muted-foreground">{service.price} SAR</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t("when")}</span>
              <span className="font-medium tabular-nums">
                {dateISO} · {formatTime12(slot.startTime, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="font-semibold">{t("amountDue")}</span>
              <span className="text-lg font-bold" style={{ color: accent }}>
                {depositAmount(service)} SAR
              </span>
            </div>
          </div>

          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t("cancellationPolicy", { n: cancellationHours })}
          </p>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(`error.${error}`)}
            </p>
          )}

          <Button
            onClick={pay}
            disabled={pending}
            className="mt-2 h-12 text-base"
            style={{ backgroundColor: accent }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? t("processingPayment") : t("payAndBook")}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Small leaf components ────────────────────────────────

function PaymentBadge({
  mode,
  accent,
}: {
  mode: "ON_ARRIVAL" | "ONLINE"
  accent: string
}) {
  const t = useTranslations("booking")
  const isOnline = mode === "ONLINE"
  const Icon = isOnline ? CreditCard : MapPin
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`,
        color: accent,
      }}
    >
      <Icon className="size-3" />
      {isOnline ? t("badgePayOnline") : t("badgePayOnArrival")}
    </span>
  )
}

// Slots grouped by AM / PM blocks for a calmer mobile layout.
function SlotPicker({
  slots,
  selected,
  onPick,
  accent,
  capacity,
  t,
  locale,
}: {
  slots: Slot[]
  selected: Slot | null
  onPick: (s: Slot) => void
  accent: string
  capacity: number
  t: ReturnType<typeof useTranslations<"booking">>
  locale: string
}) {
  const { am, pm } = groupByMeridiem(slots)

  function Block({ label, items }: { label: string; items: Slot[] }) {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((sl) => {
            const full = sl.remaining <= 0
            const active = selected?.startTime === sl.startTime
            return (
              <button
                key={sl.startTime}
                onClick={() => onPick(sl)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-sm tabular-nums transition-all",
                  full && !active && "opacity-60",
                  active
                    ? "text-white shadow-soft"
                    : "border-border hover:-translate-y-0.5 hover:border-primary/40",
                )}
                style={
                  active
                    ? { backgroundColor: accent, borderColor: accent }
                    : undefined
                }
              >
                {formatTime12(sl.startTime, locale)}
                <span className="block text-[10px] opacity-80">
                  {full
                    ? t("full")
                    : capacity > 1
                      ? t("remaining", { n: sl.remaining })
                      : ""}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Block label={t("morning")} items={am} />
      <Block label={t("afternoon")} items={pm} />
    </div>
  )
}
