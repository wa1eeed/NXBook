"use client"

// ============================================================
// Public booking flow: service → date → slot → details → done.
// Full slots are tappable too → they switch the flow into
// "waitlist" mode, and the details step joins the waitlist
// instead of booking. Uses the tenant's brand color as accent.
// ============================================================

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
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
  paymentEnabled = false,
  depositPercent = 0,
  cancellationHours = 24,
}: {
  slug: string
  services: PublicService[]
  accent: string
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

  // Payment applies only to real bookings, never to joining a waitlist.
  const requiresPayment = paymentEnabled && mode === "book"

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
          setPosition(null)
          setStep("done")
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
        // Hand off to the gateway (or the fallback result page).
        window.location.href = res.paymentUrl
      } else setError(res.error)
    })
  }

  const depositAmount = (s: PublicService) =>
    Math.round(((s.price * (depositPercent > 0 ? depositPercent : 100)) / 100) * 100) / 100

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
          {service && title(service)} · {dateISO} · {slot?.startTime}
        </p>
        {waitlisted && position != null && (
          <p className="mt-1 text-sm font-medium" style={{ color: accent }}>
            {t("waitlistPosition", { n: position })}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step: service */}
      {step === "service" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("chooseService")}</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => pickService(s)}
              className="flex items-center justify-between rounded-xl border border-border p-4 text-start transition-colors hover:bg-accent"
            >
              <div>
                <p className="font-medium">{title(s)}</p>
                {desc(s) && (
                  <p className="text-sm text-muted-foreground">{desc(s)}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.durationMin} min · {s.price} SAR
                </p>
              </div>
              <span style={{ color: accent }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* Step: slot */}
      {step === "slot" && service && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("service")}
            className="self-start text-sm text-muted-foreground hover:text-foreground"
          >
            ← {title(service)}
          </button>
          <h2 className="text-lg font-semibold">{t("chooseTime")}</h2>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const dt = new Date(d + "T00:00:00")
              const active = d === dateISO
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  className={cn(
                    "flex min-w-14 flex-col items-center rounded-lg border px-3 py-2 text-sm",
                    active ? "text-white" : "border-border hover:bg-accent",
                  )}
                  style={
                    active ? { backgroundColor: accent, borderColor: accent } : undefined
                  }
                >
                  <span className="text-xs">
                    {dt.toLocaleDateString(locale, { weekday: "short" })}
                  </span>
                  <span className="font-semibold">{dt.getDate()}</span>
                </button>
              )
            })}
          </div>

          {dateISO && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pending && <p className="text-sm text-muted-foreground">…</p>}
              {!pending && slots.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  {t("noSlots")}
                </p>
              )}
              {slots.map((sl) => {
                const full = sl.remaining <= 0
                const active = slot?.startTime === sl.startTime
                return (
                  <button
                    key={sl.startTime}
                    onClick={() => pickSlot(sl)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm",
                      full && !active && "opacity-50",
                      active ? "text-white" : "border-border hover:bg-accent",
                    )}
                    style={
                      active ? { backgroundColor: accent, borderColor: accent } : undefined
                    }
                  >
                    {sl.startTime}
                    <span className="block text-[10px] opacity-70">
                      {full
                        ? t("full")
                        : service.maxCapacity > 1
                          ? t("remaining", { n: sl.remaining })
                          : ""}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {slot && (
            <Button onClick={() => setStep("details")} style={{ backgroundColor: accent }}>
              {slot.remaining <= 0 ? t("joinWaitlist") : t("continue")}
            </Button>
          )}
        </div>
      )}

      {/* Step: details */}
      {step === "details" && service && slot && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("slot")}
            className="self-start text-sm text-muted-foreground hover:text-foreground"
          >
            ← {dateISO} · {slot.startTime}
          </button>
          <h2 className="text-lg font-semibold">{t("yourDetails")}</h2>
          {mode === "waitlist" && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {t("waitlistNotice")}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="bname">{t("name")}</Label>
            <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bphone">{t("phone")}</Label>
            <Input
              id="bphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+9665…"
            />
          </div>
          {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}
          <Button
            onClick={submit}
            disabled={pending || name.length < 2 || phone.length < 6}
            style={{ backgroundColor: accent }}
          >
            {pending
              ? t("booking")
              : mode === "waitlist"
                ? t("joinWaitlist")
                : requiresPayment
                  ? t("continue")
                  : t("bookNow")}
          </Button>
        </div>
      )}

      {/* Step: payment summary (only for paid bookings) */}
      {step === "payment" && service && slot && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep("details")}
            className="self-start text-sm text-muted-foreground hover:text-foreground"
          >
            ← {dateISO} · {slot.startTime}
          </button>
          <h2 className="text-lg font-semibold">{t("paymentSummary")}</h2>

          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{title(service)}</span>
              <span className="font-medium">{service.price} SAR</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold">{t("depositAmount")}</span>
              <span className="text-lg font-bold" style={{ color: accent }}>
                {depositAmount(service)} SAR
              </span>
            </div>
          </div>

          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t("cancellationPolicy", { n: cancellationHours })}
          </p>

          {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}

          <Button
            onClick={pay}
            disabled={pending}
            style={{ backgroundColor: accent }}
          >
            {pending ? t("processingPayment") : t("payAndBook")}
          </Button>
        </div>
      )}
    </div>
  )
}
