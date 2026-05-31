import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarCheck } from "lucide-react"

export async function SiteFooter() {
  const t = await getTranslations("marketing")
  const tc = await getTranslations("common")
  const year = 2026

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="size-4" />
            </span>
            <span className="text-base font-bold">{tc("appName")}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {t("footerTagline")}
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">{t("footerProduct")}</span>
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            {t("navFeatures")}
          </a>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            {t("navPricing")}
          </Link>
          <Link href="/register" className="text-muted-foreground hover:text-foreground">
            {t("getStarted")}
          </Link>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">{t("footerCompany")}</span>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            {t("login")}
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground">
          © {year} {tc("appName")}. {t("footerRights")}
        </div>
      </div>
    </footer>
  )
}
