"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { ArrowLeft, Upload, Check } from "lucide-react"
import { importCustomersAction } from "../actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

interface ParsedRow {
  name: string
  phone: string
  email?: string
  notes?: string
  valid: boolean
}

// Split a single CSV line, honoring simple double-quoted fields.
function splitLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  // Detect optional header row.
  const first = splitLine(lines[0]).map((c) => c.toLowerCase())
  const hasHeader =
    first.includes("name") || first.includes("phone") || first.includes("email")
  const idx = {
    name: hasHeader ? first.indexOf("name") : 0,
    phone: hasHeader ? first.indexOf("phone") : 1,
    email: hasHeader ? first.indexOf("email") : 2,
    notes: hasHeader ? first.indexOf("notes") : 3,
  }
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = splitLine(line)
    const name = idx.name >= 0 ? cells[idx.name] ?? "" : ""
    const phone = idx.phone >= 0 ? cells[idx.phone] ?? "" : ""
    const email = idx.email >= 0 ? cells[idx.email] ?? "" : ""
    const notes = idx.notes >= 0 ? cells[idx.notes] ?? "" : ""
    return {
      name,
      phone,
      email: email || undefined,
      notes: notes || undefined,
      valid: name.length > 0 && phone.length >= 7,
    }
  })
}

export function ImportClient() {
  const t = useTranslations("customers")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(
    null,
  )

  const validRows = rows.filter((r) => r.valid)

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""))
      if (parsed.length === 0) {
        toast.error(t("importEmpty"))
        return
      }
      setRows(parsed)
      setStep(2)
    }
    reader.onerror = () => toast.error(t("error.importFailed"))
    reader.readAsText(file)
  }

  function doImport() {
    if (validRows.length === 0) {
      toast.error(t("importEmpty"))
      return
    }
    startTransition(async () => {
      const res = await importCustomersAction(
        validRows.map((r) => ({
          name: r.name,
          phone: r.phone,
          email: r.email,
          notes: r.notes,
        })),
      )
      if (res.ok) {
        setResult({ imported: res.imported, skipped: res.skipped })
        setStep(3)
        router.refresh()
      } else {
        toast.error(t("error.importFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("importTitle")}
        description={t("importSubtitle")}
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/customers">
              <ArrowLeft className="size-4" />
              {t("title")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="py-6">
          {step === 1 && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:bg-accent/40">
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">{t("importUpload")}</span>
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFile(f)
                }}
              />
            </label>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">{t("importPreview")}</h2>
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start">{t("name")}</th>
                      <th className="p-2 text-start">{t("phone")}</th>
                      <th className="p-2 text-start">{t("email")}</th>
                      <th className="p-2 text-start">{t("notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-t border-border",
                          !r.valid && "bg-red-50 text-muted-foreground line-through dark:bg-red-950/30",
                        )}
                        title={!r.valid ? t("importSkipped") : undefined}
                      >
                        <td className="p-2">{r.name || "—"}</td>
                        <td className="p-2" dir="ltr">{r.phone || "—"}</td>
                        <td className="p-2" dir="ltr">{r.email ?? "—"}</td>
                        <td className="p-2">{r.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                  <ArrowLeft className="size-4" />
                  {t("importUpload")}
                </Button>
                <Button onClick={doImport} disabled={pending || validRows.length === 0}>
                  {t("importConfirm", { n: validRows.length })}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && result && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                <Check className="size-6" />
              </span>
              <p className="font-medium">
                {t("importResult", {
                  imported: result.imported,
                  skipped: result.skipped,
                })}
              </p>
              <Button asChild>
                <Link href="/dashboard/customers">{t("title")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
