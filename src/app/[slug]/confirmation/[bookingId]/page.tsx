// Public booking confirmation page — celebratory design with full
// booking details, location / meeting link, calendar + share buttons,
// and a cancel action. Resolves business by slug, booking by id (scoped).

import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { resolveTheme } from "@/lib/theme"
import { ThemeScope } from "@/components/theme/theme-provider"
import { ConfirmationClient } from "./confirmation-client"
import type { Locale } from "@/i18n/config"

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>
}) {
  const { slug, bookingId } = await params
  const locale = (await getLocale()) as Locale

  const business = await prisma.business.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true, name: true, slug: true, brandColor: true, themeConfig: true,
      locationUrl: true, meetingConfig: true,
    },
  })
  if (!business) notFound()

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: business.id },
    include: {
      service: { select: { nameEn: true, nameAr: true, durationMin: true } },
      staff: { select: { name: true } },
      customer: { select: { name: true } },
    },
  })
  if (!booking) notFound()

  const t = await getTranslations("confirmation")

  const serviceName =
    locale === "ar" && booking.service.nameAr
      ? booking.service.nameAr
      : booking.service.nameEn

  const asObj = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {}

  const location = asObj(business.locationUrl)
  const meeting = asObj(business.meetingConfig)

  return (
    <ThemeScope theme={resolveTheme(business.themeConfig)} className="min-h-screen bg-muted/20">
      <ConfirmationClient
        accent={business.brandColor}
        businessName={business.name}
        slug={business.slug}
        bookingId={booking.id}
        status={booking.status}
        serviceName={serviceName}
        durationMin={booking.service.durationMin}
        staffName={booking.staff?.name ?? null}
        customerName={booking.customer.name}
        date={booking.date.toISOString().slice(0, 10)}
        startTime={booking.startTime}
        endTime={booking.endTime}
        location={location}
        meeting={meeting}
      />
    </ThemeScope>
  )
}
