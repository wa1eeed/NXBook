// ============================================================
// BullMQ queue definitions. Queues are created lazily on the
// shared ioredis connection (src/lib/redis.ts). Both the app
// (producer) and the workers process (consumer) import these
// names + payload types so they stay in sync.
// ============================================================

import { Queue, type ConnectionOptions } from "bullmq"

// BullMQ bundles its own ioredis copy, so passing our shared Redis
// instance trips a dual-version type clash. Instead we hand BullMQ a
// plain connection-options object built from REDIS_URL; BullMQ creates
// and manages its own connection from it.
export function bullConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379")
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

export const QUEUE_NAMES = {
  notification: "notification",
  reminder: "reminder",
  waitlist: "waitlist",
  agent: "agent",
} as const

// ─── Job payloads ──────────────────────────────────────────

export interface NotificationJob {
  kind:
    | "booking_confirmation"
    | "booking_reminder"
    | "waitlist_offer"
  businessId: string
  // The producer pre-resolves everything the message needs so the
  // worker can stay thin and not re-query unless it must.
  payload: Record<string, unknown>
}

export interface ReminderJob {
  bookingId: string
  hoursUntil: number // 24 or 1
}

export interface WaitlistExpiryJob {
  waitlistId: string
}

// Generic agent execution job — the worker hands it to runAgent().
export interface AgentJob {
  businessId: string
  type: string // AgentType
  triggeredBy: string
  payload?: Record<string, unknown>
}

// ─── Lazy singletons (avoid duplicate Queue instances on HMR) ──

type QueueGlobal = {
  __nxbookQueues?: Record<string, Queue>
}
const g = globalThis as unknown as QueueGlobal
g.__nxbookQueues ??= {}

function getQueue<T>(name: string): Queue<T> {
  if (!g.__nxbookQueues![name]) {
    g.__nxbookQueues![name] = new Queue(name, {
      connection: bullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    })
  }
  return g.__nxbookQueues![name] as Queue<T>
}

export const notificationQueue = () =>
  getQueue<NotificationJob>(QUEUE_NAMES.notification)
export const reminderQueue = () => getQueue<ReminderJob>(QUEUE_NAMES.reminder)
export const waitlistQueue = () =>
  getQueue<WaitlistExpiryJob>(QUEUE_NAMES.waitlist)
export const agentQueue = () => getQueue<AgentJob>(QUEUE_NAMES.agent)

/** True when Redis is reachable; producers should degrade gracefully if not. */
export function queuesEnabled(): boolean {
  return !!process.env.REDIS_URL
}
