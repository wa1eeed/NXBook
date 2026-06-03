import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
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
  Stethoscope,
  Scissors,
  Dumbbell,
  Briefcase,
  GraduationCap,
  Store,
  AlertTriangle,
  Clock,
  TrendingDown,
  MessageCircle,
  RotateCcw,
  Users,
  Star,
  ChevronDown,
  Zap,
} from "lucide-react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { Button } from "@/components/ui/button"
import {
  AnimatedHero,
  AnimatedFeatureGrid,
  AnimatedStats,
  AnimatedAgentsShowcase,
  ScrollReveal,
} from "@/components/marketing/animated-sections"

// Conversion-focused marketing landing page. Bilingual (RTL/LTR via
// the cookie locale). Arrow icons flip in RTL with `rtl:rotate-180`.
//
// Section order (top → bottom):
//   1. Hero (with live badge + mock dashboard preview)
//   2. Verticals strip (we serve every appointment business)
//   3. Stats band (3 KPIs)
//   4. The Problem (no-shows kill revenue) — emotional hook
//   5. Features grid (6 cards)
//   6. AI Agents showcase (4 cards — our moat)
//   7. How it works (3 steps)
//   8. Flagship "Revenue Saved" card
//   9. Voices / testimonials (3 quotes)
//  10. Pricing teaser (3 cards → /pricing)
//  11. FAQ (6 details/summary, no JS needed)
//  12. CTA band
export default async function Home() {
  const t = await getTranslations("marketing")
  const session = await auth()

  // The hero and CTA band are for un-authenticated visitors only.
  // Signed-in users are handled entirely by the SiteHeader UserMenu —
  // no duplicate hints or confusing buttons appear on the page itself.
  const isAuthed = !!session?.user?.id

  const features = [
    { icon: CalendarCheck, title: t("f1Title"), desc: t("f1Desc") },
    { icon: ListChecks, title: t("f2Title"), desc: t("f2Desc") },
    { icon: BellRing, title: t("f3Title"), desc: t("f3Desc") },
    { icon: Bot, title: t("f4Title"), desc: t("f4Desc") },
    { icon: BarChart3, title: t("f5Title"), desc: t("f5Desc") },
    { icon: Globe, title: t("f6Title"), desc: t("f6Desc") },
  ]

  const verticals = [
    { icon: Stethoscope, label: t("verticalsClinic") },
    { icon: Scissors, label: t("verticalsSalon") },
    { icon: Dumbbell, label: t("verticalsFitness") },
    { icon: Briefcase, label: t("verticalsConsulting") },
    { icon: GraduationCap, label: t("verticalsEducation") },
    { icon: Store, label: t("verticalsOther") },
  ]

  const problemStats = [
    { icon: TrendingDown, value: t("problemStat1Value"), label: t("problemStat1Label") },
    { icon: AlertTriangle, value: t("problemStat2Value"), label: t("problemStat2Label") },
    { icon: Clock, value: t("problemStat3Value"), label: t("problemStat3Label") },
  ]

  const agents = [
    { icon: Users, title: t("agent1Title"), desc: t("agent1Desc"), tint: "from-violet-500/15 to-indigo-500/10", iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
    { icon: MessageCircle, title: t("agent2Title"), desc: t("agent2Desc"), tint: "from-rose-500/15 to-pink-500/10", iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
    { icon: RotateCcw, title: t("agent3Title"), desc: t("agent3Desc"), tint: "from-amber-500/15 to-orange-500/10", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
    { icon: BarChart3, title: t("agent4Title"), desc: t("agent4Desc"), tint: "from-emerald-500/15 to-teal-500/10", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
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
    { value: t("statCustomersValue"), label: t("statCustomers") },
  ]

  const voices = [
    { quote: t("voice1Quote"), author: t("voice1Author"), role: t("voice1Role") },
    { quote: t("voice2Quote"), author: t("voice2Author"), role: t("voice2Role") },
    { quote: t("voice3Quote"), author: t("voice3Author"), role: t("voice3Role") },
  ]

  const plans = [
    {
      name: t("pricingStarterName"),
      price: t("pricingStarterPrice"),
      desc: t("pricingStarterDesc"),
      featured: false,
    },
    {
      name: t("pricingGrowthName"),
      price: t("pricingGrowthPrice"),
      desc: t("pricingGrowthDesc"),
      featured: true,
      badge: t("pricingGrowthBadge"),
    },
    {
      name: t("pricingScaleName"),
      price: t("pricingScalePrice"),
      desc: t("pricingScaleDesc"),
      featured: false,
    },
  ]

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    { q: t("faq6Q"), a: t("faq6A") },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ─── 1. Hero — animated ──────────────────────────── */}
        <AnimatedHero
          headline={`${t("heroTitleA")} ${t("heroTitleB")}`}
          subheadline={t("heroSubtitle")}
          ctaPrimary={t("ctaPrimary")}
          ctaSecondary={t("ctaSecondary")}
          isAuthed={isAuthed}
          stats={stats}
          liveBadgeLabel={t("heroLiveBadge")}
          trustedByLabel={t("trustedBy")}
          noCardLabel={t("noCard")}
        />

        {/* ─── 1b. Hero (static fallback — hidden, kept for SSR structure) */}
        <section className="bg-hero-mesh relative overflow-hidden hidden">
          <div className="bg-dots absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-20 sm:pb-20 sm:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-background/70 px-4 py-1.5 text-sm font-medium text-foreground shadow-soft backdrop-blur">
                <span className="pulse-dot relative size-2 rounded-full bg-emerald-500 text-emerald-500" />
                {t("heroLiveBadge")}
              </span>

              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                {t("heroTitleA")}{" "}
                <span className="text-gradient">{t("heroTitleB")}</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                {t("heroSubtitle")}
              </p>

              {/* CTA buttons — shown to un-authenticated visitors only.
                  Signed-in users use the header UserMenu to navigate. */}
              {!isAuthed && (
                <>
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button size="lg" asChild className="w-full sm:w-auto">
                      <Link href="/register">
                        {t("ctaPrimary")}
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                      <Link href="#how">{t("ctaSecondary")}</Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{t("noCard")}</p>
                </>
              )}

              <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </span>
                <span>{t("trustedBy")}</span>
              </div>
            </div>

            {/* Mock dashboard preview */}
            <div className="relative mx-auto mt-16 max-w-5xl">
              <div className="ring-soft overflow-hidden rounded-2xl border border-border bg-card">
                {/* fake browser chrome */}
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-rose-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ms-3 truncate rounded-md bg-background/70 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    nxbook.app/dashboard
                  </span>
                </div>

                {/* dashboard fake */}
                <div className="grid gap-px bg-border sm:grid-cols-[200px_1fr]">
                  {/* sidebar */}
                  <div className="hidden flex-col gap-1 bg-card p-4 sm:flex">
                    {["Home", "Bookings", "Customers", "Agents", "Reports"].map(
                      (l, i) => (
                        <div
                          key={l}
                          className={`rounded-md px-3 py-2 text-sm ${
                            i === 0
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {l}
                        </div>
                      ),
                    )}
                  </div>

                  {/* main content */}
                  <div className="bg-card p-5">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Today", value: "18", sub: "+4 vs yest" },
                        { label: "Show rate", value: "92%", sub: "+8% MoM" },
                        { label: "Saved", value: "1,840", sub: "SAR · waitlist" },
                      ].map((k) => (
                        <div
                          key={k.label}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <p className="text-xs text-muted-foreground">
                            {k.label}
                          </p>
                          <p className="mt-1 text-xl font-bold tracking-tight">
                            {k.value}
                          </p>
                          <p className="mt-0.5 text-[10px] text-emerald-600">
                            {k.sub}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-border bg-background p-4">
                      <div className="mb-3 flex items-end justify-between">
                        <p className="text-sm font-medium">Bookings this week</p>
                        <p className="text-xs text-muted-foreground">
                          Mon — Sun
                        </p>
                      </div>
                      <div className="flex items-end gap-2">
                        {[55, 70, 50, 85, 95, 78, 100].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary"
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating "agent" notification chip */}
              <div className="absolute -bottom-6 end-2 hidden rounded-xl border border-border bg-card p-3 shadow-soft sm:flex sm:items-center sm:gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Bot className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Waitlist Agent</span>
                  <span className="text-[11px] text-muted-foreground">
                    Slot offered to Sara — 2 min ago
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. Verticals strip ───────────────────────────── */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("verticalsTitle")}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
              {verticals.map((v) => (
                <div
                  key={v.label}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <v.icon className="size-6" />
                  <span className="text-xs font-medium">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 3. Stats band ────────────────────────────────── */}
        <section className="border-b border-border bg-muted/20">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 sm:grid-cols-4">
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

        {/* ─── 4. The Problem (emotional hook) ──────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("problemKicker")}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("problemTitle")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("problemSubtitle")}
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {problemStats.map((s, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-7"
              >
                <div className="absolute -end-6 -top-6 size-24 rounded-full bg-rose-500/5 blur-2xl" />
                <span className="relative flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <s.icon className="size-5" />
                </span>
                <p className="relative mt-4 text-3xl font-extrabold tracking-tight">
                  {s.value}
                </p>
                <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 5. Features — animated scroll reveal ─────────── */}
        <section
          id="features"
          className="border-y border-border bg-muted/30"
        >
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <ScrollReveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t("featuresTitle")}
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  {t("featuresSubtitle")}
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-14">
              <AnimatedFeatureGrid features={features} />
            </div>
          </div>
        </section>

        {/* ─── 6. AI Agents showcase (the moat) — animated ─── */}
        <section className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-primary">
                <Zap className="size-4" />
                {t("agentsKicker")}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("agentsTitle")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("agentsSubtitle")}
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-14">
            <AnimatedAgentsShowcase agents={agents.map((a) => ({
              color: a.tint,
              iconBg: a.iconBg,
              icon: a.icon,
              title: a.title,
              desc: a.desc,
            }))} />
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("agentsFooter")}
          </p>
        </section>

        {/* ─── 7. How it works ──────────────────────────────── */}
        <section id="how" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <ScrollReveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t("howTitle")}
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  {t("howSubtitle")}
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <ScrollReveal key={s.n} delay={i * 0.12} direction="up">
                  <div className="relative rounded-2xl bg-card p-7 shadow-soft gradient-border">
                    <span className="flex size-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground glow-primary">
                      {s.n}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 8. Flagship — revenue saved ──────────────────── */}
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
                <p className="text-sm text-muted-foreground">
                  {t("statRevenue")}
                </p>
                <p className="mt-1 text-4xl font-extrabold text-primary">
                  12,400 SAR
                </p>
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

        {/* ─── 9. Voices / testimonials ─────────────────────── */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t("voicesKicker")}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("voicesTitle")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("voicesSubtitle")}
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {voices.map((v, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft"
                >
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className="size-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed">
                    “{v.quote}”
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {v.author.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{v.author}</p>
                      <p className="text-xs text-muted-foreground">{v.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 10. Pricing teaser ───────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("pricingKicker")}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("pricingTitle")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("pricingSubtitle")}
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {plans.map((p, i) => (
              <div
                key={i}
                className={
                  p.featured
                    ? "relative rounded-2xl border-2 border-primary bg-card p-7 shadow-soft md:-translate-y-2"
                    : "rounded-2xl border border-border bg-card p-7"
                }
              >
                {p.featured && p.badge && (
                  <span className="absolute -top-3 start-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {p.badge}
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {p.name}
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight">
                  {p.price}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
                <Button
                  asChild
                  variant={p.featured ? "default" : "outline"}
                  className="mt-6 w-full"
                >
                  <Link href="/register">{t("ctaPrimary")}</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {t("pricingSeeAll")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* ─── 11. FAQ ──────────────────────────────────────── */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t("faqKicker")}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("faqTitle")}
              </h2>
            </div>

            <div className="mt-12 flex flex-col gap-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-border bg-card px-5 py-4 transition-colors open:border-primary/40 open:bg-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-start text-base font-semibold">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 12. CTA band ─────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="bg-hero-mesh relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card px-8 py-14 text-center shadow-soft">
            <div className="bg-dots absolute inset-0 opacity-50" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="size-3.5 text-primary" />
                {t("badge")}
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                {t("ctaBandTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                {t("ctaBandSubtitle")}
              </p>
              {/* CTA band buttons — for un-authenticated visitors only */}
              {!isAuthed ? (
                <>
                  <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button size="lg" asChild>
                      <Link href="/register">
                        {t("ctaPrimary")}
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="/pricing">{t("ctaSecondary")}</Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">{t("noCard")}</p>
                </>
              ) : (
                <p className="mt-7 text-sm text-muted-foreground/80">
                  {t("ctaBandSignedIn")}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
