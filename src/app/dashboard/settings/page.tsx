import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { resolveTheme } from "@/lib/theme"
import { SettingsClient, type DomainRow } from "./settings-client"

export default async function SettingsPage() {
  const ctx = await requireBusiness()

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: {
      name: true,
      brandColor: true,
      defaultLocale: true,
      themeConfig: true,
      paymentEnabled: true,
      depositPercent: true,
      cancellationHours: true,
      paymentConfig: true,
      socialLinks: true,
      locationUrl: true,
      meetingConfig: true,
    },
  })
  const domains = await prisma.customDomain.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "asc" },
    select: { id: true, domain: true, status: true, verifyToken: true },
  })
  const gateway = await prisma.paymentGateway.findUnique({
    where: { businessId: ctx.businessId },
    select: { provider: true, isActive: true, publicKey: true },
  })

  if (!business) return null

  const rows: DomainRow[] = domains.map((d) => ({
    id: d.id,
    domain: d.domain,
    status: d.status,
    verifyToken: d.verifyToken,
  }))

  const paymentConfig =
    business.paymentConfig &&
    typeof business.paymentConfig === "object" &&
    !Array.isArray(business.paymentConfig)
      ? (business.paymentConfig as { customerMessage?: string })
      : {}

  const asObj = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {}

  return (
    <SettingsClient
      business={{
        name: business.name,
        brandColor: business.brandColor,
        defaultLocale: business.defaultLocale,
      }}
      domains={rows}
      initialTheme={resolveTheme(business.themeConfig)}
      payment={{
        paymentEnabled: business.paymentEnabled,
        depositPercent: business.depositPercent,
        cancellationHours: business.cancellationHours,
        customerMessage: paymentConfig.customerMessage ?? "",
      }}
      gateway={{
        // Never expose stored secrets — only whether one is set + which provider.
        provider: gateway?.isActive ? gateway.provider : null,
        isActive: gateway?.isActive ?? false,
        publicKey: gateway?.isActive && gateway.publicKey ? "••••" : null,
      }}
      publicPage={{
        social: asObj(business.socialLinks),
        location: asObj(business.locationUrl),
        meeting: asObj(business.meetingConfig),
      }}
    />
  )
}
