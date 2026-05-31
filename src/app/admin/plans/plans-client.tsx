"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Pencil } from "lucide-react"
import {
  updatePlanAction,
  updateTrialPolicyAction,
  type PlanInput,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface PlanRow {
  id: string
  name: string
  tier: string
  priceMonthly: number
  priceYearly: number
  trialDays: number
  isTrialUpgradeForced: boolean
  maxStaff: number
  maxServices: number
  maxAgents: number
  subscribers: number
}

export interface TrialPolicy {
  enabled: boolean
  defaultDays: number
  upgradeForced: boolean
}

export function PlansClient({
  plans,
  trialPolicy,
}: {
  plans: PlanRow[]
  trialPolicy: TrialPolicy
}) {
  const t = useTranslations("admin.plans")

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>

      <TrialPolicyCard policy={trialPolicy} />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  )
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const t = useTranslations("admin.plans")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PlanInput>({
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    trialDays: plan.trialDays,
    isTrialUpgradeForced: plan.isTrialUpgradeForced,
    maxStaff: plan.maxStaff,
    maxServices: plan.maxServices,
    maxAgents: plan.maxAgents,
  })

  function cancel() {
    setForm({
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      trialDays: plan.trialDays,
      isTrialUpgradeForced: plan.isTrialUpgradeForced,
      maxStaff: plan.maxStaff,
      maxServices: plan.maxServices,
      maxAgents: plan.maxAgents,
    })
    setError(null)
    setEditing(false)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updatePlanAction(plan.id, form)
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(t("saveError"))
      }
    })
  }

  const set = (patch: Partial<PlanInput>) => setForm((f) => ({ ...f, ...patch }))
  const fmtLimit = (n: number) => (n < 0 ? "∞" : String(n))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{plan.name}</span>
          <span className="text-xs text-muted-foreground">{plan.tier}</span>
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subscribers")}: <span className="font-medium text-foreground">{plan.subscribers}</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {editing ? (
          <>
            <NumberField
              label={t("priceMonthly")}
              value={form.priceMonthly}
              disabled={pending}
              onChange={(v) => set({ priceMonthly: v })}
            />
            <NumberField
              label={t("priceYearly")}
              value={form.priceYearly}
              disabled={pending}
              onChange={(v) => set({ priceYearly: v })}
            />
            <NumberField
              label={t("trialDays")}
              value={form.trialDays}
              disabled={pending}
              onChange={(v) => set({ trialDays: v })}
            />
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label={t("maxStaff")}
                value={form.maxStaff}
                disabled={pending}
                onChange={(v) => set({ maxStaff: v })}
              />
              <NumberField
                label={t("maxServices")}
                value={form.maxServices}
                disabled={pending}
                onChange={(v) => set({ maxServices: v })}
              />
              <NumberField
                label={t("maxAgents")}
                value={form.maxAgents}
                disabled={pending}
                onChange={(v) => set({ maxAgents: v })}
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isTrialUpgradeForced}
                disabled={pending}
                onChange={(e) => set({ isTrialUpgradeForced: e.target.checked })}
                className="size-4 rounded border-input"
              />
              <span>{t("upgradeForced")}</span>
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={pending} className="flex-1">
                <Check className="size-4" /> {t("save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancel}
                disabled={pending}
                className="flex-1"
              >
                {t("cancel")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">
              {plan.priceMonthly}{" "}
              <span className="text-sm font-normal text-muted-foreground">SAR/mo</span>
            </p>
            <Row label={t("priceYearly")} value={`${plan.priceYearly} SAR`} />
            <Row label={t("trialDays")} value={String(plan.trialDays)} />
            <Row label={t("maxStaff")} value={fmtLimit(plan.maxStaff)} />
            <Row label={t("maxServices")} value={fmtLimit(plan.maxServices)} />
            <Row label={t("maxAgents")} value={fmtLimit(plan.maxAgents)} />
            <Row
              label={t("upgradeForced")}
              value={plan.isTrialUpgradeForced ? "✓" : "—"}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="mt-1 self-start"
            >
              <Pencil className="size-4" /> {t("edit")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function TrialPolicyCard({ policy }: { policy: TrialPolicy }) {
  const t = useTranslations("admin.plans")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<TrialPolicy>(policy)

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateTrialPolicyAction(form)
      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else {
        setError(t("saveError"))
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("trialPolicy")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm sm:max-w-md">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={pending}
            onChange={(e) => {
              setForm((f) => ({ ...f, enabled: e.target.checked }))
              setSaved(false)
            }}
            className="size-4 rounded border-input"
          />
          <span>{t("trialEnabled")}</span>
        </label>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("defaultTrialDays")}
          </Label>
          <Input
            type="number"
            value={form.defaultDays}
            disabled={pending}
            onChange={(e) => {
              setForm((f) => ({
                ...f,
                defaultDays: e.target.value === "" ? 0 : Number(e.target.value),
              }))
              setSaved(false)
            }}
            className="max-w-[8rem]"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.upgradeForced}
            disabled={pending}
            onChange={(e) => {
              setForm((f) => ({ ...f, upgradeForced: e.target.checked }))
              setSaved(false)
            }}
            className="size-4 rounded border-input"
          />
          <span>{t("globalUpgradeForced")}</span>
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={pending}>
            <Check className="size-4" /> {t("save")}
          </Button>
          {saved && (
            <span className={cn("text-xs text-green-600 dark:text-green-400")}>
              {t("saved")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
