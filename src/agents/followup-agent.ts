import { prisma } from "@/lib/prisma"
import { AgentPlugin, type AgentContext, type AgentRunOutcome } from "./base"
import { safeGenerate } from "@/lib/ai-guard"
import { dispatchWhatsApp } from "@/lib/notify"
import type { Locale } from "@/i18n/config"

// Follow-up Agent — fires a configurable delay after a customer
// attends, asking for feedback / a review. Payload: { bookingId }.
export class FollowupAgent extends AgentPlugin {
  readonly type = "FOLLOWUP" as const
  readonly nameEn = "Follow-up Agent"
  readonly nameAr = "وكيل المتابعة"
  readonly descriptionEn =
    "Messages customers after their visit to request feedback or a review."
  readonly descriptionAr =
    "يراسل العملاء بعد زيارتهم لطلب رأيهم أو تقييمهم."
  readonly triggers = [
    { kind: "delayed" as const, afterEvent: "booking_attended", delayMinutes: 120 },
  ]
  readonly minPlan = "GROWTH" as const
  readonly defaultConfig = { delayMinutes: 120, tone: "warm", askForReview: true }

  async execute(ctx: AgentContext): Promise<AgentRunOutcome> {
    const bookingId = String(ctx.payload?.bookingId ?? "")
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId: ctx.businessId, status: "ATTENDED" },
      include: {
        customer: true,
        service: { select: { nameEn: true, nameAr: true } },
        business: { select: { name: true, defaultLocale: true } },
      },
    })
    if (!booking) {
      return { summary: "no attended booking to follow up", messagesSent: 0, costSar: 0, inputTokens: 0, outputTokens: 0 }
    }
    if (booking.followupSent) {
      return { summary: "follow-up already sent", messagesSent: 0, costSar: 0, inputTokens: 0, outputTokens: 0 }
    }

    const locale = booking.business.defaultLocale as Locale
    const serviceName =
      locale === "ar" && booking.service.nameAr
        ? booking.service.nameAr
        : booking.service.nameEn

    const fallback =
      locale === "ar"
        ? `شكراً لزيارتك ${booking.customer.name}! 🌟\nنتمنى أن تكون تجربتك في ${booking.business.name} ممتازة.\nنسعد بسماع رأيك 🙏`
        : `Thanks for visiting, ${booking.customer.name}! 🌟\nWe hope your experience at ${booking.business.name} was great.\nWe'd love your feedback 🙏`

    const gen = await safeGenerate({
      businessId: ctx.businessId,
      agentType: "FOLLOWUP",
      tier: "fast",
      systemPrompt: `You write a brief, warm post-visit WhatsApp follow-up in ${
        locale === "ar" ? "Arabic" : "English"
      }. Thank the customer, ${ctx.config.askForReview ? "kindly ask for a quick review" : "invite feedback"}, keep it under 3 lines.`,
      userPrompt: `Customer: ${booking.customer.name}\nBusiness: ${booking.business.name}\nService: ${serviceName}`,
      fallback,
    })

    await dispatchWhatsApp({
      businessId: ctx.businessId,
      to: booking.customer.phone,
      type: "followup",
      body: gen.text,
    })

    await prisma.booking.update({
      where: { id: booking.id },
      data: { followupSent: true, followupSentAt: new Date() },
    })

    return {
      summary: `followed up with ${booking.customer.name}${gen.usedAI ? " (AI)" : ""}`,
      messagesSent: 1,
      channel: "WHATSAPP",
      costSar: gen.costSar,
      inputTokens: gen.inputTokens,
      outputTokens: gen.outputTokens,
    }
  }
}
