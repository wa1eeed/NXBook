"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { motion } from "motion/react"
import {
  CreditCard, Calendar, CheckCircle2, AlertTriangle,
  ArrowUpRight, XCircle, RotateCcw, Receipt,
} from "lucide-react"
import { cancelSubscriptionAction, resumeSubscriptionAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  paidAt: string | null
  createdAt: string
}

export function BillingClient({
  planName,
  tier,
  priceMonthly,
  status,
  accessStatus,
  currentPeriodEnd,
  trialEndsAt,
  cancelAtPeriodEnd,
  invoices,
}: {
  planName: string
  tier: string
  priceMonthly: number
  status: string
  accessStatus: string
  currentPeriodEnd: string
  trialEndsAt: string | null
  cancelAtPeriodEnd: boolean
  invoices: Invoice[]
}) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      day: "numeric", month: "long", year: "numeric",
    })

  function cancel() {
    startTransition(async () => {
      const res = await cancelSubscriptionAction()
      if (res.ok) {
        toast.success(t("cancelled"))
        setConfirmCancel(false)
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  function resume() {
    startTransition(async () => {
      const res = await resumeSubscriptionAction()
      if (res.ok) {
        toast.success(t("resumed"))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  const isTrialing = status === "TRIALING"
  const statusColor =
    status === "ACTIVE"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "TRIALING"
        ? "text-blue-600 dark:text-blue-400"
        : status === "CANCELLED"
          ? "text-red-600 dark:text-red-400"
          : "text-amber-600 dark:text-amber-400"

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden shadow-soft">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <CreditCard className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("currentPlan")}
                    </p>
                    <h2 className="text-xl font-bold">{planName}</h2>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className={cn("flex items-center gap-1.5 font-medium", statusColor)}>
                    <span className="size-2 rounded-full bg-current" />
                    {t(`status.${status}`)}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {isTrialing && trialEndsAt
                      ? t("trialEnds", { date: fmtDate(trialEndsAt) })
                      : cancelAtPeriodEnd
                        ? t("endsOn", { date: fmtDate(currentPeriodEnd) })
                        : t("renewsOn", { date: fmtDate(currentPeriodEnd) })}
                  </span>
                </div>
              </div>
              <div className="text-end">
                <p className="text-3xl font-extrabold tabular-nums">
                  {priceMonthly} <span className="text-base font-normal text-muted-foreground">SAR{t("perMonth")}</span>
                </p>
              </div>
            </div>

            {/* Cancel-at-period-end notice */}
            {cancelAtPeriodEnd && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0" />
                {t("willCancel", { date: fmtDate(currentPeriodEnd) })}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/pricing">
                  <ArrowUpRight className="size-4" />
                  {t("changePlan")}
                </Link>
              </Button>
              {cancelAtPeriodEnd ? (
                <Button variant="outline" disabled={pending} onClick={resume}>
                  <RotateCcw className="size-4" />
                  {t("resume")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmCancel(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" />
                  {t("cancelSubscription")}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Cancel confirmation */}
      {confirmCancel && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <p className="font-semibold text-destructive">{t("confirmCancelTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("confirmCancelBody", { date: fmtDate(currentPeriodEnd) })}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)} disabled={pending}>
              {t("keepSubscription")}
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={cancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmCancelButton")}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Invoices */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">{t("invoiceHistory")}</h3>
          </div>
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noInvoices")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 text-start font-medium">{t("invoiceDate")}</th>
                    <th className="pb-2 text-start font-medium">{t("invoiceAmount")}</th>
                    <th className="pb-2 text-end font-medium">{t("invoiceStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 text-muted-foreground">{fmtDate(inv.createdAt)}</td>
                      <td className="py-3 font-medium tabular-nums">
                        {inv.amount} {inv.currency}
                      </td>
                      <td className="py-3 text-end">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            inv.status === "paid" || inv.paidAt
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                          )}
                        >
                          {(inv.status === "paid" || inv.paidAt) && <CheckCircle2 className="size-3" />}
                          {inv.paidAt ? t("paid") : inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
