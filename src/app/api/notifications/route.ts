// GET /api/notifications — returns recent notifications + unread count
// for the authenticated tenant. Used by the dashboard notification bell.

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { countUnread, getNotifications } from "@/lib/notifications-center"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Resolve the business for this user (first membership)
  const membership = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    select: { businessId: true },
  })
  if (!membership) {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(membership.businessId, { take: 30 }),
    countUnread(membership.businessId),
  ])

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      metadata: n.metadata,
    })),
    unreadCount,
  })
}
