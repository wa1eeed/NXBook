"use server"

// Super-admin plan + trial-policy management. Cross-tenant config writes,
// validated with Zod, audit-logged (CLAUDE.md §5/§7).
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"

export type ActionResult = { ok: true } | { ok: false; error: string }

const planSchema = z.object({
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  trialDays: z.number().int().min(0).max(365),
  isTrialUpgradeForced: z.boolean(),
  maxStaff: z.number().int().min(-1),
  maxServices: z.number().int().min(-1),
  maxAgents: z.number().int().min(-1),
})

export type PlanInput = z.infer<typeof planSchema>

export async function updatePlanAction(
  planId: string,
  data: PlanInput,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin()

  const parsed = planSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalid" }

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) return { ok: false, error: "notFound" }

  await prisma.plan.update({ where: { id: planId }, data: parsed.data })
  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "plan.update",
    targetType: "plan",
    targetId: planId,
    metadata: parsed.data,
  })

  revalidatePath("/admin/plans")
  return { ok: true }
}

const trialPolicySchema = z.object({
  enabled: z.boolean(),
  defaultDays: z.number().int().min(0).max(365),
  upgradeForced: z.boolean(),
})

export type TrialPolicyInput = z.infer<typeof trialPolicySchema>

export async function updateTrialPolicyAction(
  data: TrialPolicyInput,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin()

  const parsed = trialPolicySchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalid" }

  // PlatformConfig is a singleton row — find or create it.
  const existing = await prisma.platformConfig.findFirst()
  if (existing) {
    await prisma.platformConfig.update({
      where: { id: existing.id },
      data: { trialPolicy: parsed.data },
    })
  } else {
    await prisma.platformConfig.create({ data: { trialPolicy: parsed.data } })
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "platform.trialPolicy.update",
    targetType: "platformConfig",
    metadata: parsed.data,
  })

  revalidatePath("/admin/plans")
  return { ok: true }
}
