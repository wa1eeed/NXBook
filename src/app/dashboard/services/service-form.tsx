"use client"

// Create/edit service form. Bilingual fields + buffer + capacity per
// CLAUDE.md §11. Adds a per-service payment mode toggle: "Pay on arrival"
// (default) vs "Pay online to confirm". The toggle hides itself when the
// price is 0 (free services can't require online payment).
//
// After successful creation, we route the owner straight into the new
// service's availability editor — that's the only sensible next step.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CreditCard, MapPin } from "lucide-react"
import {
  createService,
  updateService,
  type ActionResult,
  type CreateServiceResult,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ServicePaymentMode = "ON_ARRIVAL" | "ONLINE"

export interface ServiceInitial {
  id: string
  nameEn: string
  nameAr: string | null
  descriptionEn: string | null
  descriptionAr: string | null
  durationMin: number
  bufferMin: number
  price: number
  maxCapacity: number
  isVisible: boolean
  paymentMode?: ServicePaymentMode
}

export function ServiceForm({
  initial,
  onDone,
}: {
  initial?: ServiceInitial
  onDone: () => void
}) {
  const t = useTranslations("services")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  // Local state so we can hide the payment-mode toggle for free services
  // and keep the selection responsive without a server round-trip.
  const [price, setPrice] = useState<number>(initial?.price ?? 0)
  const [paymentMode, setPaymentMode] = useState<ServicePaymentMode>(
    initial?.paymentMode ?? "ON_ARRIVAL",
  )

  function submit(formData: FormData) {
    setError("")
    // Authoritative paymentMode comes from our state, not the hidden input —
    // this guards against a stale form when the user toggles after typing.
    formData.set("paymentMode", price > 0 ? paymentMode : "ON_ARRIVAL")

    startTransition(async () => {
      if (initial) {
        const res: ActionResult = await updateService(initial.id, formData)
        if (res.ok) {
          router.refresh()
          onDone()
        } else setError(res.error)
      } else {
        const res: CreateServiceResult = await createService(formData)
        if (res.ok) {
          // UX flow per spec: after creating a service, the owner is sent
          // straight into the availability editor — that's the only useful
          // next action and skipping it is the #1 onboarding pitfall.
          router.push(`/dashboard/services/${res.id}?new=1`)
        } else setError(res.error)
      }
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {/* ── Names ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameEn">{t("nameEn")}</Label>
          <Input id="nameEn" name="nameEn" defaultValue={initial?.nameEn} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameAr">{t("nameAr")}</Label>
          <Input id="nameAr" name="nameAr" defaultValue={initial?.nameAr ?? ""} dir="rtl" />
        </div>
      </div>

      {/* ── Descriptions ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionEn">{t("descriptionEn")}</Label>
          <Textarea
            id="descriptionEn"
            name="descriptionEn"
            defaultValue={initial?.descriptionEn ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionAr">{t("descriptionAr")}</Label>
          <Textarea
            id="descriptionAr"
            name="descriptionAr"
            defaultValue={initial?.descriptionAr ?? ""}
            dir="rtl"
          />
        </div>
      </div>

      {/* ── Numbers ───────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMin">{t("durationMin")}</Label>
          <Input
            id="durationMin"
            name="durationMin"
            type="number"
            min={5}
            defaultValue={initial?.durationMin ?? 30}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bufferMin">{t("bufferMin")}</Label>
          <Input
            id="bufferMin"
            name="bufferMin"
            type="number"
            min={0}
            defaultValue={initial?.bufferMin ?? 0}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">{t("price")}</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial?.price ?? 0}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxCapacity">{t("maxCapacity")}</Label>
          <Input
            id="maxCapacity"
            name="maxCapacity"
            type="number"
            min={1}
            defaultValue={initial?.maxCapacity ?? 1}
            required
          />
        </div>
      </div>

      {/* ── Payment mode (hidden when free) ───────────────── */}
      {price > 0 && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-medium">{t("paymentMode")}</legend>
          <p className="text-xs text-muted-foreground">{t("paymentModeHint")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <PaymentChoice
              icon={MapPin}
              label={t("payOnArrival")}
              desc={t("payOnArrivalDesc")}
              selected={paymentMode === "ON_ARRIVAL"}
              onClick={() => setPaymentMode("ON_ARRIVAL")}
            />
            <PaymentChoice
              icon={CreditCard}
              label={t("payOnline")}
              desc={t("payOnlineDesc")}
              selected={paymentMode === "ONLINE"}
              onClick={() => setPaymentMode("ONLINE")}
            />
          </div>
          {/* Server-trusted value — the action overrides this in submit() */}
          <input type="hidden" name="paymentMode" value={paymentMode} />
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isVisible"
          value="true"
          defaultChecked={initial?.isVisible ?? true}
          className="size-4"
        />
        {t("visible")}
      </label>

      {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : initial ? t("save") : t("saveAndAddAvailability")}
        </Button>
      </div>
    </form>
  )
}

// Big-target radio card. Keeps the form interaction tactile on mobile.
function PaymentChoice({
  icon: Icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-start transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-accent/30",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-tight">{label}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  )
}
