import { cn } from "@/lib/utils"

// Color-coded status pill shared across the admin panel.
// ACTIVE=green, TRIALING=amber, CANCELLED/PAST_DUE=gray, anything
// falsy / INACTIVE=red. Label is passed in already-localized.
const TONE: Record<string, string> = {
  ACTIVE:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  TRIALING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  RUNNING:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  CANCELLED:
    "bg-muted text-muted-foreground",
  PAST_DUE:
    "bg-muted text-muted-foreground",
  INACTIVE:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  FAILED:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined
  label?: string
}) {
  const key = (status ?? "INACTIVE").toUpperCase()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[key] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label ?? status ?? "—"}
    </span>
  )
}
