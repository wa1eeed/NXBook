import Link from "next/link"
import { getTranslations } from "next-intl/server"
import {
  CalendarCheck,
  ListChecks,
  BellRing,
  Bot,
  BarChart3,
  Globe,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { Button } from "@/components/ui/button"

// Conversion-focused marketing landing page. Bilingual (RTL/LTR via
// the cookie locale). Arrow icons flip in RTL with `rtl:rotate-180`.
export default async function Home() {
  const t = await getTranslations("marketing")

  const features = [
    { icon: CalendarCheck, title: t("f1Title"), desc: t("f1Desc") },
    { icon: ListChecks, title: t("f2Title"), desc: t("f2Desc") },
    { icon: BellRing, title: t("f3Title"), desc: t("f3Desc") },
    { icon: Bot, title: t("f4Title"), desc: t("f4Desc") },
    { icon: BarChart3, title: t("f5Title"), desc: t("f5Desc") },
    { icon: Globe, title: t("f6Title"), desc: t("f6Desc") },
  ]

  const steps = [
    { n: "1", title: t("step1Title"), desc: t("step1Desc") },
    { n: "2", title: t("step2Title"), desc: t("step2Desc") },
    { n: "3", title: t("step3Title"), desc: t("step3Desc") },
  ]

  const stats = [
    { value: "+35%", label: t("statShowRate") },
    { value: "SAR", label: t("statRevenue") },
    { value: t("statSetupValue"), label: t("statSetup") },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-hero relative overflow-hidden">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="size-4 text-primary" />
              {t("badge")}
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
              {t("heroTitleA")}{" "}
              <span className="text-gradient">{t("heroTitleB")}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("heroSubtitle")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/register">
                  {t("ctaPrimary")}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/pricing">{t("ctaSecondary")}</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{t("noCard")}</p>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 sm:grid-cols-3">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-extrabold text-primary sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("featuresTitle")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("featuresSubtitle")}
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("howTitle")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("howSubtitle")}
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="relative rounded-2xl bg-card p-7 shadow-soft">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Flagship — revenue saved */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t("flagshipKicker")}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("flagshipTitle")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("flagshipDesc")}
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {[t("flagshipPoint1"), t("flagshipPoint2"), t("flagshipPoint3")].map(
                  (p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="size-3.5" />
                      </span>
                      <span className="text-sm">{p}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Decorative "revenue saved" card */}
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 shadow-soft">
              <div className="rounded-2xl bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">{t("statRevenue")}</p>
                <p className="mt-1 text-4xl font-extrabold text-primary">12,400 SAR</p>
                <div className="mt-6 flex items-end gap-2">
                  {[40, 65, 50, 80, 95, 70, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-primary/70"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("statShowRate")}</span>
                  <span className="font-semibold text-foreground">+35%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("ctaBandTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              {t("ctaBandSubtitle")}
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="mt-7 bg-background text-foreground hover:bg-background/90"
            >
              <Link href="/register">
                {t("ctaPrimary")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
