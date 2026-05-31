"use server"

// ============================================================
// Onboarding server actions: live slug availability + the final
// "complete onboarding" transaction that provisions the tenant.
// ============================================================

import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TEMPLATES } from "@/lib/templates"
import { isLocale, type Locale } from "@/i18n/config"
import type { BusinessType } from "@prisma/client"

// Slug: lowercase letters, digits, hyphens; 3–40 chars.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
const RESERVED = new Set([
  "www", "api", "admin", "app", "dashboard", "login", "register",
  "onboarding", "pricing", "about", "contact", "static", "assets",
])

export async function checkSlug(
  slug: string,
): Promise<{ available: boolean; reason?: string }> {
  const value = slug.trim().toLowerCase()
  if (!SLUG_RE.test(value)) return { available: false, reason: "format" }
  if (RESERVED.has(value)) return { available: false, reason: "reserved" }
  const existing = await prisma.business.findUnique({ where: { slug: value } })
  return existing ? { available: false, reason: "taken" } : { available: true }
}

const completeSchema = z.object({
  locale: z.string().refine(isLocale),
  type: z.enum(["CLINIC", "SALON", "FITNESS", "CONSULTING", "EDUCATION", "OTHER"]),
  name: z.string().min(2).max(80),
  slug: z.string().regex(SLUG_RE),
  logoUrl: z.string().url().optional().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export type CompleteResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

export async function completeOnboarding(
  input: z.infer<typeof completeSchema>,
): Promise<CompleteResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "unauthorized" }

  const parsed = completeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  const { locale, type, name, slug, logoUrl, brandColor } = parsed.data
  const userId = session.user.id

  // Guard: a user who already owns a business shouldn't re-onboard.
  const already = await prisma.businessMember.findFirst({ where: { userId } })
  if (already) return { ok: false, error: "alreadyOnboarded" }

  // Re-check slug inside the action (defends against races with the live check).
  const slugCheck = await checkSlug(slug)
  if (!slugCheck.available) return { ok: false, error: "slugUnavailable" }

  const template = TEMPLATES[type as BusinessType]
  const starter = await prisma.plan.findUnique({ where: { tier: "STARTER" } })

  try {
    const business = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name,
          slug,
          type: type as BusinessType,
          defaultLocale: locale as Locale,
          logoUrl: logoUrl || null,
          brandColor: brandColor || undefined,
          onboardingDone: true,
          members: { create: { userId, role: "OWNER" } },
          creditAccount: { create: {} },
          aiConfig: { create: {} },
        },
      })

      // 14-day trial subscription on the Starter plan, if a plan exists.
      if (starter) {
        const now = new Date()
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        await tx.subscription.create({
          data: {
            businessId: biz.id,
            planId: starter.id,
            status: "TRIALING",
            trialEndsAt: trialEnd,
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
          },
        })
      }

      // Seed the vertical template's services + their weekly availability.
      for (const [i, svc] of template.services.entries()) {
        await tx.service.create({
          data: {
            businessId: biz.id,
            nameEn: svc.nameEn,
            nameAr: svc.nameAr,
            durationMin: svc.durationMin,
            bufferMin: svc.bufferMin,
            price: svc.price,
            maxCapacity: svc.maxCapacity,
            sortOrder: i,
            availability: {
              create: template.hours.days.map((dayOfWeek) => ({
                dayOfWeek,
                startTime: template.hours.startTime,
                endTime: template.hours.endTime,
                slotMin: template.hours.slotMin,
              })),
            },
          },
        })
      }

      return biz
    })

    return { ok: true, slug: business.slug }
  } catch {
    return { ok: false, error: "createFailed" }
  }
}
