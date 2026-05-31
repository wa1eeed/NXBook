"use server"

// ============================================================
// Services server actions — tenant-scoped CRUD + availability.
// businessId always comes from requireBusiness(), never the client.
// ============================================================

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBusiness, canManage } from "@/lib/tenant"

const serviceSchema = z.object({
  nameEn: z.string().min(1).max(80),
  nameAr: z.string().max(80).optional().or(z.literal("")),
  descriptionEn: z.string().max(500).optional().or(z.literal("")),
  descriptionAr: z.string().max(500).optional().or(z.literal("")),
  durationMin: z.coerce.number().int().min(5).max(600),
  bufferMin: z.coerce.number().int().min(0).max(240),
  price: z.coerce.number().min(0).max(1_000_000),
  maxCapacity: z.coerce.number().int().min(1).max(1000),
  isVisible: z.coerce.boolean().optional(),
})

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createService(formData: FormData): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = serviceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  const count = await prisma.service.count({ where: { businessId: ctx.businessId } })

  await prisma.service.create({
    data: {
      businessId: ctx.businessId,
      nameEn: d.nameEn,
      nameAr: d.nameAr || null,
      descriptionEn: d.descriptionEn || null,
      descriptionAr: d.descriptionAr || null,
      durationMin: d.durationMin,
      bufferMin: d.bufferMin,
      price: d.price,
      maxCapacity: d.maxCapacity,
      isVisible: d.isVisible ?? true,
      sortOrder: count,
    },
  })

  revalidatePath("/dashboard/services")
  return { ok: true }
}

export async function updateService(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  // Ownership check — the row must belong to this tenant.
  const existing = await prisma.service.findFirst({
    where: { id, businessId: ctx.businessId },
  })
  if (!existing) return { ok: false, error: "notFound" }

  const parsed = serviceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  await prisma.service.update({
    where: { id },
    data: {
      nameEn: d.nameEn,
      nameAr: d.nameAr || null,
      descriptionEn: d.descriptionEn || null,
      descriptionAr: d.descriptionAr || null,
      durationMin: d.durationMin,
      bufferMin: d.bufferMin,
      price: d.price,
      maxCapacity: d.maxCapacity,
      isVisible: d.isVisible ?? true,
    },
  })

  revalidatePath("/dashboard/services")
  return { ok: true }
}

export async function deleteService(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const existing = await prisma.service.findFirst({
    where: { id, businessId: ctx.businessId },
  })
  if (!existing) return { ok: false, error: "notFound" }

  // Soft-delete: keep history (bookings reference it). Hide + deactivate.
  await prisma.service.update({
    where: { id },
    data: { isActive: false, isVisible: false },
  })

  revalidatePath("/dashboard/services")
  return { ok: true }
}

// ─── Availability ─────────────────────────────────────────────

const availSchema = z.object({
  serviceId: z.string(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotMin: z.coerce.number().int().min(5).max(480),
})

export async function addAvailability(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  const parsed = availSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "invalidInput" }
  const d = parsed.data

  // Service must belong to this tenant.
  const service = await prisma.service.findFirst({
    where: { id: d.serviceId, businessId: ctx.businessId },
  })
  if (!service) return { ok: false, error: "notFound" }
  if (d.startTime >= d.endTime) return { ok: false, error: "invalidRange" }

  await prisma.serviceAvailability.create({
    data: {
      serviceId: d.serviceId,
      dayOfWeek: d.dayOfWeek,
      startTime: d.startTime,
      endTime: d.endTime,
      slotMin: d.slotMin,
    },
  })

  revalidatePath(`/dashboard/services/${d.serviceId}`)
  return { ok: true }
}

export async function deleteAvailability(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!canManage(ctx.role)) return { ok: false, error: "forbidden" }

  // Join through service to enforce tenant ownership.
  const avail = await prisma.serviceAvailability.findUnique({
    where: { id },
    include: { service: true },
  })
  if (!avail || avail.service.businessId !== ctx.businessId) {
    return { ok: false, error: "notFound" }
  }

  await prisma.serviceAvailability.delete({ where: { id } })
  revalidatePath(`/dashboard/services/${avail.serviceId}`)
  return { ok: true }
}
