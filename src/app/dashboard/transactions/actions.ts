"use server"

// ============================================================
// Transactions dashboard actions — tenant-scoped via
// requireBusiness(). Refunds call the tenant's gateway, mark the
// Transaction/Booking REFUNDED, and are audit-logged (CLAUDE.md §7).
// businessId always comes from the session, never the client.
// ============================================================

import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"
import { getPaymentProvider } from "@/lib/payment-gateway"

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function refundTransactionAction(
  txId: string,
  reason?: string,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const tx = await prisma.transaction.findFirst({
    where: { id: txId, businessId: ctx.businessId },
  })
  if (!tx || tx.status !== "PAID") return { ok: false, error: "notFound" }

  let refundSuccess = false
  if (tx.providerRef) {
    try {
      const provider = await getPaymentProvider(ctx.businessId)
      const r = await provider.refundPayment(tx.providerRef, tx.amount)
      refundSuccess = r.success
    } catch (err) {
      Sentry.captureException(err)
    }
  }

  // Mark refunded regardless of provider outcome — the owner intends it;
  // a failed provider refund is captured in the audit metadata.
  await prisma.transaction.update({
    where: { id: txId },
    data: { status: "REFUNDED" },
  })
  if (tx.bookingId) {
    await prisma.booking.update({
      where: { id: tx.bookingId },
      data: { paymentStatus: "REFUNDED" },
    })
  }
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "payment.refund",
    targetType: "transaction",
    targetId: txId,
    metadata: { reason: reason ?? "", providerSuccess: refundSuccess },
  })
  revalidatePath("/dashboard/transactions")
  return { ok: true }
}
