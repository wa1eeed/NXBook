import { notFound } from "next/navigation"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { Locale } from "@/i18n/config"
import { AvailabilityClient, type AvailRow } from "./availability-client"

export default async function ServiceAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireBusiness()
  const locale = (await getLocale()) as Locale
  const t = await getTranslations("availability")

  const service = await prisma.service.findFirst({
    where: { id, businessId: ctx.businessId, isActive: true },
    include: { availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  })
  if (!service) notFound()

  const title = locale === "ar" && service.nameAr ? service.nameAr : service.nameEn
  const rows: AvailRow[] = service.availability.map((a) => ({
    id: a.id,
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
    slotMin: a.slotMin,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/services"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>
      <AvailabilityClient serviceId={service.id} rows={rows} />
    </div>
  )
}
