// ============================================================
// Subscription guard — checks whether the tenant's subscription
// is valid. Called from the dashboard layout to enforce trial
// expiry and payment gates.
// ============================================================

import { prisma } from "@/lib/prisma"

export type SubscriptionAccess =
  | { status: "OK" }
  | { status: "TRIALING"; trialEndsAt: Date; daysLeft: number }
  | { status: "GRACE_PERIOD"; expiresAt: Date; hoursLeft: number }
  | { status: "EXPIRED" }
  | { status: "SUSPENDED" }
  | { status: "NO_SUBSCRIPTION" }

/**
 * Check the subscription access status for a business.
 * Returns structured access info — the caller decides how to act.
 */
export async function checkSubscriptionAccess(
  businessId: string,
): Promise<SubscriptionAccess> {
  // FAIL-OPEN: the subscription guard must NEVER hard-crash the dashboard.
  // If the query fails (e.g. a pending migration during a deploy window),
  // grant access rather than locking every tenant out.
  const sub = await prisma.subscription
    .findUnique({
      where: { businessId },
      include: { plan: { select: { isTrialUpgradeForced: true } } },
    })
    .catch(() => null)

  if (!sub) return { status: "NO_SUBSCRIPTION" }

  const now = new Date()

  if (sub.status === "CANCELLED") return { status: "SUSPENDED" }

  if (sub.status === "ACTIVE") return { status: "OK" }

  if (sub.status === "TRIALING" && sub.trialEndsAt) {
    const diffMs = sub.trialEndsAt.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    // Trial still active
    if (diffMs > 0) {
      return { status: "TRIALING", trialEndsAt: sub.trialEndsAt, daysLeft }
    }

    // Trial ended — check grace period
    if (!sub.plan.isTrialUpgradeForced) {
      // Plan doesn't force upgrade — treat as ACTIVE
      return { status: "OK" }
    }

    const gracePeriodMs = sub.gracePeriodHours * 60 * 60 * 1000
    const graceExpiresAt = new Date(sub.trialEndsAt.getTime() + gracePeriodMs)
    const graceLeft = graceExpiresAt.getTime() - now.getTime()

    if (graceLeft > 0) {
      const hoursLeft = Math.ceil(graceLeft / (1000 * 60 * 60))
      return { status: "GRACE_PERIOD", expiresAt: graceExpiresAt, hoursLeft }
    }

    return { status: "EXPIRED" }
  }

  if (sub.status === "PAST_DUE") {
    return { status: "GRACE_PERIOD", expiresAt: sub.currentPeriodEnd, hoursLeft: 0 }
  }

  return { status: "OK" }
}
