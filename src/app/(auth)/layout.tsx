import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarCheck, ListChecks, Bot, BarChart3 } from "lucide-react"
import { LocaleSwitcher } from "@/components/locale-switcher"

// Two-panel auth shell: a branded gradient panel (hidden on mobile) and
// the form column. Used by login / register / onboarding. RTL-aware via
// logical borders; the brand panel sits at the inline-start edge.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tc = await getTranslations("common")
  const t = await getTranslations("marketing")

  const points = [
    { icon: ListChecks, text: t("f2Title") },
    { icon: Bot, text: t("f4Title") },
    { icon: BarChart3, text: t("f5Title") },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <aside className="bg-hero relative hidden w-1/2 flex-col justify-between border-e border-border bg-primary/5 p-12 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-xl font-bold">{tc("appName")}</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            {t("heroTitleA")} <span className="text-gradient">{t("heroTitleB")}</span>
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="size-5" />
                </span>
                <span className="font-medium">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">{t("noCard")}</p>
      </aside>

      {/* Form column */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-2 lg:invisible">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="size-5" />
            </span>
            <span className="text-lg font-bold">{tc("appName")}</span>
          </Link>
          <LocaleSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          {children}
        </div>
      </div>
    </div>
  )
}
