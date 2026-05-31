// ============================================================
// Booking-payment webhook (CLAUDE.md §7: verify signature, reject
// without it). SEPARATE from /api/webhooks/moyasar which handles
// subscriptions/credit top-ups. This route confirms (or fails) a
// booking Transaction created by initiateBookingPaymentAction.
//
// Flow: parse event → find our Transaction (via metadata) → load
// the owning business's gateway → verify the signature with that
// tenant's secret → flip Transaction + Booking → fire reminders.
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { prisma } from "@/lib/prisma"
import { getPaymentProvider } from "@/lib/payment-gateway"
import { onBookingCreated } from "@/lib/booking-lifecycle"
import { recordAudit } from "@/lib/audit"

// Extract our own metadata (transactionId/businessId) from a provider
// event so we can locate the Transaction before trusting anything else.
function extractMetadata(body: unknown): Record<string, string> | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  // Moyasar: { data: { metadata: { transactionId, businessId } } }
  const data = b.data as Record<string, unknown> | undefined
  const moyasarMeta = data?.metadata
  if (moyasarMeta && typeof moyasarMeta === "object") {
    return moyasarMeta as Record<string, string>
  }
  // Tap / others: { metadata: { ... } }
  if (b.metadata && typeof b.metadata === "object") {
    return b.metadata as Record<string, string>
  }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params
  const provider = providerParam.toUpperCase()
  const body = await req.text()

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const meta = extractMetadata(parsedBody)
    if (!meta?.transactionId) {
      // Unknown / unrelated event — acknowledge so the provider stops retrying.
      return NextResponse.json({ ok: true })
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: meta.transactionId },
    })
    if (!tx) return NextResponse.json({ ok: true })

    // Resolve the owning tenant's gateway and verify the signature with
    // THAT tenant's secret (never a client-supplied businessId).
    const gw = await prisma.paymentGateway.findUnique({
      where: { businessId: tx.businessId },
    })
    if (!gw) return NextResponse.json({ error: "Gateway not found" }, { status: 400 })

    const payProvider = await getPaymentProvider(tx.businessId)
    const sig =
      req.headers.get("x-moyasar-signature") ??
      req.headers.get("tap-signature") ??
      req.headers.get("signature") ??
      ""

    // Reject when a signature is present but invalid (CLAUDE.md §7).
    if (!sig || !payProvider.verifyWebhookSignature(body, sig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const event = payProvider.parseWebhookEvent(parsedBody)
    if (!event) return NextResponse.json({ ok: true })

    if (event.status === "PAID") {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "PAID", providerRef: event.providerRef },
      })
      if (tx.bookingId) {
        await prisma.booking.update({
          where: { id: tx.bookingId },
          data: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentReference: event.providerRef,
          },
        })
        // Send confirmation + schedule reminders (best-effort).
        onBookingCreated(tx.bookingId).catch((e) => Sentry.captureException(e))
      }
      await recordAudit({
        businessId: tx.businessId,
        actorId: "webhook",
        action: "payment.confirmed",
        targetType: "transaction",
        targetId: tx.id,
        metadata: { provider, amount: tx.amount },
      })
    }

    if (event.status === "FAILED") {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "FAILED" },
      })
      if (tx.bookingId) {
        await prisma.booking.update({
          where: { id: tx.bookingId },
          data: { paymentStatus: "UNPAID" },
        })
      }
      await recordAudit({
        businessId: tx.businessId,
        actorId: "webhook",
        action: "payment.failed",
        targetType: "transaction",
        targetId: tx.id,
        metadata: { provider },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
