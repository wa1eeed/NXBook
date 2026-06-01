"use client"

// ============================================================
// Onboarding wizard — 4 steps per CLAUDE.md §12:
//   1. language  → sets the business default locale (+ UI locale)
//   2. type      → loads a vertical template (services/hours)
//   3. name+slug → live subdomain availability check
//   4. branding  → logo upload (R2 presign) + brand color
// Persists everything via completeOnboarding, then refreshes the
// session and lands on the new tenant's public page.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { setLocale } from "@/i18n/actions"
import { checkSlug, completeOnboarding } from "./actions"
import { BUSINESS_TYPES } from "@/lib/templates"
import { locales, type Locale } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SlugState = "idle" | "checking" | "available" | "unavailable"

export function OnboardingWizard() {
  const t = useTranslations("onboarding")
  const uiLocale = useLocale() as Locale
  const router = useRouter()
  const { update } = useSession()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState(1)
  const [locale, setChosenLocale] = useState<Locale>(uiLocale)
  const [type, setType] = useState<string>("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugState, setSlugState] = useState<SlugState>("idle")
  const [slugReason, setSlugReason] = useState<string>("")
  const [brandColor, setBrandColor] = useState("#0EA5E9")
  const [logoUrl, setLogoUrl] = useState("")
  const [error, setError] = useState("")

  const totalSteps = 4

  function chooseLanguage(l: Locale) {
    setChosenLocale(l)
    // Reflect the choice in the UI immediately.
    startTransition(() => setLocale(l))
  }

  function onSlugChange(value: string) {
    const v = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setSlug(v)
    setSlugState("idle")
    if (v.length < 3) return
    setSlugState("checking")
    startTransition(async () => {
      const res = await checkSlug(v)
      setSlugState(res.available ? "available" : "unavailable")
      setSlugReason(res.reason ?? "")
    })
  }

  async function uploadLogo(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    // Presign via the existing upload route (scoped to the session user).
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "business_logo", ext }),
    })
    if (!res.ok) return
    const { uploadUrl, publicUrl } = await res.json()
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    setLogoUrl(publicUrl)
  }

  function finish() {
    setError("")
    startTransition(async () => {
      const res = await completeOnboarding({
        locale,
        type: type as never,
        name,
        slug,
        logoUrl,
        brandColor,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      // Refresh the JWT so businessId/onboardingDone are populated.
      // We then do a hard navigation (window.location) instead of
      // router.push so that the full page reload picks up the refreshed
      // JWT cookie — router.push inside a transition can fire before the
      // updated session propagates, causing the middleware to see the old
      // token (businessId=null) and bounce back to /onboarding.
      await update()
      window.location.href = "/dashboard"
    })
  }

  const canNext =
    (step === 1 && !!locale) ||
    (step === 2 && !!type) ||
    (step === 3 && name.length >= 2 && slugState === "available") ||
    step === 4

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="mb-2 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <CardTitle>{t(`step${step}Title`)}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Step 1 — language */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => chooseLanguage(l)}
                className={cn(
                  "rounded-lg border p-4 text-center text-sm font-medium transition-colors",
                  locale === l
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — business type */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((bt) => (
              <button
                key={bt.type}
                type="button"
                onClick={() => setType(bt.type)}
                className={cn(
                  "rounded-lg border p-4 text-start text-sm font-medium transition-colors",
                  type === bt.type
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                {locale === "ar" ? bt.labelAr : bt.labelEn}
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — name + slug */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("businessName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">{t("claimSlug")}</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="my-clinic"
                  className="font-mono"
                />
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  .nxbook.app
                </span>
              </div>
              {slugState === "checking" && (
                <p className="text-sm text-muted-foreground">{t("slugChecking")}</p>
              )}
              {slugState === "available" && (
                <p className="text-sm text-green-600">{t("slugAvailable")}</p>
              )}
              {slugState === "unavailable" && (
                <p className="text-sm text-destructive">
                  {t(`slugError.${slugReason || "taken"}`)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4 — branding */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo">{t("logo")}</Label>
              <Input
                id="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) startTransition(() => uploadLogo(f) as never)
                }}
              />
              {logoUrl && (
                <p className="text-sm text-green-600">{t("logoUploaded")}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="color">{t("brandColor")}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-md border border-input"
                />
                <span className="font-mono text-sm text-muted-foreground">
                  {brandColor}
                </span>
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive">{t(`error.${error}`)}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || pending}
          >
            {t("back")}
          </Button>
          {step < totalSteps ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext || pending}
            >
              {t("next")}
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={pending}>
              {pending ? t("finishing") : t("finish")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
