"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react"
import { createManualBookingAction, getAvailableSlotsAction } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"
import { formatTime12 } from "@/lib/time"

export interface ServiceOption {
  id: string
  name: string
  durationMin: number
  price: number
}

interface CustomerOption {
  id: string
  name: string
  phone: string
}

type Slot = { startTime: string; endTime: string; remaining: number }

export function NewBookingClient({
  services,
  customers,
}: {
  services: ServiceOption[]
  customers: CustomerOption[]
}) {
  const t = useTranslations("bookings")
  const tc = useTranslations("customers")
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState(1)
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [startTime, setStartTime] = useState("")

  // Customer selection.
  const [customerId, setCustomerId] = useState<string | null>(
    params.get("customerId"),
  )
  const [newMode, setNewMode] = useState(false)
  const [custQuery, setCustQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [notes, setNotes] = useState("")

  // If arriving with a prefilled customerId, jump to service selection.
  useEffect(() => {
    if (params.get("customerId")) setCustomerId(params.get("customerId"))
  }, [params])

  const service = services.find((s) => s.id === serviceId) ?? null
  const customer = customers.find((c) => c.id === customerId) ?? null

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim().toLowerCase()
    if (!q) return customers.slice(0, 50)
    return customers.filter((c) =>
      `${c.name} ${c.phone}`.toLowerCase().includes(q),
    )
  }, [customers, custQuery])

  function loadSlots(d: string) {
    setDate(d)
    setStartTime("")
    if (!serviceId) return
    setLoadingSlots(true)
    startTransition(async () => {
      const res = await getAvailableSlotsAction(serviceId, d)
      setSlots(res)
      setLoadingSlots(false)
    })
  }

  function submit() {
    const customerValid = newMode
      ? newName.trim() && newPhone.trim()
      : !!customerId
    if (!serviceId || !date || !startTime || !customerValid) {
      toast.error(t("error.invalidInput"))
      return
    }
    startTransition(async () => {
      const res = await createManualBookingAction({
        serviceId,
        date,
        startTime,
        customerId: newMode ? undefined : customerId ?? undefined,
        newCustomer: newMode
          ? {
              name: newName.trim(),
              phone: newPhone.trim(),
              email: newEmail.trim() || undefined,
            }
          : undefined,
        notes: notes.trim() || undefined,
      })
      if (res.ok) {
        toast.success(t("toast.confirm"))
        router.push("/dashboard/bookings")
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  const customerLabel = newMode
    ? newName || "—"
    : customer?.name ?? "—"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("newBooking")}
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/bookings">
              <ArrowLeft className="size-4" />
              {t("cancel")}
            </Link>
          </Button>
        }
      />

      {/* Stepper */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-sm font-medium",
              step === s
                ? "bg-primary text-primary-foreground"
                : step > s
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {step > s ? <Check className="size-4" /> : s}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          {/* Step 1: Service */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold">{t("filterService")}</h2>
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setServiceId(s.id)
                    setSlots(null)
                    setStep(2)
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-start transition-colors",
                    serviceId === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {s.durationMin}m · {s.price} SAR
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Date + slot */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold">{t("selectNewSlot")}</h2>
              <Input
                type="date"
                value={date}
                onChange={(e) => loadSlots(e.target.value)}
              />
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">…</p>
              ) : slots && slots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.startTime}
                      type="button"
                      disabled={s.remaining <= 0}
                      onClick={() => setStartTime(s.startTime)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-sm tabular-nums transition-colors disabled:opacity-40",
                        startTime === s.startTime
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {formatTime12(s.startTime, locale)}
                    </button>
                  ))}
                </div>
              ) : slots ? (
                <p className="text-sm text-muted-foreground">
                  {t("error.slotUnavailable")}
                </p>
              ) : null}
            </div>
          )}

          {/* Step 3: Customer */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{tc("title")}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewMode((v) => !v)}
                >
                  {newMode ? tc("existingCustomer") : tc("addNewCustomer")}
                </Button>
              </div>

              {newMode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nm">{tc("name")}</Label>
                    <Input
                      id="nm"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ph">{tc("phone")}</Label>
                    <Input
                      id="ph"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="em">{tc("email")}</Label>
                    <Input
                      id="em"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={custQuery}
                      onChange={(e) => setCustQuery(e.target.value)}
                      placeholder={tc("searchPlaceholder")}
                      className="ps-9"
                    />
                  </div>
                  <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-start text-sm transition-colors",
                          customerId === c.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">{t("confirm")}</h2>
              <div className="grid gap-2 rounded-lg border border-border p-4 text-sm">
                <Row label={t("filterService")} value={service?.name ?? "—"} />
                <Row
                  label={t("dateFrom")}
                  value={`${date} ${formatTime12(startTime, locale)}`}
                />
                <Row label={tc("name")} value={customerLabel} />
                {service && (
                  <Row label="SAR" value={`${service.price} SAR`} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">{tc("notes")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tc("notesPlaceholder")}
                />
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              disabled={step === 1 || pending}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="size-4" />
              {t("dateFrom")}
            </Button>
            {step < 4 ? (
              <Button
                disabled={
                  pending ||
                  (step === 1 && !serviceId) ||
                  (step === 2 && (!date || !startTime)) ||
                  (step === 3 &&
                    (newMode
                      ? !newName.trim() || !newPhone.trim()
                      : !customerId))
                }
                onClick={() => setStep((s) => s + 1)}
              >
                {t("dateTo")}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button disabled={pending} onClick={submit}>
                <Check className="size-4" />
                {t("confirm")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
