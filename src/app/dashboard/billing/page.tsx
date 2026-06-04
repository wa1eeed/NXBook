// /dashboard/billing — current plan, renewal date, invoices, cancel.

import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { checkSubscriptionAccess } from "@/lib/subscription-guard"
import { BillingClient } from "./billing-client"

export default async function BillingPage() {
  const ctx = await requireBusiness()
  const locale = await getLocale()
  const t = await getTranslations("billing")

  const subscription = await prisma.subscription.findUnique({
    where: { businessId: ctx.businessId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 24 },
    },
  })

  const access = await checkSubscriptionAccess(ctx.businessId)

  const planName = subscription
    ? locale === "ar"
      ? subscription.plan.nameAr
      : subscription.plan.nameEn
    : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {!subscription ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center">
          <p className="text-muted-foreground">{t("noSubscription")}</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {t("choosePlan")}
          </Link>
        </div>
      ) : (
        <BillingClient
          planName={planName ?? subscription.plan.nameEn}
          tier={subscription.plan.tier}
          priceMonthly={subscription.plan.priceMonthly}
          status={subscription.status}
          accessStatus={access.status}
          currentPeriodEnd={subscription.currentPeriodEnd.toISOString()}
          trialEndsAt={subscription.trialEndsAt?.toISOString() ?? null}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          invoices={subscription.invoices.map((i) => ({
            id: i.id,
            amount: i.amount,
            currency: i.currency,
            status: i.status,
            paidAt: i.paidAt?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  )
}
