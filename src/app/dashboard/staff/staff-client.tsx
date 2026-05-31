"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Plus, Pencil, Trash2, UserCog } from "lucide-react"
import { createStaff, updateStaff, deleteStaff } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { MotionList, MotionItem } from "@/components/ui/motion-list"

export interface ServiceOption {
  id: string
  nameEn: string
  nameAr: string | null
}

export interface StaffRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  serviceIds: string[]
}

export function StaffClient({
  staff,
  services,
}: {
  staff: StaffRow[]
  services: ServiceOption[]
}) {
  const t = useTranslations("staff")
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState<StaffRow | "new" | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function svcLabel(s: ServiceOption) {
    return locale === "ar" && s.nameAr ? s.nameAr : s.nameEn
  }

  const svcById = new Map(services.map((s) => [s.id, svcLabel(s)]))

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  function submit(formData: FormData) {
    setError("")
    startTransition(async () => {
      const res =
        editing && editing !== "new"
          ? await updateStaff(editing.id, formData)
          : await createStaff(formData)
      if (res.ok) {
        toast.success(t("saved"))
        router.refresh()
        setEditing(null)
      } else {
        setError(res.error)
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  function onDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return
    startTransition(async () => {
      const res = await deleteStaff(id)
      if (res.ok) {
        toast.success(t("deleted"))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  const current = editing && editing !== "new" ? editing : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            {t("addStaff")}
          </Button>
        }
      />

      {editing && (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <h2 className="mb-4 font-semibold">
              {current ? t("editStaff") : t("addStaff")}
            </h2>
            <form action={submit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input id="name" name="name" defaultValue={current?.name} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input id="phone" name="phone" defaultValue={current?.phone ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" name="email" type="email" defaultValue={current?.email ?? ""} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("linkedServices")}</Label>
                <div className="flex flex-wrap gap-2">
                  {services.length === 0 && (
                    <span className="text-sm text-muted-foreground">{t("noServices")}</span>
                  )}
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        defaultChecked={current?.serviceIds.includes(s.id)}
                        className="size-4"
                      />
                      {svcLabel(s)}
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("saving") : t("save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {staff.length === 0 && !editing ? (
        <EmptyState
          icon={UserCog}
          title={t("empty")}
          description={t("emptyDesc")}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              {t("addStaff")}
            </Button>
          }
        />
      ) : (
        <MotionList className="flex flex-col gap-3">
          {staff.map((m) => (
            <MotionItem key={m.id}>
              <Card className="transition-shadow hover:shadow-soft">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{m.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[m.phone, m.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {m.serviceIds.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.serviceIds.map((id) => (
                            <span
                              key={id}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {svcById.get(id) ?? "—"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("servicesCount", { n: 0 })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("editStaff")}
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("cancel")}
                      onClick={() => onDelete(m.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </MotionItem>
          ))}
        </MotionList>
      )}
    </div>
  )
}
