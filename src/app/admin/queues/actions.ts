"use server"

// Super-admin BullMQ queue operations. Cross-tenant infra access behind
// requireSuperAdmin; the destructive flush is audit-logged (CLAUDE.md §7).
import { requireSuperAdmin } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"

const QUEUE_KEYS = ["notification", "reminder", "waitlist", "agent"] as const
export type QueueKey = (typeof QUEUE_KEYS)[number]

export interface QueueStat {
  name: QueueKey
  counts: Record<string, number>
  failed: { id: string; name: string; failedReason: string }[]
}

export type FlushResult = { ok: true } | { ok: false; error: string }

export async function getQueueStats(): Promise<QueueStat[]> {
  await requireSuperAdmin()

  try {
    const { QUEUE_NAMES, bullConnection } = await import("@/lib/queue")
    const { Queue } = await import("bullmq")
    const connection = bullConnection()

    return await Promise.all(
      QUEUE_KEYS.map(async (n) => {
        const q = new Queue(QUEUE_NAMES[n], { connection })
        const counts = await q.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "completed",
          "failed",
        )
        const failedJobs = await q.getFailed(0, 4)
        await q.close()
        return {
          name: n,
          counts: counts as Record<string, number>,
          failed: failedJobs.map((j) => ({
            id: String(j.id ?? ""),
            name: j.name,
            failedReason: j.failedReason ?? "",
          })),
        }
      }),
    )
  } catch {
    // Redis unreachable — degrade to empty stats rather than throwing.
    return QUEUE_KEYS.map((n) => ({ name: n, counts: {}, failed: [] }))
  }
}

export async function flushQueueAction(name: QueueKey): Promise<FlushResult> {
  const admin = await requireSuperAdmin()
  if (!QUEUE_KEYS.includes(name)) return { ok: false, error: "invalid" }

  try {
    const { QUEUE_NAMES, bullConnection } = await import("@/lib/queue")
    const { Queue } = await import("bullmq")
    const q = new Queue(QUEUE_NAMES[name], { connection: bullConnection() })
    await q.obliterate({ force: true })
    await q.close()
  } catch {
    return { ok: false, error: "failed" }
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "platform.queue.flush",
    targetType: "queue",
    targetId: name,
  })

  return { ok: true }
}
