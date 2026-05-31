"use server"

// ============================================================
// Staff server actions — tenant-scoped CRUD + service linking.
// ============================================================

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"

const staffSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  // serviceIds arrive as repeated form fields.
  serviceIds: z.array(z.string()).optional(),
})

export type ActionResult = { ok: true } | { ok: false; error: string }

function parseStaff(formData: FormData) {
  return staffSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    serviceIds: formData.getAll("serviceIds").map(String),
  })
}

// Keep only serviceIds that actually belong to this tenant.
async function tenantServiceIds(businessId: string, ids: string[]) {
  if (ids.length === 0) return []
  const rows = await prisma.service.findMany({
    where: { businessId, id: { in: ids } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function createStaff(formData: FormData): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = parseStaff(formData)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data
  const serviceIds = await tenantServiceIds(ctx.businessId, d.serviceIds ?? [])

  await prisma.staff.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
    },
  })

  revalidatePath("/dashboard/staff")
  return { ok: true }
}

export async function updateStaff(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const existing = await prisma.staff.findFirst({
    where: { id, businessId: ctx.businessId },
  })
  if (!existing) return { ok: false, error: "notFound" }

  const parsed = parseStaff(formData)
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data
  const serviceIds = await tenantServiceIds(ctx.businessId, d.serviceIds ?? [])

  await prisma.$transaction([
    prisma.staff.update({
      where: { id },
      data: { name: d.name, phone: d.phone || null, email: d.email || null },
    }),
    // Replace the link set wholesale.
    prisma.staffService.deleteMany({ where: { staffId: id } }),
    prisma.staffService.createMany({
      data: serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
    }),
  ])

  revalidatePath("/dashboard/staff")
  return { ok: true }
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const existing = await prisma.staff.findFirst({
    where: { id, businessId: ctx.businessId },
  })
  if (!existing) return { ok: false, error: "notFound" }

  // Soft-delete to preserve booking history.
  await prisma.staff.update({ where: { id }, data: { isActive: false } })
  revalidatePath("/dashboard/staff")
  return { ok: true }
}
