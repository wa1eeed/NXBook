// ============================================================
// Agent trigger helpers — enqueue agent runs from domain events.
// Used by the app (producer side). The workers process consumes the
// agent queue and calls runAgent(). All no-op gracefully if Redis or
// the agent isn't available, so domain flows never break.
// ============================================================

import { prisma } from "@/lib/prisma"
import { agentQueue, queuesEnabled } from "@/lib/queue"
import type { AgentType } from "@prisma/client"

async function agentEnabled(businessId: string, type: AgentType): Promise<boolean> {
  const a = await prisma.agent.findUnique({
    where: { businessId_type: { businessId, type } },
    select: { isActive: true },
  })
  return !!a?.isActive
}

/** Schedule the Follow-up agent `delayMinutes` after a visit (default 120). */
export async function scheduleFollowup(
  businessId: string,
  bookingId: string,
): Promise<void> {
  if (!queuesEnabled()) return
  if (!(await agentEnabled(businessId, "FOLLOWUP"))) return

  const agent = await prisma.agent.findUnique({
    where: { businessId_type: { businessId, type: "FOLLOWUP" } },
    select: { config: true },
  })
  const delayMin = Number(
    (agent?.config as Record<string, unknown>)?.delayMinutes ?? 120,
  )

  await agentQueue().add(
    "followup",
    { businessId, type: "FOLLOWUP", triggeredBy: "booking_attended", payload: { bookingId } },
    { delay: delayMin * 60 * 1000 },
  )
}

/** Run the Waitlist agent immediately when a slot is offered. */
export async function triggerWaitlistAgent(
  businessId: string,
  waitlistId: string,
): Promise<void> {
  if (!queuesEnabled()) return
  if (!(await agentEnabled(businessId, "WAITLIST"))) return
  await agentQueue().add("waitlist", {
    businessId,
    type: "WAITLIST",
    triggeredBy: "slot_freed",
    payload: { waitlistId },
  })
}
