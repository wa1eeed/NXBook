// ============================================================
// In-app Notification Center — createNotification() is called
// from booking-lifecycle, waitlist, payment webhook, and the
// agent runner. Notifications are tenant-scoped (businessId).
// The dashboard bell reads unread counts + recent notifications.
// ============================================================

import { prisma } from "@/lib/prisma"

export type NotificationType =
  | "BOOKING_NEW"
  | "BOOKING_CONFIRMED"
  | "BOOKING_ATTENDED"
  | "NO_SHOW"
  | "BOOKING_CANCELLED"
  | "WAITLIST_OFFER"
  | "PAYMENT_RECEIVED"
  | "AGENT_RUN"

export interface CreateNotificationInput {
  businessId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, string | number | boolean | null>
}

/**
 * Create an in-app notification. Never throws — notification failures
 * must never block the main booking/payment/agent flow.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await prisma.inAppNotification.create({
      data: {
        businessId: input.businessId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    })
  } catch {
    // Silently ignore — notification failures must not affect the caller
  }
}

/**
 * Mark one notification as read (tenant-scoped ownership check).
 */
export async function markRead(
  businessId: string,
  notificationId: string,
): Promise<void> {
  await prisma.inAppNotification.updateMany({
    where: { id: notificationId, businessId },
    data: { isRead: true },
  })
}

/**
 * Mark ALL notifications for a business as read.
 */
export async function markAllRead(businessId: string): Promise<void> {
  await prisma.inAppNotification.updateMany({
    where: { businessId, isRead: false },
    data: { isRead: true },
  })
}

/**
 * Count unread notifications for a business.
 */
export async function countUnread(businessId: string): Promise<number> {
  return prisma.inAppNotification.count({
    where: { businessId, isRead: false },
  })
}

/**
 * Get recent notifications (with pagination).
 */
export async function getNotifications(
  businessId: string,
  options?: { take?: number; skip?: number; unreadOnly?: boolean },
) {
  const { take = 30, skip = 0, unreadOnly = false } = options ?? {}
  return prisma.inAppNotification.findMany({
    where: {
      businessId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  })
}
