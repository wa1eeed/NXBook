"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  Scissors,
  LayoutGrid,
  List,
  Users,
  Coins,
  CreditCard,
  MapPin,
} from "lucide-react"
import { ServiceForm, type ServiceInitial } from "./service-form"
import { deleteService } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { MotionList, MotionItem } from "@/components/ui/motion-list"
import { cn } from "@/lib/utils"

export interface ServiceRow extends Omit<ServiceInitial, "paymentMode"> {
  availabilityCount: number
  // From DB this is always set (default ON_ARRIVAL); make the row type
  // require it so display components don't need to default.
  paymentMode: "ON_ARRIVAL" | "ONLINE"
}

export function ServicesClient({ services }: { services: ServiceRow[] }) {
  const t = useTranslations("services")
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState<ServiceInitial | "new" | null>(null)
  const [view, setView] = useState<"grid" | "list">("list")
  const [pending, startTransition] = useTransition()

  function onDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return
    startTransition(async () => {
      const res = await deleteService(id)
      if (res.ok) {
        toast.success(t("deleted"))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  function startEdit(s: ServiceRow) {
    setEditing({
      id: s.id,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      descriptionEn: s.descriptionEn,
      descriptionAr: s.descriptionAr,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      price: s.price,
      maxCapacity: s.maxCapacity,
      isVisible: s.isVisible,
      paymentMode: s.paymentMode,
    })
  }

  function PaymentBadge({ mode }: { mode: "ON_ARRIVAL" | "ONLINE" }) {
    const isOnline = mode === "ONLINE"
    const Icon = isOnline ? CreditCard : MapPin
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          isOnline
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
        )}
      >
        <Icon className="size-3" />
        {isOnline ? t("badgeOnline") : t("badgeOnArrival")}
      </span>
    )
  }

  function VisibilityBadge({ visible }: { visible: boolean }) {
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          visible
            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {visible ? t("visibleLabel") : t("hiddenLabel")}
      </span>
    )
  }

  function RowActions({ s }: { s: ServiceRow }) {
    const noAvailability = s.availabilityCount === 0
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant={noAvailability ? "default" : "ghost"}
          size="sm"
          asChild
          // Pulse-highlight services that aren't bookable yet — they need
          // availability windows before customers can pick them.
        >
          <Link href={`/dashboard/services/${s.id}${noAvailability ? "?new=1" : ""}`}>
            <Clock className="size-4" />
            {noAvailability
              ? t("addAvailability")
              : t("availability", { n: s.availabilityCount })}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label={t("editService")}
          onClick={() => startEdit(s)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label={t("cancel")}
          onClick={() => onDelete(s.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                type="button"
                aria-label={t("viewGrid")}
                onClick={() => setView("grid")}
                className={cn(
                  "flex size-8 items-center justify-center rounded transition-colors",
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("viewList")}
                onClick={() => setView("list")}
                className={cn(
                  "flex size-8 items-center justify-center rounded transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-4" />
              </button>
            </div>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              {t("addService")}
            </Button>
          </div>
        }
      />

      {editing && (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <h2 className="mb-4 font-semibold">
              {editing === "new" ? t("addService") : t("editService")}
            </h2>
            <ServiceForm
              initial={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      )}

      {services.length === 0 && !editing ? (
        <EmptyState
          icon={Scissors}
          title={t("empty")}
          description={t("emptyDesc")}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              {t("addService")}
            </Button>
          }
        />
      ) : view === "grid" ? (
        <MotionList
          key="grid"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((s) => {
            const title = locale === "ar" && s.nameAr ? s.nameAr : s.nameEn
            return (
              <MotionItem key={s.id}>
                <Card className="h-full transition-shadow hover:shadow-soft">
                  <CardContent className="flex h-full flex-col gap-3 py-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold">{title}</p>
                      <VisibilityBadge visible={s.isVisible} />
                    </div>
                    {s.price > 0 && (
                      <div className="-mt-1">
                        <PaymentBadge mode={s.paymentMode} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {s.durationMin}m
                        {s.bufferMin > 0 && ` +${s.bufferMin}m`}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="size-3.5" />
                        {s.price} SAR
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {t("capacity", { n: s.maxCapacity })}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        {t("availability", { n: s.availabilityCount })}
                      </span>
                      <RowActions s={s} />
                    </div>
                  </CardContent>
                </Card>
              </MotionItem>
            )
          })}
        </MotionList>
      ) : (
        <MotionList key="list" className="flex flex-col gap-3">
          {services.map((s) => {
            const title = locale === "ar" && s.nameAr ? s.nameAr : s.nameEn
            return (
              <MotionItem key={s.id}>
                <Card className="transition-shadow hover:shadow-soft">
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{title}</p>
                        <VisibilityBadge visible={s.isVisible} />
                        {s.price > 0 && <PaymentBadge mode={s.paymentMode} />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.durationMin}m
                        {s.bufferMin > 0 && ` +${s.bufferMin}m`} · {s.price} SAR ·{" "}
                        {t("capacity", { n: s.maxCapacity })}
                      </p>
                    </div>
                    <RowActions s={s} />
                  </CardContent>
                </Card>
              </MotionItem>
            )
          })}
        </MotionList>
      )}
    </div>
  )
}
