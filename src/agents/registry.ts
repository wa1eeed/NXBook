// ============================================================
// Agent registry — the single catalog of available agents. Adding
// a new agent = import it and add one entry here; nothing else in
// core changes (CLAUDE.md §10).
// ============================================================

import type { AgentType } from "@prisma/client"
import type { AgentPlugin } from "./base"
import { WaitlistAgent } from "./waitlist-agent"
import { FollowupAgent } from "./followup-agent"
import { RecoveryAgent } from "./recovery-agent"
import { AnalyticsAgent } from "./analytics-agent"

export const AGENT_REGISTRY: Partial<Record<AgentType, AgentPlugin>> = {
  WAITLIST: new WaitlistAgent(),
  FOLLOWUP: new FollowupAgent(),
  RECOVERY: new RecoveryAgent(),
  ANALYTICS: new AnalyticsAgent(),
}

export const CORE_AGENT_TYPES = Object.keys(AGENT_REGISTRY) as AgentType[]

export function getAgent(type: AgentType): AgentPlugin | undefined {
  return AGENT_REGISTRY[type]
}

// Catalog view for the dashboard (no live instances leaked to client).
export function agentCatalog() {
  return CORE_AGENT_TYPES.map((type) => {
    const a = AGENT_REGISTRY[type]!
    return {
      type,
      nameEn: a.nameEn,
      nameAr: a.nameAr,
      descriptionEn: a.descriptionEn,
      descriptionAr: a.descriptionAr,
      minPlan: a.minPlan,
      defaultConfig: a.defaultConfig,
    }
  })
}
