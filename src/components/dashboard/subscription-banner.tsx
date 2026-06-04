"use client"

// Shown at the top of every dashboard page when the subscription
// is in TRIALING (nearing end), GRACE_PERIOD, or EXPIRED state.

import Link from "next/link"
import { AlertTriangle, X, Clock, Zap } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface SubscriptionBannerProps {
  status: "TRIALING" | "GRACE_PERIOD" | "EXPIRED"
  daysLeft?: number
  hoursLeft?: number
}

export function SubscriptionBanner({ status, daysLeft, hoursLeft }: SubscriptionBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed && status !== "EXPIRED") return null

  const isExpired = status === "EXPIRED"
  const isGrace = status === "GRACE_PERIOD"
  const isTrialWarning = status === "TRIALING" && (daysLeft ?? 99) <= 3

  if (!isExpired && !isGrace && !isTrialWarning) return null

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-4 py-3 text-sm sm:items-center",
        isExpired
          ? "bg-red-600 text-white"
          : isGrace
            ? "bg-amber-500 text-white"
            : "bg-primary/10 text-primary border-b border-primary/20",
      )}
    >
      <span className="flex shrink-0 items-center">
        {isExpired ? <Zap className="size-4" /> : <Clock className="size-4" />}
      </span>

      <span className="flex-1">
        {isExpired && (
          <span>
            Your trial has ended.{" "}
            <Link href="/pricing" className="font-bold underline">
              Upgrade now
            </Link>{" "}
            to continue using NXBook.
          </span>
        )}
        {isGrace && hoursLeft !== undefined && (
          <span>
            Your trial ended. You have <strong>{hoursLeft} hours</strong> left in the grace period.{" "}
            <Link href="/pricing" className="font-bold underline">
              Upgrade now
            </Link>
            .
          </span>
        )}
        {isTrialWarning && daysLeft !== undefined && (
          <span>
            Your trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.{" "}
            <Link href="/pricing" className="font-bold underline">
              Upgrade to keep access
            </Link>
            .
          </span>
        )}
      </span>

      {!isExpired && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex shrink-0 size-6 items-center justify-center rounded-md opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
