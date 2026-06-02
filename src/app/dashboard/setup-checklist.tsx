// Onboarding checklist that surfaces ONLY for businesses that haven't
// finished setting up yet. Each step links to the right page. Once all
// steps are done the component renders nothing.
//
// Server component — reads its data fresh on each dashboard load so a
// completed step disappears on the next refresh without client state.

import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SetupStatus {
  hasService: boolean
  hasAvailability: boolean
  hasBranding: boolean // logoUrl or non-default brandColor
  hasFirstBooking: boolean
  publicUrl: string
}

export async function SetupChecklist({ status }: { status: SetupStatus }) {
  const t = await getTranslations("dashboard.setup")

  const steps = [
    {
      key: "service",
      done: status.hasService,
      href: "/dashboard/services",
      label: t("addServices"),
      desc: t("addServicesDesc"),
    },
    {
      key: "availability",
      done: status.hasAvailability,
      // Only useful AFTER a service exists; otherwise dump them at the list.
      href: "/dashboard/services",
      label: t("setAvailability"),
      desc: t("setAvailabilityDesc"),
    },
    {
      key: "branding",
      done: status.hasBranding,
      href: "/dashboard/settings",
      label: t("brandIt"),
      desc: t("brandItDesc"),
    },
    {
      key: "share",
      done: status.hasFirstBooking,
      href: status.publicUrl,
      external: true,
      label: t("share"),
      desc: t("shareDesc"),
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-5 shadow-soft">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("subtitle", { done: doneCount, total: steps.length })}
            </p>
          </div>
        </div>
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <span className="text-sm font-semibold tabular-nums">{pct}%</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              {...(s.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3 transition-all",
                s.done
                  ? "border-primary/20 bg-background/60"
                  : "border-border bg-background hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
              )}
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium leading-tight",
                    s.done && "text-muted-foreground line-through",
                  )}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {!s.done && (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
