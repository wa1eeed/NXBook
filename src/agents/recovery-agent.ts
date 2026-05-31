import { prisma } from "@/lib/prisma"
import { AgentPlugin, type AgentContext, type AgentRunOutcome } from "./base"
import { safeGenerate } from "@/lib/ai-guard"
import { dispatchWhatsApp } from "@/lib/notify"
import type { Locale } from "@/i18n/config"

// Recovery Agent — weekly cron scan for customers who haven't visited
// in N days; sends a context-aware win-back message, prioritizing VIPs.
export class RecoveryAgent extends AgentPlugin {
  readonly type = "RECOVERY" as const
  readonly nameEn = "Recovery Agent"
  readonly nameAr = "وكيل الاستعادة"
  readonly descriptionEn =
    "Wins back customers who haven't booked in a while with a personal nudge."
  readonly descriptionAr =
    "يستعيد العملاء الذين انقطعوا عن الحجز برسالة شخصية."
  readonly triggers = [{ kind: "cron" as const, schedule: "0 10 * * 0" }] // Sun 10:00
  readonly minPlan = "GROWTH" as const
  readonly defaultConfig = { absentDays: 30, maxPerRun: 25, vipFirst: true }

  async execute(ctx: AgentContext): Promise<AgentRunOutcome> {
    const absentDays = Number(ctx.config.absentDays ?? 30)
    const maxPerRun = Number(ctx.config.maxPerRun ?? 25)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - absentDays)
    // Don't re-pester: skip anyone contacted by recovery in the last 30 days.
    const recoveryCooldown = new Date()
    recoveryCooldown.setDate(recoveryCooldown.getDate() - 30)

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true, defaultLocale: true },
    })
    const locale = (business?.defaultLocale ?? "en") as Locale

    const customers = await prisma.customer.findMany({
      where: {
        businessId: ctx.businessId,
        isBlocked: false,
        lastVisitAt: { not: null, lt: cutoff },
        OR: [{ lastRecoveryAt: null }, { lastRecoveryAt: { lt: recoveryCooldown } }],
      },
      orderBy: ctx.config.vipFirst
        ? [{ isVIP: "desc" }, { lastVisitAt: "asc" }]
        : [{ lastVisitAt: "asc" }],
      take: maxPerRun,
    })

    let sent = 0
    let cost = 0
    let inTok = 0
    let outTok = 0

    for (const c of customers) {
      const fallback =
        locale === "ar"
          ? `اشتقنا لك ${c.name}! 💙\nمر وقت منذ آخر زيارة لك في ${business?.name}.\nنسعد بعودتك — احجز موعدك القادم 🌟`
          : `We miss you, ${c.name}! 💙\nIt's been a while since your last visit to ${business?.name}.\nWe'd love to see you again — book your next visit 🌟`

      const gen = await safeGenerate({
        businessId: ctx.businessId,
        agentType: "RECOVERY",
        tier: "fast",
        systemPrompt: `You write a short, warm win-back WhatsApp message in ${
          locale === "ar" ? "Arabic" : "English"
        }. ${c.isVIP ? "This is a VIP — make them feel valued. " : ""}Keep it under 3 lines, friendly, no pushiness.`,
        userPrompt: `Customer: ${c.name}\nBusiness: ${business?.name}\nDays since last visit: ${absentDays}+`,
        fallback,
      })

      await dispatchWhatsApp({
        businessId: ctx.businessId,
        to: c.phone,
        type: "recovery",
        body: gen.text,
      })
      await prisma.customer.update({
        where: { id: c.id },
        data: { lastRecoveryAt: new Date() },
      })
      sent++
      cost += gen.costSar
      inTok += gen.inputTokens
      outTok += gen.outputTokens
    }

    return {
      summary: `scanned ${customers.length} lapsed customers, sent ${sent} win-back messages`,
      messagesSent: sent,
      channel: "WHATSAPP",
      costSar: cost,
      inputTokens: inTok,
      outputTokens: outTok,
    }
  }
}
