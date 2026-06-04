"use client"

// Super-admin sidebar — separate from the tenant dashboard nav.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ListTree,
  UsersRound,
  Repeat,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/admin", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/businesses", key: "businesses", icon: Building2, exact: false },
  { href: "/admin/customers", key: "customers", icon: UsersRound, exact: false },
  { href: "/admin/subscriptions", key: "subscriptions", icon: Repeat, exact: false },
  { href: "/admin/plans", key: "plans", icon: CreditCard, exact: false },
  { href: "/admin/queues", key: "queues", icon: ListTree, exact: false },
] as const

export function AdminSidebar() {
  const t = useTranslations("admin")
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ href, key, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{t(`nav.${key}`)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
