"use server"

// ============================================================
// Subscription checkout — starts a Moyasar subscription for the
// signed-in owner's business and returns the hosted-payment URL.
// ============================================================

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSubscription } from "@/lib/payment"
import type { PlanTier } from "@prisma/client"

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

function moyasarConfigured() {
  const key = process.env.MOYASAR_SECRET_KEY
  return !!key && !key.startsWith("TODO")
}

export async function startCheckout(tier: PlanTier): Promise<CheckoutResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "unauthorized" }
  if (!session.user.businessId) return { ok: false, error: "noBusiness" }

  const plan = await prisma.plan.findUnique({ where: { tier } })
  if (!plan) return { ok: false, error: "planNotFound" }

  if (!moyasarConfigured()) {
    // No real Moyasar key yet — surface a clear message instead of crashing.
    return { ok: false, error: "paymentsNotConfigured" }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  try {
    const sub = (await createSubscription({
      planId: plan.id,
      businessId: session.user.businessId,
      amount: Math.round(plan.priceMonthly * 100), // SAR → halalas
      description: `NXBook ${plan.nameEn} — monthly`,
      callbackUrl: `${appUrl}/dashboard?subscribed=1`,
    })) as { url?: string; source?: { transaction_url?: string } }
    const url = sub?.url ?? sub?.source?.transaction_url
    if (!url) return { ok: false, error: "noCheckoutUrl" }
    return { ok: true, url }
  } catch {
    return { ok: false, error: "checkoutFailed" }
  }
}
