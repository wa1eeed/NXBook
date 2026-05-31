// ============================================================
// Booking payment gateways — abstract provider interface +
// per-provider implementations (Moyasar / Tap / PayTabs, plus
// "NXBook Pay" which uses the platform's own Moyasar keys).
//
// This is SEPARATE from src/lib/payment.ts, which owns Moyasar
// SUBSCRIPTION + credit top-up billing. This module handles
// booking deposits/payments only. Per-tenant gateway credentials
// are stored encrypted (crypto.ts) and resolved per businessId.
// ============================================================

import { createHmac } from "crypto"
import { prisma } from "./prisma"
import { decryptSecret } from "./crypto"

export interface PaymentCreateParams {
  amountSar: number
  description: string
  callbackUrl: string
  metadata: Record<string, string>
}
export interface PaymentCreateResult {
  transactionUrl: string
  providerRef: string
}
export interface PaymentVerifyResult {
  status: "PAID" | "FAILED" | "PENDING"
  amountSar: number
  providerRef: string
}
export interface WebhookEvent {
  status: "PAID" | "FAILED"
  providerRef: string
  metadata: Record<string, string>
}

export abstract class PaymentProvider {
  abstract createPayment(params: PaymentCreateParams): Promise<PaymentCreateResult>
  abstract verifyPayment(providerRef: string): Promise<PaymentVerifyResult>
  abstract refundPayment(providerRef: string, amountSar: number): Promise<{ success: boolean }>
  abstract verifyWebhookSignature(payload: string, sig: string): boolean
  abstract parseWebhookEvent(body: unknown): WebhookEvent | null
}

// ─── Moyasar ───────────────────────────────────────────────

class MoyasarProvider extends PaymentProvider {
  private secretKey: string
  private webhookSecret: string

  constructor(secretKey: string, webhookSecret: string) {
    super()
    this.secretKey = secretKey
    this.webhookSecret = webhookSecret
  }

  private auth() {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`
  }

  private async fetch(path: string, opts?: RequestInit) {
    const res = await fetch(`https://api.moyasar.com/v1${path}`, {
      ...opts,
      headers: {
        Authorization: this.auth(),
        "Content-Type": "application/json",
        ...opts?.headers,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Moyasar ${res.status}: ${JSON.stringify(err)}`)
    }
    return res.json()
  }

  async createPayment(params: PaymentCreateParams): Promise<PaymentCreateResult> {
    const data = await this.fetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(params.amountSar * 100),
        currency: "SAR",
        description: params.description,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
        source: { type: "creditcard" },
      }),
    })
    return { transactionUrl: data.source?.transaction_url ?? data.url, providerRef: data.id }
  }

  async verifyPayment(providerRef: string): Promise<PaymentVerifyResult> {
    const data = await this.fetch(`/payments/${providerRef}`)
    const status = data.status === "paid" ? "PAID" : data.status === "failed" ? "FAILED" : "PENDING"
    return { status, amountSar: data.amount / 100, providerRef: data.id }
  }

  async refundPayment(providerRef: string, amountSar: number): Promise<{ success: boolean }> {
    try {
      await this.fetch(`/payments/${providerRef}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount: Math.round(amountSar * 100) }),
      })
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  verifyWebhookSignature(payload: string, sig: string): boolean {
    const expected = createHmac("sha256", this.webhookSecret).update(payload).digest("hex")
    return expected === sig
  }

  parseWebhookEvent(body: unknown): WebhookEvent | null {
    const ev = body as { type?: string; data?: { id?: string; status?: string; metadata?: Record<string, string> } }
    if (!ev?.type || !ev.data?.id) return null
    if (ev.type === "payment.paid") return { status: "PAID", providerRef: ev.data.id, metadata: ev.data.metadata ?? {} }
    if (ev.type === "payment.failed") return { status: "FAILED", providerRef: ev.data.id, metadata: ev.data.metadata ?? {} }
    return null
  }
}

// ─── Tap ───────────────────────────────────────────────────

class TapProvider extends PaymentProvider {
  private secretKey: string
  private webhookSecret: string

  constructor(secretKey: string, webhookSecret: string) {
    super()
    this.secretKey = secretKey
    this.webhookSecret = webhookSecret
  }

