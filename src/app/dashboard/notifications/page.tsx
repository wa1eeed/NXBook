// /dashboard/notifications — full notification history page
// with search, type filter, and pagination.

import { requireBusiness } from "@/lib/tenant"
import { getNotifications } from "@/lib/notifications-center"
import { getTranslations } from "next-intl/server"
import { NotificationsClient } from "./notifications-client"

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const ctx = await requireBusiness()
  const t = await getTranslations("notifications")
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const take = 40
  const skip = (pageNum - 1) * take

  const notifications = await getNotifications(ctx.businessId, { take, skip })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <NotificationsClient
        notifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          metadata: (n.metadata as Record<string, string> | null),
        }))}
        page={pageNum}
        hasMore={notifications.length === take}
      />
    </div>
  )
}
