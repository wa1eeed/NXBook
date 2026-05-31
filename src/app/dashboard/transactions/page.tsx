import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { TransactionsClient, type TransactionRow } from "./transactions-client"

// Tenant booking-payment ledger. Scoped to the session's businessId
// (CLAUDE.md §5) — never a client-supplied id.
export default async function TransactionsPage() {
  const ctx = await requireBusiness()
  const locale = await getLocale()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [transactions, thisMonth, refunds] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        booking: {
          include: {
            customer: { select: { name: true } },
            service: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    }),
    prisma.transaction.aggregate({
      where: { businessId: ctx.businessId, status: "PAID", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.count({
      where: { businessId: ctx.businessId, status: "REFUNDED" },
    }),
  ])

  const localized = (en: string, ar: string | null) =>
    locale === "ar" && ar ? ar : en

  const rows: TransactionRow[] = transactions.map((tx) => ({
    id: tx.id,
    shortId: tx.id.slice(-8),
    customerName: tx.booking?.customer.name ?? null,
    serviceName: tx.booking?.service
      ? localized(tx.booking.service.nameEn, tx.booking.service.nameAr)
      : null,
    amount: tx.amount,
    currency: tx.currency,
    provider: tx.provider,
    providerRef: tx.providerRef,
    status: tx.status,
    type: tx.type,
    createdAt: tx.createdAt.toISOString(),
    bookingId: tx.bookingId,
  }))

  const revenueThisMonth = thisMonth._sum.amount ?? 0
  const successful = thisMonth._count
  const avgBooking = successful > 0 ? revenueThisMonth / successful : 0

  return (
    <TransactionsClient
      rows={rows}
      kpis={{
        revenueThisMonth,
        successful,
        refunds,
        avgBooking,
      }}
    />
  )
}
