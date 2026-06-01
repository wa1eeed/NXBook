import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarCheck } from "lucide-react"
import { auth } from "@/lib/auth"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/marketing/user-menu"

// Sticky, blurred marketing header — session-aware:
//   · Signed-out  → "Login" (ghost) + "Get Started" (primary) buttons
//   · Signed-in   → UserMenu avatar dropdown (replaces both buttons)
//
// This keeps the hero section clean — no session hints clutter the
// marketing copy. Navigation items are always visible.
export async function SiteHeader() {
  const t = await getTranslations("marketing")
  const tc = await getTranslations("common")
  const session = await auth()
  const user = session?.user

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">

        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{tc("appName")}</span>
        </Link>

        {/* Nav links — hidden on mobile */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            {t("navFeatures")}
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            {t("navHowItWorks")}
          </a>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            {t("navPricing")}
          </Link>
        </nav>

        {/* Actions — right side */}
        <div className="flex items-center gap-2">
          {/* Language switcher — always shown */}
          <LocaleSwitcher />

          {user ? (
            // ── Signed-in: show avatar menu only ──────────────────────
            <UserMenu
              email={user.email ?? ""}
              role={user.role ?? "OWNER"}
              onboardingDone={user.onboardingDone ?? false}
            />
          ) : (
            // ── Signed-out: login + register buttons ──────────────────
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("getStarted")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
