"use server"

// Customer management server actions — tenant-scoped, audit-logged.
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"
import { recordAudit } from "@/lib/audit"

export type ActionResult = { ok: true } | { ok: false; error: string }

// Ownership-checked lookup helper.
async function ownedCustomer(businessId: string, id: string) {
  return prisma.customer.findFirst({ where: { id, businessId } })
}

export async function setCustomerBlocked(
  id: string,
  isBlocked: boolean,
  reason?: string,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }
  if (!(await ownedCustomer(ctx.businessId, id))) return { ok: false, error: "notFound" }

  await prisma.customer.update({
    where: { id },
    data: { isBlocked, blockReason: isBlocked ? reason ?? null : null },
  })
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: isBlocked ? "customer.block" : "customer.unblock",
    targetType: "customer",
    targetId: id,
  })
  revalidatePath("/dashboard/customers")
  return { ok: true }
}

export async function setCustomerVIP(
  id: string,
  isVIP: boolean,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }
  if (!(await ownedCustomer(ctx.businessId, id))) return { ok: false, error: "notFound" }

  await prisma.customer.update({ where: { id }, data: { isVIP } })
  revalidatePath("/dashboard/customers")
  return { ok: true }
}

const noteSchema = z.string().max(2000)

export async function updateCustomerNotes(
  id: string,
  notes: string,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }
  if (!(await ownedCustomer(ctx.businessId, id))) return { ok: false, error: "notFound" }

  const parsed = noteSchema.safeParse(notes)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  await prisma.customer.update({ where: { id }, data: { notes: parsed.data } })
  revalidatePath("/dashboard/customers")
  return { ok: true }
}

// ─── Editable profile (name / phone / email) ──────────────

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z
    .string()
    .email()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? null : v)),
})

export async function updateCustomerAction(
  id: string,
  data: { name?: string; phone?: string; email?: string | null },
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }
  if (!(await ownedCustomer(ctx.businessId, id)))
    return { ok: false, error: "notFound" }

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  try {
    await prisma.customer.update({ where: { id }, data: parsed.data })
  } catch {
    // Likely the [businessId, phone] unique constraint — surface as input error.
    return { ok: false, error: "invalidInput" }
  }
  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "customer.update",
    targetType: "customer",
    targetId: id,
  })
  revalidatePath("/dashboard/customers")
  return { ok: true }
}

// ─── CSV import ───────────────────────────────────────────

const importSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(100),
      phone: z.string().min(7).max(20),
      email: z
        .string()
        .email()
        .optional()
        .or(z.literal("").transform(() => undefined)),
      notes: z.string().max(2000).optional(),
    }),
  )
  .max(500)

export async function importCustomersAction(
  rows: { name: string; phone: string; email?: string; notes?: string }[],
): Promise<
  { ok: true; imported: number; skipped: number } | { ok: false; error: string }
> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = importSchema.safeParse(rows)
  if (!parsed.success) return { ok: false, error: "invalidInput" }

  let imported = 0
  let skipped = 0
  for (const r of parsed.data) {
    const exists = await prisma.customer.findFirst({
      where: { businessId: ctx.businessId, phone: r.phone },
      select: { id: true },
    })
    if (exists) {
      skipped++
      continue
    }
    await prisma.customer.create({
      data: {
        businessId: ctx.businessId,
        name: r.name,
        phone: r.phone,
        email: r.email ?? null,
        notes: r.notes ?? null,
      },
    })
    imported++
  }

  await recordAudit({
    businessId: ctx.businessId,
    actorId: ctx.userId,
    action: "customer.import",
    targetType: "customer",
    targetId: "bulk",
    metadata: { imported, skipped },
  })
  revalidatePath("/dashboard/customers")
  return { ok: true, imported, skipped }
}
