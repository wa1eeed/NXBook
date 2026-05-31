// ============================================================
// Workers process — runs separately from the Next.js app
// (npm run workers / its own container). Consumes BullMQ queues
// and runs node-cron sweeps. Per CLAUDE.md §10 trigger mechanisms:
//   - notification queue : send queued messages
//   - reminder queue     : 24h/1h booking reminders (delayed jobs)
//   - waitlist queue     : expire stale offers (delayed jobs)
//   - cron               : safety-net sweep for expired offers
// ============================================================

// Env is loaded via `tsx --env-file=.env.development` (see package.json
// "workers" script) locally, and via docker-compose env_file in prod.
import { Worker } from "bullmq"
import { CronJob } from "cron"
import { prisma } from "@/lib/prisma"
import {
  QUEUE_NAMES,
  bullConnection,
  type ReminderJob,
  type WaitlistExpiryJob,
  type AgentJob,
} from "@/lib/queue"
import { dispatchWhatsApp } from "@/lib/notify"
import { bookingReminderBody } from "@/lib/messages-templates"
import { expireOffer } from "@/lib/waitlist"
import { runAgent } from "@/agents/runner"
import { WaitlistStatus, BookingStatus, type AgentType } from "@prisma/client"
import type { Locale } from "@/i18n/config"

const connection = bullConnection()

function log(...args: unknown[]) {
  console.log(`[workers ${new Date().toISOString()}]`, ...args)
}

// ─── Reminder worker ───────────────────────────────────────
const reminderWorker = new Worker<ReminderJob>(
  QUEUE_NAMES.reminder,
  async (job) => {
    const { bookingId, hoursUntil } = job.data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        service: { select: { nameEn: true, nameAr: true } },
        business: { select: { name: true, defaultLocale: true } },
      },
    })
    if (!booking) return
    // Skip if the booking is no longer active.
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.NO_SHOW
    ) {
      return
    }

    const locale = booking.business.defaultLocale as Locale
    const serviceName =
      locale === "ar" && booking.service.nameAr
        ? booking.service.nameAr
        : booking.service.nameEn

    await dispatchWhatsApp({
      businessId: booking.businessId,
      to: booking.customer.phone,
      type: `reminder_${hoursUntil}h`,
      body: bookingReminderBody(
        locale,
        {
          customerName: booking.customer.name,
          businessName: booking.business.name,
          serviceName,
          date: booking.date.toISOString().slice(0, 10),
          time: booking.startTime,
        },
        hoursUntil,
      ),
    })

    await prisma.booking.update({
      where: { id: bookingId },
      data: hoursUntil === 24 ? { reminder24Sent: true } : { reminder1Sent: true },
    })
    log(`reminder_${hoursUntil}h sent for booking ${bookingId}`)
  },
  { connection },
)

// ─── Waitlist expiry worker ────────────────────────────────
const waitlistWorker = new Worker<WaitlistExpiryJob>(
  QUEUE_NAMES.waitlist,
  async (job) => {
    await expireOffer(job.data.waitlistId)
    log(`processed waitlist expiry for ${job.data.waitlistId}`)
  },
  { connection },
)

// ─── Notification worker (generic queued sends) ────────────
const notificationWorker = new Worker(
  QUEUE_NAMES.notification,
  async (job) => {
    const { businessId, payload } = job.data as {
      businessId: string
      payload: { to: string; body: string; type: string }
    }
    await dispatchWhatsApp({
      businessId,
      to: payload.to,
      body: payload.body,
      type: payload.type,
    })
  },
  { connection },
)

// ─── Agent worker (executes any enqueued agent run) ────────
const agentWorker = new Worker<AgentJob>(
  QUEUE_NAMES.agent,
  async (job) => {
    const { businessId, type, triggeredBy, payload } = job.data
    const res = await runAgent({
      businessId,
      type: type as AgentType,
      triggeredBy,
      payload,
    })
    log(`agent ${type} for ${businessId}: ${res.ok ? "ok" : res.error}`)
  },
  { connection },
)

// Run a given agent type for every business that has it enabled.
async function runEnabledAgents(type: AgentType, triggeredBy: string) {
  const agents = await prisma.agent.findMany({
    where: { type, isActive: true },
    select: { businessId: true },
  })
  for (const a of agents) {
    const res = await runAgent({ businessId: a.businessId, type, triggeredBy })
    log(`cron ${type} ${a.businessId}: ${res.ok ? "ok" : res.error}`)
  }
  if (agents.length) log(`cron ran ${type} for ${agents.length} businesses`)
}

// ─── Cron safety-net: sweep expired offers every minute ────
const offerSweep = new CronJob("* * * * *", async () => {
  const stale = await prisma.waitlist.findMany({
    where: {
      status: WaitlistStatus.OFFERED,
      offerExpires: { lt: new Date() },
    },
    select: { id: true },
    take: 100,
  })
  for (const s of stale) await expireOffer(s.id)
  if (stale.length) log(`cron swept ${stale.length} expired offers`)
})
offerSweep.start()

// ─── Cron: weekly recovery scan (Sun 10:00) ────────────────
const recoveryCron = new CronJob("0 10 * * 0", () => {
  void runEnabledAgents("RECOVERY", "cron_weekly")
})
recoveryCron.start()

// ─── Cron: weekly analytics report (Mon 08:00) ─────────────
const analyticsCron = new CronJob("0 8 * * 1", () => {
  void runEnabledAgents("ANALYTICS", "cron_weekly")
})
analyticsCron.start()

for (const [name, w] of [
  ["reminder", reminderWorker],
  ["waitlist", waitlistWorker],
  ["notification", notificationWorker],
  ["agent", agentWorker],
] as const) {
  w.on("failed", (job, err) => log(`${name} job ${job?.id} failed:`, err.message))
}

log(
  "workers started: reminder, waitlist, notification, agent + crons (offer-sweep, recovery, analytics)",
)

async function shutdown() {
  log("shutting down…")
  offerSweep.stop()
  recoveryCron.stop()
  analyticsCron.stop()
  await Promise.all([
    reminderWorker.close(),
    waitlistWorker.close(),
    notificationWorker.close(),
    agentWorker.close(),
  ])
  process.exit(0)
}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
