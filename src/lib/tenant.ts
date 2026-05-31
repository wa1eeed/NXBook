// ============================================================
// Tenant context — the single choke point for resolving the
// current business from the session. Per CLAUDE.md §5, businessId
// ALWAYS comes from the authenticated session, never the client.
// Every dashboard server action funnels through requireBusiness()
// and scopes its queries by the returned businessId.
// ============================================================

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { UserRole } from "@prisma/client"

export interface TenantContext {
  userId: string
  businessId: string
  role: UserRole
  slug: string
}

/**
 * Resolve the current user's business membership. Redirects to
 * /login when unauthenticated and /onboarding when the user has no
 * business yet. Returns a context safe to scope all queries with.
 */
export async function requireBusiness(): Promise<TenantContext> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const membership = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  })
  if (!membership) redirect("/onboarding")

  return {
    userId: session.user.id,
    businessId: membership.businessId,
    role: membership.role,
    slug: membership.business.slug,
  }
}

/** Capability check for write actions. OWNER/MANAGER can manage; STAFF is read-mostly. */
export function canManage(role: UserRole): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN"
}

export interface AdminContext {
  userId: string
  email: string
}

/**
 * Guard for the super-admin panel. Cross-tenant access is intentional
 * here and must ONLY happen behind this guard (CLAUDE.md §5). Redirects
 * to /login for anyone who isn't a SUPER_ADMIN.
 */
export async function requireSuperAdmin(): Promise<AdminContext> {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    redirect("/login")
  }
  return { userId: session.user.id, email: session.user.email ?? "" }
}