  private async fetch(path: string, opts?: RequestInit) {
    const res = await fetch(`https://api.tap.company/v2${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json", ...opts?.headers },
    })
    if (!res.ok) throw new Error(`Tap ${res.status}: ${await res.text()}`)
    return res.json()
  }

  async createPayment(params: PaymentCreateParams): Promise<PaymentCreateResult> {
    const data = await this.fetch("/charges", {
      method: "POST",
      body: JSON.stringify({
        amount: params.amountSar,
        currency: "SAR",
        description: params.description,
        redirect: { url: params.callbackUrl },
        metadata: params.metadata,
        source: { id: "src_all" },
      }),
    })
    return { transactionUrl: data.transaction?.url ?? data.url, providerRef: data.id }
  }

  async verifyPayment(providerRef: string): Promise<PaymentVerifyResult> {
    const data = await this.fetch(`/charges/${providerRef}`)
    const status = data.status === "CAPTURED" ? "PAID" : data.status === "DECLINED" ? "FAILED" : "PENDING"
    return { status, amountSar: data.amount, providerRef: data.id }
  }

  async refundPayment(providerRef: string, amountSar: number): Promise<{ success: boolean }> {
    try {
      await this.fetch("/refunds", { method: "POST", body: JSON.stringify({ charge_id: providerRef, amount: amountSar, currency: "SAR" }) })
      return { success: true }
    } catch { return { success: false } }
  }

  verifyWebhookSignature(payload: string, sig: string): boolean {
    const expected = createHmac("sha256", this.webhookSecret).update(payload).digest("hex")
    return expected === sig
  }

  parseWebhookEvent(body: unknown): WebhookEvent | null {
    const ev = body as { status?: string; id?: string; metadata?: Record<string, string> }
    if (!ev?.id) return null
    if (ev.status === "CAPTURED") return { status: "PAID", providerRef: ev.id, metadata: ev.metadata ?? {} }
    if (ev.status === "DECLINED") return { status: "FAILED", providerRef: ev.id, metadata: ev.metadata ?? {} }
    return null
  }
}

// ─── PayTabs ───────────────────────────────────────────────

class PayTabsProvider extends PaymentProvider {
  private serverKey: string
  private profileId: string

  constructor(serverKey: string, profileId: string) {
    super()
    this.serverKey = serverKey
    this.profileId = profileId
  }

  private async fetch(path: string, body: unknown) {
    const res = await fetch(`https://secure.paytabs.com${path}`, {
      method: "POST",
      headers: { Authorization: this.serverKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PayTabs ${res.status}: ${await res.text()}`)
    return res.json()
  }

  async createPayment(params: PaymentCreateParams): Promise<PaymentCreateResult> {
    const data = await this.fetch("/payment/request", {
      profile_id: this.profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: params.metadata.bookingId ?? "booking",
      cart_description: params.description,
      cart_amount: params.amountSar,
      cart_currency: "SAR",
      callback: params.callbackUrl,
      return: params.callbackUrl,
    })
    return { transactionUrl: data.redirect_url, providerRef: data.tran_ref }
  }

  async verifyPayment(providerRef: string): Promise<PaymentVerifyResult> {
    const data = await this.fetch("/payment/query", { profile_id: this.profileId, tran_ref: providerRef })
    const status = data.payment_result?.response_status === "A" ? "PAID" : "FAILED"
    return { status, amountSar: data.cart_amount ?? 0, providerRef }
  }

  async refundPayment(providerRef: string, amountSar: number): Promise<{ success: boolean }> {
    try {
      await this.fetch("/payment/refund", { profile_id: this.profileId, tran_type: "refund", tran_class: "ecom", tran_ref: providerRef, cart_amount: amountSar, cart_currency: "SAR", cart_id: "refund", cart_description: "Refund" })
      return { success: true }
    } catch { return { success: false } }
  }

  verifyWebhookSignature(_payload: string, sig: string): boolean {
    return sig === this.serverKey
  }

  parseWebhookEvent(body: unknown): WebhookEvent | null {
    const ev = body as { tran_ref?: string; payment_result?: { response_status?: string }; cart_id?: string }
    if (!ev?.tran_ref) return null
    const ok = ev.payment_result?.response_status === "A"
    return { status: ok ? "PAID" : "FAILED", providerRef: ev.tran_ref, metadata: { bookingId: ev.cart_id ?? "" } }
  }
}

// ─── Provider resolver ─────────────────────────────────────

export class PaymentNotConfiguredError extends Error {
  constructor() { super("Payment gateway not configured") }
}

export async function getPaymentProvider(businessId: string): Promise<PaymentProvider> {
  const gw = await prisma.paymentGateway.findUnique({ where: { businessId } })
  if (!gw || !gw.isActive) throw new PaymentNotConfiguredError()

  const decrypt = (v: string | null | undefined) => v ? decryptSecret(v) : ""

  switch (gw.provider) {
    case "NXBOOK_PAY":
    case "MOYASAR": {
      const secret = gw.provider === "NXBOOK_PAY"
        ? (process.env.NXBOOK_PAY_SECRET_KEY ?? "")
        : decrypt(gw.secretKey)
      const whSecret = gw.provider === "NXBOOK_PAY"
        ? (process.env.MOYASAR_WEBHOOK_SECRET ?? "")
        : decrypt(gw.webhookSecret)
      return new MoyasarProvider(secret, whSecret)
    }
    case "TAP":
      return new TapProvider(decrypt(gw.secretKey), decrypt(gw.webhookSecret))
    case "PAYTABS": {
      const cfg = (gw.config ?? {}) as { profileId?: string }
      return new PayTabsProvider(decrypt(gw.secretKey), cfg.profileId ?? "")
    }
    default:
      throw new PaymentNotConfiguredError()
  }
}
