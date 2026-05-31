// ============================================================
// AgentPlugin — the abstract base every agent extends (CLAUDE.md
// §10). Adding a new agent = one new subclass registered in the
// registry, with NO changes to core. The interface is intentionally
// future-ready for Level 2/3 (§10.5): `tools` + a multi-step loop
// can be layered on without redesigning this contract.
// ============================================================

import type { AgentType, NotificationChannel } from "@prisma/client"

export type AgentTrigger =
  | { kind: "event"; event: string } // e.g. slot_freed, no_show_recorded
  | { kind: "delayed"; afterEvent: string; delayMinutes: number }
  | { kind: "cron"; schedule: string } // node-cron expression

// What an agent did during one execution — recorded in AgentLog by the runner.
export interface AgentRunOutcome {
  // Human-readable summary of the run (stored as the log response).
  summary: string
  // Messages the agent decided to send (already dispatched by the agent).
  messagesSent: number
  channel?: NotificationChannel
  // Optional structured result (e.g. analytics report id).
  data?: Record<string, unknown>
  // AI accounting (0 when the agent didn't call AI / used fallback).
  costSar: number
  inputTokens: number
  outputTokens: number
}

// Everything an agent needs for one run. `payload` carries
// trigger-specific data (e.g. the bookingId for a follow-up).
export interface AgentContext {
  businessId: string
  agentId: string
  triggeredBy: string
  config: Record<string, unknown>
  payload?: Record<string, unknown>
}

export abstract class AgentPlugin {
  abstract readonly type: AgentType
  abstract readonly nameEn: string
  abstract readonly nameAr: string
  abstract readonly descriptionEn: string
  abstract readonly descriptionAr: string
  abstract readonly triggers: AgentTrigger[]
  // Plans below this tier can't enable the agent (gating handled in UI/runner).
  abstract readonly minPlan: "STARTER" | "GROWTH" | "SCALE"
  abstract readonly defaultConfig: Record<string, unknown>

  abstract execute(ctx: AgentContext): Promise<AgentRunOutcome>

  // ── Future-ready (Level 2/3, not used in the MVP) ──
  // A custom/autonomous agent will declare the tools it may call here;
  // the runner will expose only these to the model in a think→act loop.
  readonly allowedTools: string[] = []
}
