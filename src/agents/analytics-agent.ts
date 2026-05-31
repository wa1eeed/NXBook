import { prisma } from "@/lib/prisma"
import { AgentPlugin, type AgentContext, type AgentRunOutcome } from "./base"
import { safeGenerate } from "@/lib/ai-guard"
import type { Locale } from "@/i18n/config"

// Analytics Agent — weekly report with ACTIONABLE recommendations.
// Surfaces the flagship metric: waitlist conversion / "revenue saved".
// Writes a cached Report row keyed by [businessId, type, period].
export class AnalyticsAgent extends AgentPlugin {
  readonly type = "ANALYTICS" as const
  readonly nameEn = "Analytics Agent"
  readonly nameAr = "وكيل التحليلات"
  readonly descriptionEn =
    "Weekly performance report with actionable recommendations."
  readonly descriptionAr = "تقرير أداء أسبوعي مع توصيات قابلة للتنفيذ."
  readonly triggers = [{ kind: "cron" as const, schedule: "0 8 * * 1" }] // Mon 08:00
  readonly minPlan = "GROWTH" as const
  readonly defaultConfig = { period: "weekly" }

  async execute(ctx: AgentContext): Promise<AgentRunOutcome> {
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 7)

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true, defaultLocale: true },
    })
    const locale = (business?.defaultLocale ?? "en") as Locale

    const [bookings, attended, noShows, cancelled, waitlistConfirmed, revenueRows] =
      await Promise.all([
        prisma.booking.count({
          where: { businessId: ctx.businessId, createdAt: { gte: since } },
        }),
        prisma.booking.count({
          where: { businessId: ctx.businessId, status: "ATTENDED", attendedAt: { gte: since } },
        }),
        prisma.booking.count({
          where: { businessId: ctx.businessId, status: "NO_SHOW", updatedAt: { gte: since } },
        }),
        prisma.booking.count({
          where: { businessId: ctx.businessId, status: "CANCELLED", cancelledAt: { gte: since } },
        }),
        prisma.waitlist.count({
          where: { businessId: ctx.businessId, status: "CONFIRMED", confirmedAt: { gte: since } },
        }),
        // Revenue from attended bookings in the window (service price).
        prisma.booking.findMany({
          where: { businessId: ctx.businessId, status: "ATTENDED", attendedAt: { gte: since } },
          select: { service: { select: { price: true } } },
        }),
      ])

    const revenue = revenueRows.reduce((s, b) => s + (b.service?.price ?? 0), 0)

    // Flagship metric: revenue saved = waitlist-recovered bookings × avg price.
    const avgPrice = attended > 0 ? revenue / attended : 0
    const revenueSaved = Math.round(waitlistConfirmed * avgPrice)
    const noShowRate = bookings > 0 ? Math.round((noShows / bookings) * 100) : 0

    const metrics = {
      period: "weekly",
      bookings,
      attended,
      noShows,
      cancelled,
      noShowRate,
      waitlistConfirmed,
      revenue: Math.round(revenue),
      revenueSaved,
    }

    const fallbackRecs =
      locale === "ar"
        ? `• معدل عدم الحضور ${noShowRate}% — فعّل التذكيرات لتقليله.\n• قائمة الانتظار استعادت ${revenueSaved} ريال هذا الأسبوع.\n• راجع أوقات الذروة لتحسين الجدولة.`
        : `• No-show rate is ${noShowRate}% — reminders can lower it.\n• The waitlist recovered ${revenueSaved} SAR this week.\n• Review peak hours to optimize scheduling.`

    const gen = await safeGenerate({
      businessId: ctx.businessId,
      agentType: "ANALYTICS",
      tier: "smart",
      maxTokens: 600,
      systemPrompt: `You are a booking-business analyst. Given weekly metrics, write 3-4 concise, ACTIONABLE recommendations in ${
        locale === "ar" ? "Arabic" : "English"
      }. Be specific and reference the numbers. Highlight waitlist "revenue saved".`,
      userPrompt: JSON.stringify(metrics),
      fallback: fallbackRecs,
    })

    // Period key like "2026-W22" (ISO-week-ish, good enough for caching).
    const period = `${now.getFullYear()}-W${Math.ceil(
      ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 +
        new Date(now.getFullYear(), 0, 1).getDay() +
        1) /
        7,
    )}`

    const report = await prisma.report.upsert({
      where: {
        businessId_type_period: {
          businessId: ctx.businessId,
          type: "weekly_analytics",
          period,
        },
      },
      update: { data: { metrics, recommendations: gen.text }, generatedAt: new Date() },
      create: {
        businessId: ctx.businessId,
        type: "weekly_analytics",
        period,
        data: { metrics, recommendations: gen.text },
      },
    })

    return {
      summary: `weekly report ${period}: ${bookings} bookings, ${revenueSaved} SAR saved by waitlist`,
      messagesSent: 0,
      data: { reportId: report.id, ...metrics },
      costSar: gen.costSar,
      inputTokens: gen.inputTokens,
      outputTokens: gen.outputTokens,
    }
  }
}
