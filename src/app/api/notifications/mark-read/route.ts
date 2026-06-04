// POST /api/notifications/mark-read — marks all notifications as read
// for the authenticated tenant.

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { markAllRead } from "@/lib/notifications-center"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const membership = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    select: { businessId: true },
  })
  if (!membership) return NextResponse.json({ ok: true })

  await markAllRead(membership.businessId)
  return NextResponse.json({ ok: true })
}
