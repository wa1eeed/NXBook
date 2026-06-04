"use server"

// ============================================================
// Settings server actions — business profile + custom domains.
// Tenant-scoped via requireBusiness(); writes are OWNER/MANAGER
// only and audit-logged. businessId never comes from the client.
// ============================================================

import { z } from "zod"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"
import { addCustomDomain, verifyDomain, removeCustomDomain } from "@/lib/domains"
import { LOCALE_COOKIE, isLocale } from "@/i18n/config"
import type { ThemeConfig } from "@/lib/theme"

export type ActionResult = { ok: true } | { ok: false; error: string }

const businessSchema = z.object({
  name: z.string().min(2).max(80),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultLocale: z.enum(["en", "ar"]),
})

export async function updateBusinessSettings(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor"),
    defaultLocale: formData.get("defaultLocale"),
  })
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      name: d.name,
      brandColor: d.brandColor,
      defaultLocale: d.defaultLocale,
    },
  })

  // Reflect the new default locale in the current session's UI.
  if (isLocale(d.defaultLocale)) {
    const store = await cookies()
    store.set(LOCALE_COOKIE, d.defaultLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
  }

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "business.update",
    targetType: "business",
    targetId: ctx.businessId,
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function addDomainAction(domain: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const res = await addCustomDomain(ctx.businessId, domain)
  if (!res.ok) return { ok: false, error: res.error }

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "domain.add",
    targetType: "domain",
    targetId: res.id,
    metadata: { domain },
  })
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

export async function verifyDomainAction(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const res = await verifyDomain(ctx.businessId, id)
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "domain.verify",
    targetType: "domain",
    targetId: id,
    metadata: { result: res.ok ? "verified" : "failed" },
  })
  revalidatePath("/dashboard/settings")
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export async function removeDomainAction(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  await removeCustomDomain(ctx.businessId, id)
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "domain.remove",
    targetType: "domain",
    targetId: id,
  })
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

// ─── Appearance / theme ───────────────────────────────────

const themeSchema = z.object({
  preset: z.string().max(40),
  primary: z.string().max(120),
  secondary: z.string().max(120),
  radius: z.enum(["none", "sm", "md", "lg", "xl"]),
  mode: z.enum(["light", "dark", "system"]),
})

export async function updateThemeSettings(
  theme: ThemeConfig,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { themeConfig: parsed.data },
  })
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "business.theme",
    targetType: "business",
    targetId: ctx.businessId,
    metadata: { preset: parsed.data.preset, mode: parsed.data.mode },
  })
  // Re-render the themed layout immediately.
  revalidatePath("/", "layout")
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

// ─── Payment settings ─────────────────────────────────────

const paymentSchema = z.object({
  paymentEnabled: z.boolean(),
  depositPercent: z.number().int().min(0).max(100),
  cancellationHours: z.number().int().min(0).max(168),
  customerMessage: z.string().max(300).optional(),
})

export async function savePaymentSettingsAction(data: {
  paymentEnabled: boolean
  depositPercent: number
  cancellationHours: number
  customerMessage?: string
}): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      paymentEnabled: parsed.data.paymentEnabled,
      depositPercent: parsed.data.depositPercent,
      cancellationHours: parsed.data.cancellationHours,
      paymentConfig: parsed.data.customerMessage
        ? { customerMessage: parsed.data.customerMessage }
        : undefined,
    },
  })
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "business.paymentSettings",
    targetType: "business",
    targetId: ctx.businessId,
  })
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

// ─── Payment gateway connection ───────────────────────────
// Connect/disconnect a booking-payment gateway. Provider API keys
// are encrypted at rest (CLAUDE.md §7) and never returned to the
// client. NXBOOK_PAY uses the platform's own keys (no per-tenant
// credentials), so its keys are left empty here.

const gatewaySchema = z.object({
  provider: z.enum(["NXBOOK_PAY", "MOYASAR", "TAP", "PAYTABS"]),
  publicKey: z.string().max(400).optional(),
  secretKey: z.string().max(400).optional(),
  webhookSecret: z.string().max(400).optional(),
  config: z.record(z.string(), z.string()).optional(),
})

export async function connectGatewayAction(data: {
  provider: string
  publicKey?: string
  secretKey?: string
  webhookSecret?: string
  config?: Record<string, string>
}): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = gatewaySchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const p = parsed.data

  // External gateways require at least a secret key to be usable.
  if (p.provider !== "NXBOOK_PAY" && !p.secretKey) {
    return { ok: false, error: "gatewayError" }
  }

  const { encryptSecret } = await import("@/lib/crypto")
  const encrypt = (v?: string) => (v ? encryptSecret(v) : null)
  const configJson = p.config
    ? (p.config as import("@prisma/client").Prisma.InputJsonValue)
    : undefined

  await prisma.paymentGateway.upsert({
    where: { businessId: ctx.businessId },
    create: {
      businessId: ctx.businessId,
      provider: p.provider,
      isActive: true,
      publicKey: encrypt(p.publicKey),
      secretKey: encrypt(p.secretKey),
      webhookSecret: encrypt(p.webhookSecret),
      config: configJson,
    },
    update: {
      provider: p.provider,
      isActive: true,
      publicKey: encrypt(p.publicKey),
      secretKey: encrypt(p.secretKey),
      webhookSecret: encrypt(p.webhookSecret),
      config: configJson,
    },
  })

  // Mirror the active provider onto the Business so the booking flow can
  // tag transactions even before the gateway is resolved.
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { paymentProvider: p.provider },
  })

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "gateway.connect",
    targetType: "paymentGateway",
    targetId: ctx.businessId,
    metadata: { provider: p.provider },
  })
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

export async function disconnectGatewayAction(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  await prisma.paymentGateway.updateMany({
    where: { businessId: ctx.businessId },
    data: { isActive: false, publicKey: null, secretKey: null, webhookSecret: null },
  })
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "gateway.disconnect",
    targetType: "paymentGateway",
    targetId: ctx.businessId,
  })
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

// ─── Public-page config (Phase 5) ─────────────────────────────

const urlOrEmpty = z.string().trim().max(300).optional().or(z.literal(""))

const publicPageSchema = z.object({
  social: z.object({
    instagram: urlOrEmpty,
    twitter: urlOrEmpty,
    snapchat: urlOrEmpty,
    tiktok: urlOrEmpty,
    linkedin: urlOrEmpty,
    website: urlOrEmpty,
    whatsapp: urlOrEmpty,
  }),
  location: z.object({
    googleMaps: urlOrEmpty,
    address: z.string().trim().max(300).optional().or(z.literal("")),
  }),
  meeting: z.object({
    type: z.enum(["in_person", "google_meet", "microsoft_teams", "zoom", "custom"]),
    url: urlOrEmpty,
  }),
})

export type PublicPageInput = z.infer<typeof publicPageSchema>

export async function savePublicPageAction(
  data: PublicPageInput,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = publicPageSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  // Strip empty strings so JSON stays clean.
  const clean = (obj: Record<string, string | undefined>) =>
    Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v && v.length > 0),
    )

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      socialLinks: clean(d.social),
      locationUrl: clean(d.location),
      meetingConfig: { type: d.meeting.type, ...(d.meeting.url ? { url: d.meeting.url } : {}) },
    },
  })

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "business.publicPage.update",
    targetType: "business",
    targetId: ctx.businessId,
  })

  revalidatePath("/dashboard/settings")
  return { ok: true }
}
