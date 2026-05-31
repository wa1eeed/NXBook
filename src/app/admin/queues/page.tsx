import { requireSuperAdmin } from "@/lib/tenant"
import { getQueueStats } from "./actions"
import { QueuesClient } from "./queues-client"

// BullMQ queue monitor — initial stats rendered server-side, then the
// client auto-refreshes every 30s and supports per-queue flush.
export default async function AdminQueues() {
  await requireSuperAdmin()
  const initial = await getQueueStats()
  return <QueuesClient initial={initial} />
}
