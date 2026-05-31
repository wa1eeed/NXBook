"use client"

// Mobile navigation — a hamburger button that opens a slide-in drawer
// with the full nav. Visible only below md. RTL-correct: the drawer
// slides from the inline-start edge and the overlay covers the screen.
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { AnimatePresence, motion } from "motion/react"
import { Menu, X, CalendarCheck } from "lucide-react"
import { DASHBOARD_NAV } from "./nav-items"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const t = useTranslations("dashboard")
  const tc = useTranslations("common")
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isRtl = locale === "ar"

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 z-50 flex w-72 max-w-[80%] flex-col border-e border-border bg-card start-0"
              initial={{ x: isRtl ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? "100%" : "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex h-16 items-center justify-between px-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <CalendarCheck className="size-5" />
                  </span>
                  <span className="text-lg font-bold">{tc("appName")}</span>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {DASHBOARD_NAV.map(({ href, key, icon: Icon, exact }) => {
                  const active = exact ? pathname === href : pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{t(key)}</span>
                    </Link>
                  )
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
