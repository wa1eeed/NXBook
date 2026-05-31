import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CalendarCheck, ShieldCheck, Clock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { resolveTheme } from "@/lib/theme"
import { ThemeScope } from "@/components/theme/theme-provider"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { BookingFlow, type PublicService } from "./booking-flow"

// Public tenant booking portal. Resolves the business by slug (direct
// /{slug} or via the subdomain/custom-domain rewrite in middleware.ts),
// renders branding + the booking flow. Uses the tenant's brand color as
// a soft tinted header so each business feels on-brand.
export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const t = await getTranslations("booking")

  const business = await prisma.business.findFirst({
    where: { slug, isActive: true },
    include: {
      services: {
        where: { isActive: true, isVisible: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!business) notFound()

  const theme = resolveTheme(business.themeConfig)
  const accent = business.brandColor
  const services: PublicService[] = business.services.map((s) => ({
    id: s.id,
    nameEn: s.nameEn,
    nameAr: s.nameAr,
    descriptionEn: s.descriptionEn,
    descriptionAr: s.descriptionAr,
    durationMin: s.durationMin,
    price: s.price,
    maxCapacity: s.maxCapacity,
  }))

  const trust = [
    { icon: CalendarCheck, text: t("trustInstant") },
    { icon: Clock, text: t("trustReminders") },
    { icon: ShieldCheck, text: t("trustSecure") },
  ]

  return (
    <ThemeScope theme={theme} className="min-h-screen bg-muted/20">
      {/* Brand-tinted hero */}
      <header
        className="relative"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 16%, transparent), transparent)`,
        }}
      >
        <div className="absolute end-4 top-4">
          <LocaleSwitcher />
        </div>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 pb-8 pt-16 text-center">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt={business.name}
              className="size-24 rounded-3xl object-cover shadow-soft"
            />
          ) : (
            <div
              className="flex size-24 items-center justify-center rounded-3xl text-3xl font-bold text-white shadow-soft"
              style={{ backgroundColor: accent }}
            >
              {business.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold sm:text-4xl">{business.name}</h1>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {trust.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <item.icon className="size-4" style={{ color: accent }} />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          {services.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("noServices")}
            </p>
          ) : (
            <BookingFlow
              slug={slug}
              services={services}
              accent={accent}
              paymentEnabled={business.paymentEnabled}
              depositPercent={business.depositPercent}
              cancellationHours={business.cancellationHours}
            />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("poweredBy")}
        </p>
      </main>
    </ThemeScope>
  )
}
