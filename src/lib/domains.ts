// ============================================================
// Custom domains — client-owned domains for tenant booking pages
// (CLAUDE.md §6). Add → show DNS instructions (TXT verify token +
// A record) → verify via DNS lookup → ACTIVE. Tenant-scoped.
// ============================================================

import { randomBytes } from "crypto"
import { resolveTxt } from "dns/promises"
import { prisma } from "@/lib/prisma"
import type { DomainStatus } from "@prisma/client"

// hostname like book.clinic.com (no scheme/path), 4..253 chars.
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i

export const VERIFY_SUBDOMAIN = "_nxbook-verify"

export interface DnsInstructions {
  txtName: string // _nxbook-verify.book.clinic.com
  txtValue: string // the token
  aName: string // book.clinic.com
  aValue: string // platform server IP
}

export function dnsInstructions(domain: string, token: string): DnsInstructions {
  return {
    txtName: `${VERIFY_SUBDOMAIN}.${domain}`,
    txtValue: token,
    aName: domain,
    aValue: process.env.PLATFORM_SERVER_IP ?? "<server-ip>",
  }
}

export type AddDomainResult =
  | { ok: true; id: string; token: string }
  | { ok: false; error: string }

export async function addCustomDomain(
  businessId: string,
  rawDomain: string,
): Promise<AddDomainResult> {
  const domain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: "invalidDomain" }

  const existing = await prisma.customDomain.findUnique({ where: { domain } })
  if (existing) return { ok: false, error: "domainTaken" }

  const token = randomBytes(16).toString("hex")
  const row = await prisma.customDomain.create({
    data: { businessId, domain, verifyToken: token, status: "PENDING" },
  })
  return { ok: true, id: row.id, token }
}

export type VerifyResult = { ok: true; status: DomainStatus } | { ok: false; error: string }

/**
 * Verify ownership by checking the TXT record at _nxbook-verify.<domain>
 * matches the stored token. On success → ACTIVE. Tenant-scoped by businessId.
 */
export async function verifyDomain(
  businessId: string,
  domainId: string,
): Promise<VerifyResult> {
  const row = await prisma.customDomain.findFirst({
    where: { id: domainId, businessId },
  })
  if (!row) return { ok: false, error: "notFound" }

  await prisma.customDomain.update({
    where: { id: row.id },
    data: { status: "VERIFYING", lastCheckedAt: new Date() },
  })

  let matched = false
  try {
    const records = await resolveTxt(`${VERIFY_SUBDOMAIN}.${row.domain}`)
    // resolveTxt returns string[][]; flatten and compare.
    matched = records.some((chunks) => chunks.join("").trim() === row.verifyToken)
  } catch {
    matched = false
  }

  if (!matched) {
    await prisma.customDomain.update({
      where: { id: row.id },
      data: { status: "FAILED", lastCheckedAt: new Date() },
    })
    return { ok: false, error: "txtNotFound" }
  }

  await prisma.customDomain.update({
    where: { id: row.id },
    data: {
      status: "ACTIVE",
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
      sslStatus: "pending",
    },
  })
  return { ok: true, status: "ACTIVE" }
}

export async function removeCustomDomain(
  businessId: string,
  domainId: string,
): Promise<{ ok: boolean }> {
  const row = await prisma.customDomain.findFirst({
    where: { id: domainId, businessId },
  })
  if (!row) return { ok: false }
  await prisma.customDomain.delete({ where: { id: row.id } })
  return { ok: true }
}

/** Resolve a verified/active custom domain → tenant slug (for routing). */
export async function resolveDomainToSlug(host: string): Promise<string | null> {
  const domain = host.toLowerCase().split(":")[0]
  const row = await prisma.customDomain.findFirst({
    where: { domain, status: "ACTIVE" },
    include: { business: { select: { slug: true, isActive: true } } },
  })
  if (!row || !row.business.isActive) return null
  return row.business.slug
}
