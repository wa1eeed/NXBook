"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Check, Trash2, RefreshCw, CreditCard, Camera, AtSign,
  Share2, Globe, MessageCircle, MapPin, Video, Hash, Music,
} from "lucide-react"
import {
  THEME_PRESETS,
  RADIUS_REM,
  themeVars,
  type ThemeConfig,
  type ThemeMode,
  type ThemeRadius,
} from "@/lib/theme"
import {
  updateBusinessSettings,
  addDomainAction,
  verifyDomainAction,
  removeDomainAction,
  updateThemeSettings,
  savePaymentSettingsAction,
  connectGatewayAction,
  disconnectGatewayAction,
  savePublicPageAction,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface PaymentSettings {
  paymentEnabled: boolean
  depositPercent: number
  cancellationHours: number
  customerMessage: string
}

export interface GatewayData {
  provider: string | null
  isActive: boolean
  publicKey: string | null // masked ("••••") or null — never the real key
}

export interface DomainRow {
  id: string
  domain: string
  status: string
  verifyToken: string
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  VERIFYING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const RADII: ThemeRadius[] = ["none", "sm", "md", "lg", "xl"]
const MODES: ThemeMode[] = ["light", "dark"]

type Tab = "profile" | "appearance" | "publicPage" | "domains" | "payment"
const TABS: Tab[] = ["profile", "appearance", "publicPage", "domains", "payment"]

export interface PublicPageData {
  social: Record<string, string>
  location: Record<string, string>
  meeting: Record<string, string>
}

const MEETING_TYPES = ["in_person", "google_meet", "microsoft_teams", "zoom", "custom"] as const

// Booking-payment gateway catalog. NXBook Pay is the managed option
// (platform keys, flat fee) and needs no per-tenant credentials; the
// others are "bring your own keys".
interface GatewayDef {
  id: string // provider value persisted on PaymentGateway.provider
  name: string
  initials: string
  color: string
  managed: boolean
  fields: { key: "publicKey" | "secretKey" | "webhookSecret" | "profileId"; labelKey: string }[]
}

const GATEWAYS: GatewayDef[] = [
  {
    id: "NXBOOK_PAY",
    name: "NXBook Pay",
    initials: "NX",
    color: "#0EA5E9",
    managed: true,
    fields: [],
  },
  {
    id: "MOYASAR",
    name: "Moyasar",
    initials: "MY",
    color: "#0F766E",
    managed: false,
    fields: [
      { key: "publicKey", labelKey: "publicKeyLabel" },
      { key: "secretKey", labelKey: "secretKeyLabel" },
      { key: "webhookSecret", labelKey: "webhookSecretLabel" },
    ],
  },
  {
    id: "TAP",
    name: "Tap",
    initials: "TP",
    color: "#2563EB",
    managed: false,
    fields: [
      { key: "publicKey", labelKey: "publicKeyLabel" },
      { key: "secretKey", labelKey: "secretKeyLabel" },
      { key: "webhookSecret", labelKey: "webhookSecretLabel" },
    ],
  },
  {
    id: "PAYTABS",
    name: "PayTabs",
    initials: "PT",
    color: "#DB2777",
    managed: false,
    fields: [
      { key: "profileId", labelKey: "profileIdLabel" },
      { key: "secretKey", labelKey: "serverKeyLabel" },
    ],
  },
]

export function SettingsClient({
  business,
  domains,
  initialTheme,
  payment,
  gateway,
  publicPage,
}: {
  business: { name: string; brandColor: string; defaultLocale: string }
  domains: DomainRow[]
  initialTheme: ThemeConfig
  payment: PaymentSettings
  gateway: GatewayData
  publicPage: PublicPageData
}) {
  const t = useTranslations("settings")
  const ta = useTranslations("settings.appearance")
  const uiLocale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>("profile")
  const [locale, setLocale] = useState(business.defaultLocale)
  const [color, setColor] = useState(business.brandColor)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [newDomain, setNewDomain] = useState("")
  const [theme, setTheme] = useState<ThemeConfig>(initialTheme)

  // Payment tab state.
  const tp = useTranslations("settings.payment")
  const [payEnabled, setPayEnabled] = useState(payment.paymentEnabled)
  const [deposit, setDeposit] = useState(payment.depositPercent)
  const [cancelHours, setCancelHours] = useState(payment.cancellationHours)
  const [payMessage, setPayMessage] = useState(payment.customerMessage)
  const depositPresets = [100, 50, 25]
  const isCustomDeposit = !depositPresets.includes(deposit)

  // Gateway connection state — keyed by provider field, per open form.
  const [gatewayForm, setGatewayForm] = useState<Record<string, string>>({})

  // Public-page tab state.
  const tpp = useTranslations("settings.publicPage")
  const [social, setSocial] = useState<Record<string, string>>(publicPage.social)
  const [loc, setLoc] = useState<Record<string, string>>(publicPage.location)
  const [meetingType, setMeetingType] = useState<string>(
    publicPage.meeting.type ?? "in_person",
  )
  const [meetingUrl, setMeetingUrl] = useState<string>(publicPage.meeting.url ?? "")

  function savePublicPage() {
    setError("")
    startTransition(async () => {
      const res = await savePublicPageAction({
        social,
        location: loc,
        meeting: { type: meetingType as (typeof MEETING_TYPES)[number], url: meetingUrl },
      })
      if (res.ok) {
        toast.success(t("saved"))
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function connectGateway(def: GatewayDef) {
    startTransition(async () => {
      const res = await connectGatewayAction({
        provider: def.id,
        publicKey: gatewayForm[`${def.id}_publicKey`],
        secretKey: gatewayForm[`${def.id}_secretKey`],
        webhookSecret: gatewayForm[`${def.id}_webhookSecret`],
        config: gatewayForm[`${def.id}_profileId`]
          ? { profileId: gatewayForm[`${def.id}_profileId`] }
          : undefined,
      })
      if (res.ok) {
        setGatewayForm({})
        toast.success(tp("gatewayConnected"))
        router.refresh()
      } else {
        toast.error(res.error === "gatewayError" ? tp("gatewayError") : t(`error.${res.error}`))
      }
    })
  }

  function disconnectGateway() {
    startTransition(async () => {
      const res = await disconnectGatewayAction()
      if (res.ok) {
        toast.success(tp("gatewayDisconnected"))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  function setField(id: string, key: string, value: string) {
    setGatewayForm((prev) => ({ ...prev, [`${id}_${key}`]: value }))
  }

  function savePayment() {
    startTransition(async () => {
      const res = await savePaymentSettingsAction({
        paymentEnabled: payEnabled,
        depositPercent: deposit,
        cancellationHours: cancelHours,
        customerMessage: payMessage.trim() || undefined,
      })
      if (res.ok) toast.success(tp("saved"))
      else toast.error(t(`error.${res.error}`))
    })
  }

  function saveBusiness(formData: FormData) {
    setError("")
    setSaved(false)
    formData.set("defaultLocale", locale)
    formData.set("brandColor", color)
    startTransition(async () => {
      const res = await updateBusinessSettings(formData)
      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else setError(res.error)
    })
  }

  function addDomain() {
    setError("")
    if (!newDomain.trim()) return
    startTransition(async () => {
      const res = await addDomainAction(newDomain.trim())
      if (res.ok) {
        setNewDomain("")
        router.refresh()
      } else setError(res.error)
    })
  }

  function verify(id: string) {
    startTransition(async () => {
      await verifyDomainAction(id)
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeDomainAction(id)
      router.refresh()
    })
  }

  function pickPreset(id: string) {
    const p = THEME_PRESETS.find((x) => x.id === id)
    if (!p) return
    setTheme((prev) => ({
      ...prev,
      preset: id,
      primary: p.primary,
      secondary: p.secondary,
    }))
  }

  function saveTheme() {
    startTransition(async () => {
      const res = await updateThemeSettings(theme)
      if (res.ok) {
        toast.success(ta("saved"))
        router.refresh()
      } else {
        toast.error(ta("saveFailed"))
      }
    })
  }

  const previewStyle = themeVars(theme) as React.CSSProperties

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="inline-flex w-fit flex-wrap gap-1 rounded-md border border-border p-1">
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              tab === tb
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(`tabs.${tb}`)}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("business")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveBusiness} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("businessName")}</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={business.name}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="brandColor">{t("brandColor")}</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="brandColor"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-md border border-input"
                  />
                  <span className="font-mono text-sm text-muted-foreground">
                    {color}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("language")}</Label>
                <div className="inline-flex w-fit rounded-md border border-border p-1">
                  {["en", "ar"].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocale(l)}
                      className={cn(
                        "rounded px-3 py-1 text-sm transition-colors",
                        locale === l
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      {l === "en" ? "English" : "العربية"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{t(`error.${error}`)}</p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={pending}>
                  {t("save")}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="size-4" /> {t("saved")}
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "appearance" && (
        <Card className={cn("shadow-soft", theme.mode === "dark" && "dark")}>
          <CardHeader>
            <CardTitle className="text-base">{ta("title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>{ta("preset")}</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPreset(p.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-start text-sm transition-colors",
                      theme.preset === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className="size-5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.swatch }}
                    />
                    <span className="flex-1 font-medium">
                      {uiLocale === "ar" ? p.nameAr : p.nameEn}
                    </span>
                    {theme.preset === p.id && (
                      <Check className="size-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="primary">{ta("primaryColor")}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primary"
                  type="color"
                  onChange={(e) =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      primary: e.target.value,
                    }))
                  }
                  className="h-10 w-16 cursor-pointer rounded-md border border-input"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {theme.primary}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{ta("mode")}</Label>
              <div className="inline-flex w-fit rounded-md border border-border p-1">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTheme((prev) => ({ ...prev, mode: m }))}
                    className={cn(
                      "rounded px-3 py-1 text-sm transition-colors",
                      theme.mode === m
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {ta(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{ta("radius")}</Label>
              <div className="inline-flex w-fit flex-wrap gap-1 rounded-md border border-border p-1">
                {RADII.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTheme((prev) => ({ ...prev, radius: r }))}
                    className={cn(
                      "px-3 py-1 text-sm transition-colors",
                      theme.radius === r
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                    style={{ borderRadius: RADIUS_REM[r] }}
                  >
                    {ta(`radii.${r}`)}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              style={previewStyle}
            >
              <span className="text-sm text-muted-foreground">
                {ta("preview")}
              </span>
              <span
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                style={{ borderRadius: RADIUS_REM[theme.radius] }}
              >
                {ta("previewBtn")}
              </span>
            </div>

            <Button
              onClick={saveTheme}
              disabled={pending}
              className="self-start"
            >
              {ta("save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "publicPage" && (
        <div className="flex flex-col gap-6">
          {/* Social links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tpp("socialTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["instagram", Camera, "https://instagram.com/…"],
                  ["twitter", AtSign, "https://x.com/…"],
                  ["tiktok", Music, "https://tiktok.com/@…"],
                  ["snapchat", Hash, "https://snapchat.com/add/…"],
                  ["linkedin", Share2, "https://linkedin.com/company/…"],
                  ["website", Globe, "https://…"],
                  ["whatsapp", MessageCircle, "+9665…"],
                ] as [string, typeof Globe, string][]
              ).map(([key, Icon, ph]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5 text-xs capitalize">
                    <Icon className="size-3.5" />
                    {tpp(`social.${key}`)}
                  </Label>
                  <Input
                    value={social[key] ?? ""}
                    onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                    placeholder={ph}
                    dir="ltr"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" />
                {tpp("locationTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{tpp("googleMaps")}</Label>
                <Input
                  value={loc.googleMaps ?? ""}
                  onChange={(e) => setLoc({ ...loc, googleMaps: e.target.value })}
                  placeholder="https://maps.google.com/…"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{tpp("address")}</Label>
                <Input
                  value={loc.address ?? ""}
                  onChange={(e) => setLoc({ ...loc, address: e.target.value })}
                  placeholder={tpp("addressPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Meeting type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="size-4" />
                {tpp("meetingTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {MEETING_TYPES.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => setMeetingType(mt)}
                    className={cn(
                      "rounded-lg border p-3 text-sm font-medium transition-all",
                      meetingType === mt
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {tpp(`meeting.${mt}`)}
                  </button>
                ))}
              </div>
              {meetingType !== "in_person" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{tpp("meetingUrl")}</Label>
                  <Input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://…"
                    dir="ltr"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{t(`error.${error}`)}</p>}

          <Button onClick={savePublicPage} disabled={pending} className="self-start">
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      )}

      {tab === "domains" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("domains.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={t("domains.addPlaceholder")}
                dir="ltr"
              />
              <Button onClick={addDomain} disabled={pending || !newDomain.trim()}>
                {t("domains.add")}
              </Button>
            </div>

            {domains.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm">{d.domain}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLE[d.status] ?? "",
                      )}
                    >
                      {t(`domains.status.${d.status}`)}
                    </span>
                    {d.status !== "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => verify(d.id)}
                        disabled={pending}
                      >
                        <RefreshCw className="size-4" />
                        {t("domains.verify")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(d.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {d.status !== "ACTIVE" && (
                  <div className="mt-3 flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-xs">
                    <p className="text-muted-foreground">{t("domains.dnsHint")}</p>
                    <div dir="ltr" className="flex flex-col gap-1 font-mono">
                      <span>
                        <b>TXT</b> _nxbook-verify.{d.domain} = {d.verifyToken}
                      </span>
                      <span>
                        <b>A</b> {d.domain} → &lt;server-ip&gt;
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {domains.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("domains.empty")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "payment" && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tp("title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{tp("enablePayment")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={payEnabled}
                  onClick={() => setPayEnabled((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    payEnabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-background transition-transform",
                      payEnabled
                        ? "translate-x-6 rtl:-translate-x-6"
                        : "translate-x-1 rtl:-translate-x-1",
                    )}
                  />
                </button>
              </label>

              {payEnabled && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>{tp("depositTitle")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {depositPresets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDeposit(p)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm transition-colors",
                            deposit === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-accent",
                          )}
                        >
                          {p === 100
                            ? tp("deposit100")
                            : p === 50
                              ? tp("deposit50")
                              : tp("deposit25")}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDeposit(isCustomDeposit ? deposit : 10)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          isCustomDeposit
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        {tp("depositCustom")}
                      </button>
                    </div>
                    {isCustomDeposit && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={deposit}
                          onChange={(e) =>
                            setDeposit(
                              Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                            )
                          }
                          className="w-28"
                        />
                        <span className="text-sm text-muted-foreground">
                          {tp("depositPercent")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cancelHours">{tp("cancellationTitle")}</Label>
                    <Input
                      id="cancelHours"
                      type="number"
                      min={0}
                      max={168}
                      value={cancelHours}
                      onChange={(e) =>
                        setCancelHours(
                          Math.max(0, Math.min(168, Number(e.target.value) || 0)),
                        )
                      }
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      {tp("cancellationHours", { n: cancelHours })}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payMsg">{tp("customerMessage")}</Label>
                    <Textarea
                      id="payMsg"
                      maxLength={300}
                      value={payMessage}
                      onChange={(e) => setPayMessage(e.target.value)}
                      placeholder={tp("customerMessagePlaceholder")}
                    />
                  </div>
                </>
              )}

              <Button onClick={savePayment} disabled={pending} className="self-start">
                {tp("save")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tp("gatewayTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {GATEWAYS.map((g) => {
                const connected = gateway.isActive && gateway.provider === g.id
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border p-4",
                      connected ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex size-9 items-center justify-center rounded-md text-xs font-bold text-white"
                          style={{ backgroundColor: g.color }}
                        >
                          {g.initials}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium">{g.name}</span>
                          {g.managed && (
                            <span className="text-xs text-muted-foreground">
                              {tp("nxbookPayDesc")}
                            </span>
                          )}
                        </div>
                      </div>
                      {g.managed && !connected && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {tp("recommended")}
                        </span>
                      )}
                      {connected && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          <Check className="size-3" />
                          {tp("connected")}
                        </span>
                      )}
                    </div>

                    {connected ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {gateway.publicKey && !g.managed && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {gateway.publicKey}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={disconnectGateway}
                          disabled={pending}
                        >
                          {tp("disconnect")}
                        </Button>
                      </div>
                    ) : g.managed ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => connectGateway(g)}
                        disabled={pending}
                      >
                        <CreditCard className="size-4" />
                        {tp("connectGateway")}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {g.fields.map((f) => (
                          <div key={f.key} className="flex flex-col gap-1">
                            <Label className="text-xs" htmlFor={`${g.id}_${f.key}`}>
                              {tp(f.labelKey)}
                            </Label>
                            <Input
                              id={`${g.id}_${f.key}`}
                              type={f.key === "secretKey" || f.key === "webhookSecret" ? "password" : "text"}
                              dir="ltr"
                              value={gatewayForm[`${g.id}_${f.key}`] ?? ""}
                              onChange={(e) => setField(g.id, f.key, e.target.value)}
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          className="mt-1 w-full"
                          onClick={() => connectGateway(g)}
                          disabled={pending || !gatewayForm[`${g.id}_secretKey`]}
                        >
                          <CreditCard className="size-4" />
                          {tp("connectGateway")}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
