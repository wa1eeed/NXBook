import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { agentCatalog } from "@/agents/registry"
import { AgentsClient, type CatalogItem, type LogRow } from "./agents-client"

export default async function AgentsPage() {
  const ctx = await requireBusiness()

  const [agents, logs, credit] = await Promise.all([
    prisma.agent.findMany({ where: { businessId: ctx.businessId } }),
    prisma.agentLog.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.creditAccount.findUnique({ where: { businessId: ctx.businessId } }),
  ])

  const byType = new Map(agents.map((a) => [a.type, a]))

  const catalog: CatalogItem[] = agentCatalog().map((c) => {
    const row = byType.get(c.type)
    return {
      type: c.type,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      descriptionEn: c.descriptionEn,
      descriptionAr: c.descriptionAr,
      minPlan: c.minPlan,
      enabled: row?.isActive ?? false,
      totalRuns: row?.totalRuns ?? 0,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
    }
  })

  const logRows: LogRow[] = logs.map((l) => ({
    id: l.id,
    agentType: l.agentType,
    status: l.status,
    response: l.response,
    error: l.error,
    createdAt: l.createdAt.toISOString(),
  }))

  return (
    <AgentsClient
      catalog={catalog}
      logs={logRows}
      balance={credit?.balance ?? 0}
    />
  )
}
