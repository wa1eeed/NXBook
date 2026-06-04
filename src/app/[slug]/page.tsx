import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  CalendarCheck, ShieldCheck, Clock, Camera, AtSign, Music,
  Hash, Share2, Globe, MessageCircle, MapPin,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { resolveTheme } from "@/lib/theme"
import { ThemeScope } from "@/components/theme/theme-provider"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { BookingFlow, type PublicService } from "./booking-flow"

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  instagram: Camera,
  twitter: AtSign,
  tiktok: Music,
  snapchat: Hash,
  linkedin: Share2,
  website: Globe,
}

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

  const asObj = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {}
  const social = asObj(business.socialLinks)
  const locationInfo = asObj(business.locationUrl)

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
    paymentMode: s.paymentMode,
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
              depositPercent={business.depositPercent}
              cancellationHours={business.cancellationHours}
            />
          )}
        </div>

        {/* Contact / social / location footer */}
        {(Object.keys(social).length > 0 ||
          locationInfo.googleMaps ||
          locationInfo.address ||
          social.whatsapp) && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center">
            {/* Social icons */}
            {Object.entries(SOCIAL_ICONS).some(([k]) => social[k]) && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {Object.entries(SOCIAL_ICONS).map(([key, Icon]) =>
                  social[key] ? (
                    <a
                      key={key}
                      href={social[key]}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={key}
                      className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground"
                      style={{ borderColor: `color-mix(in oklch, ${accent} 30%, transparent)` }}
                    >
                      <Icon className="size-4" />
                    </a>
                  ) : null,
                )}
              </div>
            )}

            {/* WhatsApp contact */}
            {social.whatsapp && (
              <a
                href={`https://wa.me/${social.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: accent }}
              >
                <MessageCircle className="size-4" />
                {t("contactWhatsApp")}
              </a>
            )}

            {/* Location */}
            {(locationInfo.address || locationInfo.googleMaps) && (
              <a
                href={locationInfo.googleMaps || undefined}
                target={locationInfo.googleMaps ? "_blank" : undefined}
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <MapPin className="size-4" />
                {locationInfo.address || t("viewLocation")}
              </a>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("poweredBy")}
        </p>
      </main>
    </ThemeScope>
  )
}
