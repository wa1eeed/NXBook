// ============================================================
// Agent runner — the one path that executes any agent. Loads the
// tenant's Agent row (must be active), checks credit balance for
// PLATFORM-billed tenants, runs the plugin, records an AgentLog and
// rolls up the Agent's lifetime stats. Never lets an agent failure
// escape uncaught (logs + Sentry). Tenant-scoped by businessId.
// ============================================================

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"
import type { AgentType } from "@prisma/client"
import { getAgent } from "./registry"
import { aiConfigured } from "@/lib/ai-guard"
import type { AgentContext } from "./base"

export interface RunAgentInput {
  businessId: string
  type: AgentType
  triggeredBy: string
  payload?: Record<string, unknown>
}

export type RunAgentResult =
  | { ok: true; summary: string; messagesSent: number; skipped?: boolean }
  | { ok: false; error: string }

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { businessId, type, triggeredBy, payload } = input

  const plugin = getAgent(type)
  if (!plugin) return { ok: false, error: "unknownAgent" }

  // Agent must be enabled for this tenant.
  const agent = await prisma.agent.findUnique({
    where: { businessId_type: { businessId, type } },
  })
  if (!agent || !agent.isActive) {
    return { ok: false, error: "agentDisabled" }
  }

  // Credit gate: PLATFORM-billed tenants need a positive balance to run
  // AI. If AI isn't configured at all, the agent still runs on templates
  // (no credit consumed), so we only block when AI *would* be metered.
  const config = await prisma.businessAIConfig.findUnique({ where: { businessId } })
  if (config?.keyType !== "OWN_KEY" && (await aiConfigured(businessId))) {
    const account = await prisma.creditAccount.findUnique({ where: { businessId } })
    if (!account || account.balance <= 0) {
      await prisma.agentLog.create({
        data: {
          businessId,
          agentId: agent.id,
          agentType: type,
          triggeredBy,
          status: "FAILED",
          error: "insufficient_credits",
        },
      })
      return { ok: false, error: "insufficientCredits" }
    }
  }

  const ctx: AgentContext = {
    businessId,
    agentId: agent.id,
    triggeredBy,
    config: (agent.config as Record<string, unknown>) ?? {},
    payload,
  }

  const started = Date.now()
  try {
    const outcome = await plugin.execute(ctx)
    const durationMs = Date.now() - started

    await prisma.$transaction([
      prisma.agentLog.create({
        data: {
          businessId,
          agentId: agent.id,
          agentType: type,
          triggeredBy,
          status: "COMPLETED",
          response: outcome.summary,
          inputTokens: outcome.inputTokens,
          outputTokens: outcome.outputTokens,
          costSar: outcome.costSar,
          messageSent: outcome.messagesSent > 0,
          channel: outcome.channel ?? null,
          durationMs,
        },
      }),
      prisma.agent.update({
        where: { id: agent.id },
        data: {
          totalRuns: { increment: 1 },
          totalMessages: { increment: outcome.messagesSent },
          totalTokensUsed: { increment: outcome.inputTokens + outcome.outputTokens },
          totalCostSar: { increment: outcome.costSar },
          lastRunAt: new Date(),
        },
      }),
    ])

    return { ok: true, summary: outcome.summary, messagesSent: outcome.messagesSent }
  } catch (err) {
    const durationMs = Date.now() - started
    Sentry.captureException(err, { extra: { businessId, agentType: type, triggeredBy } })
    await prisma.agentLog.create({
      data: {
        businessId,
        agentId: agent.id,
        agentType: type,
        triggeredBy,
        status: "FAILED",
        error: err instanceof Error ? err.message : "unknown",
        durationMs,
      },
    })
    return { ok: false, error: "executionFailed" }
  }
}
