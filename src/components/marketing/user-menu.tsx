"use client"

// ============================================================
// UserMenu — avatar button + dropdown for signed-in visitors
// on the marketing site header. Mirrors the pattern used by
// major SaaS products (Notion, Linear, etc.):
//   · Signed-in  → round avatar with initial + dropdown
//   · Signed-out → handled by the parent SiteHeader (login/register btns)
//
// This is a client component so it can manage open/close state.
// The parent passes user data as serializable props so we never
// cross the server/client boundary with Prisma objects.
// ============================================================

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { logoutAction } from "@/lib/auth-actions"
import {
  LayoutDashboard,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react"

interface UserMenuProps {
  email: string
  role: string
  onboardingDone: boolean
}

export function UserMenu({ email, role, onboardingDone }: UserMenuProps) {
  const t = useTranslations("marketing")
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [])

  const initial = email.charAt(0).toUpperCase()
  const isSuperAdmin = role === "SUPER_ADMIN"

  // Where to go when the user clicks the primary dashboard link
  const dashboardHref = isSuperAdmin
    ? "/admin"
    : !onboardingDone
      ? "/onboarding"
      : "/dashboard"

  const dashboardLabel = isSuperAdmin
    ? t("adminPanel")
    : !onboardingDone
      ? t("completeSetup")
      : t("myDashboard")

  const DashboardIcon = isSuperAdmin ? ShieldCheck : onboardingDone ? LayoutDashboard : Settings

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-full outline-none ring-primary/40 transition-shadow focus-visible:ring-2"
      >
        {/* Circle avatar with initial */}
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        <ChevronDown
          className={`hidden size-3.5 text-muted-foreground transition-transform sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-60 origin-top-end overflow-hidden rounded-xl border border-border bg-card shadow-soft"
          style={{ animationDuration: "120ms" }}
        >
          {/* Email header — greyed, non-clickable */}
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("signedInAs")}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">{email}</p>
          </div>

          {/* Menu items */}
          <div className="p-1.5">
            <Link
              href={dashboardHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <DashboardIcon className="size-4 text-primary" />
              {dashboardLabel}
            </Link>
          </div>

          {/* Divider + Sign out */}
          <div className="border-t border-border p-1.5">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
