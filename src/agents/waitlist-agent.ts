import { prisma } from "@/lib/prisma"
import { AgentPlugin, type AgentContext, type AgentRunOutcome } from "./base"
import { safeGenerate } from "@/lib/ai-guard"
import { dispatchWhatsApp } from "@/lib/notify"
import { waitlistOfferBody } from "@/lib/messages-templates"
import type { Locale } from "@/i18n/config"

// Waitlist Agent — when a slot frees up it crafts the offer message
// (AI-personalized when keys exist, template otherwise) and sends it.
// The actual queue advancement lives in src/lib/waitlist.ts; this agent
// owns the messaging + run accounting. Payload: { waitlistId }.
export class WaitlistAgent extends AgentPlugin {
  readonly type = "WAITLIST" as const
  readonly nameEn = "Waitlist Agent"
  readonly nameAr = "وكيل قائمة الانتظار"
  readonly descriptionEn =
    "Offers freed slots to the next person in line via WhatsApp."
  readonly descriptionAr =
    "يعرض المواعيد المتاحة على التالي في قائمة الانتظار عبر واتساب."
  readonly triggers = [{ kind: "event" as const, event: "slot_freed" }]
  readonly minPlan = "GROWTH" as const
  readonly defaultConfig = { offerWindowMinutes: 30, tone: "friendly" }

  async execute(ctx: AgentContext): Promise<AgentRunOutcome> {
    const waitlistId = String(ctx.payload?.waitlistId ?? "")
    const entry = await prisma.waitlist.findFirst({
      where: { id: waitlistId, businessId: ctx.businessId },
      include: {
        customer: true,
        business: { select: { name: true, defaultLocale: true } },
      },
    })
    if (!entry) {
      return { summary: "waitlist entry not found", messagesSent: 0, costSar: 0, inputTokens: 0, outputTokens: 0 }
    }

    const service = await prisma.service.findUnique({
      where: { id: entry.serviceId },
      select: { nameEn: true, nameAr: true },
    })
    const locale = entry.business.defaultLocale as Locale
    const serviceName =
      locale === "ar" && service?.nameAr ? service.nameAr : service?.nameEn ?? ""
    const windowMin = Number(ctx.config.offerWindowMinutes ?? 30)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const confirmUrl = `${appUrl}/waitlist/${entry.id}/confirm`
    const dateStr = entry.date.toISOString().slice(0, 10)

    const fallback = waitlistOfferBody(
      locale,
      {
        customerName: entry.customer.name,
        businessName: entry.business.name,
        serviceName,
        date: dateStr,
        time: entry.slotTime,
      },
      windowMin,
      confirmUrl,
    )

    const gen = await safeGenerate({
      businessId: ctx.businessId,
      agentType: "WAITLIST",
      tier: "fast",
      systemPrompt: `You write short, warm WhatsApp messages in ${
        locale === "ar" ? "Arabic" : "English"
      } offering a freshly-available appointment slot. Keep it under 4 lines, include the confirm link verbatim, and convey urgency about the ${windowMin}-minute window.`,
      userPrompt: `Customer: ${entry.customer.name}\nBusiness: ${entry.business.name}\nService: ${serviceName}\nDate: ${dateStr} ${entry.slotTime}\nConfirm link: ${confirmUrl}`,
      fallback,
    })

    await dispatchWhatsApp({
      businessId: ctx.businessId,
      to: entry.customer.phone,
      type: "waitlist_offer",
      body: gen.text,
    })

    return {
      summary: `offered slot ${entry.slotTime} on ${dateStr} to ${entry.customer.name}${gen.usedAI ? " (AI)" : ""}`,
      messagesSent: 1,
      channel: "WHATSAPP",
      costSar: gen.costSar,
      inputTokens: gen.inputTokens,
      outputTokens: gen.outputTokens,
    }
  }
}
