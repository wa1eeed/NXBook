// ============================================================
// Payment Service — Moyasar
// Handles: subscriptions, credit top-up, webhooks
// ============================================================

import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"

const MOYASAR_API = "https://api.moyasar.com/v1"
const SECRET = process.env.MOYASAR_SECRET_KEY!

// ─── Base fetch with auth ─────────────────────────────────

async function moyasarFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${MOYASAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${SECRET}:`).toString("base64")}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Moyasar error ${res.status}: ${JSON.stringify(err)}`)
  }

  return res.json()
}

// ─── Types ─────────────────────────────────────────────────

export interface CreatePaymentParams {
  amount: number          // in halalas (SAR × 100)
  description: string
  callbackUrl: string
  metadata?: Record<string, string>
}

export interface CreateSubscriptionParams {
  planId: string
  businessId: string
  amount: number          // monthly in halalas
  description: string
  callbackUrl: string
}

// ─── One-time Payment (Credit Top-up) ─────────────────────

export async function createTopupPayment(params: {
  businessId: string
  amountSar: number       // e.g. 50, 100, 200
  callbackUrl: string
}) {
  const { businessId, amountSar, callbackUrl } = params

  const payment = await moyasarFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(amountSar * 100),   // SAR → halalas
      currency: "SAR",
      description: `شحن رصيد AI — ${amountSar} ريال`,
      callback_url: callbackUrl,
      metadata: {
        type: "credit_topup",
        businessId,
        amountSar: String(amountSar),
      },
      source: { type: "creditcard" },
    }),
  })

  return payment
}

// ─── Subscription Creation ─────────────────────────────────

export async function createSubscription(params: CreateSubscriptionParams) {
  const { planId, businessId, amount, description, callbackUrl } = params

  const subscription = await moyasarFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency: "SAR",
      description,
      interval: "monthly",
      callback_url: callbackUrl,
      metadata: { planId, businessId },
    }),
  })

  return subscription
}

// ─── Cancel Subscription ──────────────────────────────────

export async function cancelSubscription(moyasarSubId: string) {
  return moyasarFetch(`/subscriptions/${moyasarSubId}/cancel`, {
    method: "PUT",
  })
}

// ─── Webhook Handler ──────────────────────────────────────

export async function handleMoyasarWebhook(body: any): Promise<void> {
  const { type, data } = body

  try {
    switch (type) {
      case "payment.paid": {
        const meta = data.metadata ?? {}

        if (meta.type === "credit_topup") {
          // Top-up credit account
          const amountSar = parseFloat(meta.amountSar ?? "0")
          const businessId = meta.businessId

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const account = await tx.creditAccount.findUnique({
              where: { businessId },
            })
            if (!account) throw new Error(`No credit account: ${businessId}`)

            const newBalance = account.balance + amountSar

            await tx.creditAccount.update({
              where: { businessId },
              data: {
                balance: newBalance,
                totalTopup: { increment: amountSar },
              },
            })

            await tx.creditTx.create({
              data: {
                creditAccountId: account.id,
                type: "TOPUP",
                amount: amountSar,
                balanceAfter: newBalance,
                description: `شحن رصيد عبر Moyasar`,
                moyasarTxId: data.id,
              },
            })
          })
        }

        if (meta.type === "subscription_payment") {
          // Mark invoice paid
          await prisma.invoice.updateMany({
            where: { moyasarTxId: data.id },
            data: { status: "paid", paidAt: new Date() },
          })
        }
        break
      }

      case "payment.failed": {
        const meta = data.metadata ?? {}
        if (meta.businessId) {
          // Mark subscription past_due if subscription payment fails
          if (meta.type === "subscription_payment") {
            await prisma.subscription.updateMany({
              where: { business: { id: meta.businessId } },
              data: { status: "PAST_DUE" },
            })
          }
        }
        break
      }

      case "subscription.deactivated": {
        const moyasarSubId = data.id
        await prisma.subscription.updateMany({
          where: { moyasarSubId },
          data: { status: "CANCELLED" },
        })
        break
      }
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { webhookType: type, data } })
    throw err
  }
}

// ─── Verify Webhook Signature ─────────────────────────────

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require("crypto")
  const secret = process.env.MOYASAR_WEBHOOK_SECRET!
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  return expected === signature
}
