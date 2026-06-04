// Shared dashboard navigation definition — used by the desktop sidebar
// and the mobile drawer so they never drift apart.
import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Users,
  UserCog,
  Bot,
  BarChart3,
  Receipt,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  key: string
  icon: LucideIcon
  exact: boolean
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", key: "home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/bookings", key: "bookings", icon: CalendarDays, exact: false },
  { href: "/dashboard/services", key: "services", icon: Scissors, exact: false },
  { href: "/dashboard/customers", key: "customers", icon: Users, exact: false },
  { href: "/dashboard/staff", key: "staff", icon: UserCog, exact: false },
  { href: "/dashboard/agents", key: "agents", icon: Bot, exact: false },
  { href: "/dashboard/reports", key: "reports", icon: BarChart3, exact: false },
  { href: "/dashboard/transactions", key: "transactions", icon: Receipt, exact: false },
  { href: "/dashboard/billing", key: "billing", icon: CreditCard, exact: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, exact: false },
]
