import { getTranslations } from "next-intl/server"
import { CalendarCheck } from "lucide-react"
import { requireSuperAdmin } from "@/lib/tenant"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { logoutAction } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

// Super-admin shell. Guarded by requireSuperAdmin (cross-tenant access
// is intentional and only happens behind this guard — CLAUDE.md §5).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await requireSuperAdmin()
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-e border-border bg-muted/30 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{tc("appName")}</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {t("badge")}
          </span>
        </div>
        <AdminSidebar />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-6">
          <span className="truncate text-sm text-muted-foreground">{ctx.email}</span>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <form action={logoutAction}>
              <Button variant="outline" size="sm">
                {t("logout")}
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
