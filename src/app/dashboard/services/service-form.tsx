"use client"

// Create/edit service dialog-ish form (inline panel). Bilingual fields,
// buffer + capacity per CLAUDE.md §11. Submits to server actions.
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { createService, updateService, type ActionResult } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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

  function submit(formData: FormData) {
    setError("")
    startTransition(async () => {
      const res: ActionResult = initial
        ? await updateService(initial.id, formData)
        : await createService(formData)
      if (res.ok) {
        router.refresh()
        onDone()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
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
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  )
}
