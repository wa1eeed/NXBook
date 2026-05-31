"use server"

// ============================================================
// Agents dashboard server actions — tenant-scoped enable/config/
// manual-run. businessId always from requireBusiness().
// ============================================================

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"
import { getAgent } from "@/agents/registry"
import { runAgent } from "@/agents/runner"
import { recordAudit } from "@/lib/audit"
import type { AgentType } from "@prisma/client"

export type ActionResult = { ok: true } | { ok: false; error: string }

const VALID: AgentType[] = ["WAITLIST", "FOLLOWUP", "RECOVERY", "ANALYTICS"]

export async function toggleAgent(
  type: AgentType,
  enabled: boolean,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }
  if (!VALID.includes(type)) return { ok: false, error: "unknownAgent" }

  const plugin = getAgent(type)
  if (!plugin) return { ok: false, error: "unknownAgent" }

  await prisma.agent.upsert({
    where: { businessId_type: { businessId: ctx.businessId, type } },
    update: { isActive: enabled },
    create: {
      businessId: ctx.businessId,
      type,
      name: plugin.nameEn,
      isActive: enabled,
      config: plugin.defaultConfig as object,
    },
  })

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "agent.toggle",
    targetType: "agent",
    targetId: type,
    metadata: { enabled },
  })

  revalidatePath("/dashboard/agents")
  return { ok: true }
}

export async function updateAgentConfig(
  type: AgentType,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const existing = await prisma.agent.findUnique({
    where: { businessId_type: { businessId: ctx.businessId, type } },
  })
  if (!existing) return { ok: false, error: "notFound" }

  await prisma.agent.update({
    where: { id: existing.id },
    data: { config: config as object },
  })
  revalidatePath("/dashboard/agents")
  return { ok: true }
}

// Manual "run now" — for ANALYTICS / RECOVERY the owner can trigger
// a run on demand (e.g. to preview the weekly report immediately).
export async function runAgentNow(type: AgentType): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const res = await runAgent({
    businessId: ctx.businessId,
    type,
    triggeredBy: "manual_dashboard",
  })
  revalidatePath("/dashboard/agents")
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true }
}
