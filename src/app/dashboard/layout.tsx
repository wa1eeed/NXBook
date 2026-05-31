import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarCheck, ExternalLink } from "lucide-react"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { resolveTheme } from "@/lib/theme"
import { ThemeScope } from "@/components/theme/theme-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { MobileNav } from "@/components/dashboard/mobile-nav"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { logoutAction } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

// Protected dashboard shell: resolves the tenant once, applies the
// business theme (CSS vars), renders the sidebar (desktop) / drawer
// (mobile) + header around all dashboard pages. Logical borders keep
// the layout correct in both LTR and RTL.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await requireBusiness()
  const tc = await getTranslations("common")
  const td = await getTranslations("dashboard")
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, slug: true, themeConfig: true },
  })
  const theme = resolveTheme(business?.themeConfig)

  return (
    <ThemeScope theme={theme} className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-e border-border bg-muted/30 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{tc("appName")}</span>
        </div>
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <span className="truncate font-semibold">{business?.name}</span>
            <Link
              href={`/${business?.slug}`}
              target="_blank"
              className="hidden items-center gap-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
            >
              /{business?.slug}
              <ExternalLink className="size-3" />
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <form action={logoutAction}>
              <Button variant="outline" size="sm">
                {td("logout")}
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </ThemeScope>
  )
}
