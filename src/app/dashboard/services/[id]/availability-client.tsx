"use client"

// Per-service weekly availability editor. Add/remove time windows per
// day-of-week with a slot length. Drives the booking engine's slots.
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"
import { addAvailability, deleteAvailability } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

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
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function add(formData: FormData) {
    setError("")
    formData.set("serviceId", serviceId)
    startTransition(async () => {
      const res = await addAvailability(formData)
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteAvailability(id)
      router.refresh()
    })
  }

  const byDay = DAY_KEYS.map((_, i) =>
    rows.filter((r) => r.dayOfWeek === i),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAY_KEYS.map((d, i) => (
          <div
            key={d}
            className="flex min-h-32 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-2"
          >
            <span className="text-center text-xs font-semibold text-muted-foreground">
              {t(`days.${d}`)}
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              {byDay[i].length === 0 ? (
                <span className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border text-lg text-muted-foreground/40">
                  +
                </span>
              ) : (
                byDay[i].map((r) => (
                  <div
                    key={r.id}
                    className="group relative rounded-md bg-primary/15 px-2 py-1.5 text-xs text-primary"
                  >
                    <p className="font-medium tabular-nums">
                      {r.startTime}–{r.endTime}
                    </p>
                    <p className="text-[0.65rem] text-primary/80">
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
          <h2 className="mb-4 font-semibold">{t("addWindow")}</h2>
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
              <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endTime">{t("end")}</Label>
              <Input id="endTime" name="endTime" type="time" defaultValue="17:00" required />
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
          {error && <p className="mt-2 text-sm text-destructive">{t(`error.${error}`)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
