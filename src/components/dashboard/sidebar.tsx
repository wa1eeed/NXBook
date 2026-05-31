"use client"

// Desktop dashboard sidebar navigation. Uses logical CSS so it mirrors
// correctly in RTL. Highlights the active section by pathname.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { DASHBOARD_NAV } from "./nav-items"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {DASHBOARD_NAV.map(({ href, key, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{t(key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
