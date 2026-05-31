// ============================================================
// Audit log helper — records sensitive actions with the acting
// user + timestamp (CLAUDE.md §7). Never throws: an audit write
// failure must not break the action it's recording.
// ============================================================

import { prisma } from "@/lib/prisma"

export interface AuditEntry {
  businessId?: string | null
  actorId?: string | null
  actorEmail?: string | null
  action: string // dotted, e.g. "booking.cancel", "agent.toggle", "domain.verify"
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: entry.businessId ?? null,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: (entry.metadata ?? undefined) as object | undefined,
        ip: entry.ip ?? null,
      },
    })
  } catch {
    // Swallow — auditing is best-effort and must not fail the caller.
  }
}
