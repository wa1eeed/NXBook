"use client"

// Per-service weekly availability editor. Add/remove time windows per
// day-of-week with a slot length. Drives the booking engine's slots.
//
// Display is 12-hour AM/PM (per product spec) but storage + the <input
// type="time"> element are always 24-hour. We deliberately leave the
// browser's time-picker alone — overriding it is fragile across locales.
// The visible chip labels and previews use formatTime12().

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Plus, X, CalendarClock, Info } from "lucide-react"
import { addAvailability, deleteAvailability } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { formatTime12 } from "@/lib/time"
import { cn } from "@/lib/utils"

export interface AvailRow {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotMin: number
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export function AvailabilityClient({
  serviceId,
  rows,
}: {
  serviceId: string
  rows: AvailRow[]
}) {
  const t = useTranslations("availability")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  // Highlight the empty-day cells with a soft "click + to add" hint
  // when the user just landed here from creating a brand-new service.
  const isNewService = searchParams.get("new") === "1"

  function add(formData: FormData) {
    setError("")
    formData.set("serviceId", serviceId)
    startTransition(async () => {
      const res = await addAvailability(formData)
      if (res.ok) {
        toast.success(t("added"))
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAvailability(id)
      if (res.ok) {
        toast.success(t("removed"))
        router.refresh()
      }
    })
  }

  const byDay = DAY_KEYS.map((_, i) =>
    rows.filter((r) => r.dayOfWeek === i),
  )
  const hasAnyWindow = rows.length > 0

  return (
    <div className="flex flex-col gap-6">
      {isNewService && !hasAnyWindow && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <CalendarClock className="size-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-primary">{t("newServiceTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("newServiceHint")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAY_KEYS.map((d, i) => (
          <div
            key={d}
            className="flex min-h-36 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-2"
          >
            <span className="text-center text-xs font-semibold text-muted-foreground">
              {t(`days.${d}`)}
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              {byDay[i].length === 0 ? (
                <span
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/60",
                    isNewService
                      ? "border-primary/40 text-primary/60"
                      : "border-border text-muted-foreground/40",
                  )}
                >
                  {tCommon("none")}
                </span>
              ) : (
                byDay[i].map((r) => (
                  <div
                    key={r.id}
                    className="group relative rounded-md bg-primary/15 px-2 py-1.5 text-xs text-primary"
                  >
                    <p className="font-medium tabular-nums leading-tight">
                      {formatTime12(r.startTime, locale)}
                    </p>
                    <p className="text-[0.65rem] text-primary/80">
                      → {formatTime12(r.endTime, locale)}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-primary/70">
                      {t("slotLen", { n: r.slotMin })}
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={pending}
                      aria-label={t("delete")}
                      className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-background/70 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 font-semibold">{t("addWindow")}</h2>
          <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            {t("addHint")}
          </p>
          <form action={add} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dayOfWeek">{t("day")}</Label>
              <select
                id="dayOfWeek"
                name="dayOfWeek"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="0"
              >
                {DAY_KEYS.map((d, i) => (
                  <option key={d} value={i}>
                    {t(`days.${d}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="startTime">{t("start")}</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue="09:00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endTime">{t("end")}</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue="17:00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slotMin">{t("slotMin")}</Label>
              <Input
                id="slotMin"
                name="slotMin"
                type="number"
                min={5}
                defaultValue={30}
                className="w-24"
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          </form>
          {error && (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(`error.${error}`)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
