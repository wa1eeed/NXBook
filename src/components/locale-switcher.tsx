"use client"

// ============================================================
// LocaleSwitcher — lets a visitor switch between English and
// Arabic. Persists the choice via the setLocale server action
// (NEXT_LOCALE cookie); the layout re-renders with new dir/lang.
// ============================================================

import { useLocale } from "next-intl"
import { useTransition } from "react"
import { setLocale } from "@/i18n/actions"
import { locales, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

const LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
}

export function LocaleSwitcher() {
  const active = useLocale() as Locale
  const [isPending, startTransition] = useTransition()

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border p-1">
      {locales.map((locale) => {
        const isActive = locale === active
        return (
          <button
            key={locale}
            type="button"
            disabled={isPending || isActive}
            onClick={() => startTransition(() => setLocale(locale))}
            aria-pressed={isActive}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {LABELS[locale]}
          </button>
        )
      })}
    </div>
  )
}
