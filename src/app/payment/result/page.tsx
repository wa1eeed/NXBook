// Public payment-result page. Reads ?ref=<transactionId>&slug=<slug>
// (&fallback=1 when the gateway couldn't be reached but the booking was
// kept). No auth: this is the customer's post-payment landing page.
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CheckCircle2, XCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; slug?: string; fallback?: string }>
}) {
  const { ref, slug, fallback } = await searchParams
  const t = await getTranslations("paymentResult")

  if (!ref) notFound()

  const tx = await prisma.transaction.findUnique({
    where: { id: ref },
    include: {
      business: { select: { name: true, slug: true, brandColor: true } },
      booking: {
        select: {
          date: true,
          startTime: true,
          service: { select: { nameEn: true } },
        },
      },
    },
  })

  if (!tx) notFound()

  // Fallback (gateway unreachable) counts as success — the booking is kept.
  const success = tx.status === "PAID" || fallback === "1"
  const accent = tx.business.brandColor
  const backSlug = slug ?? tx.business.slug
  const dateStr = tx.booking?.date
    ? `${tx.booking.date.toISOString().slice(0, 10)} · ${tx.booking.startTime}`
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <div
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: success
              ? `color-mix(in oklch, ${accent} 16%, transparent)`
              : "color-mix(in oklch, var(--destructive) 16%, transparent)",
          }}
        >
          {success ? (
            <CheckCircle2 className="size-8" style={{ color: accent }} />
          ) : (
            <XCircle className="size-8 text-destructive" />
          )}
        </div>

        <h1 className="text-xl font-bold">
          {success ? t("successTitle") : t("failTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {success ? t("successDesc") : t("failDesc")}
        </p>

        {success && (
          <dl className="mt-6 flex flex-col gap-2 rounded-xl border border-border p-4 text-start text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("bookingRef")}</dt>
              <dd className="font-mono text-xs">{tx.id.slice(-8)}</dd>
            </div>
            {tx.booking?.service && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("service")}</dt>
                <dd className="font-medium">{tx.booking.service.nameEn}</dd>
              </div>
            )}
            {dateStr && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("dateTime")}</dt>
                <dd className="font-medium">{dateStr}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("amount")}</dt>
              <dd className="font-semibold" style={{ color: accent }}>
                {tx.amount} {tx.currency}
              </dd>
            </div>
          </dl>
        )}

        <Link
          href={`/${backSlug}`}
          className="mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          {success
            ? t("backToBooking")
            : t("tryAgain")}
        </Link>
      </div>
    </main>
  )
}
