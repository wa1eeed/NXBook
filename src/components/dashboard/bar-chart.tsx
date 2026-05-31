// Lightweight CSS bar chart — no chart library dependency. Renders a
// row of vertical bars scaled to the max value. Works in RTL via flex.
import { cn } from "@/lib/utils"

export interface Bar {
  label: string
  value: number
  sub?: string
}

export function BarChart({
  bars,
  className,
  accent = "var(--color-primary)",
}: {
  bars: Bar[]
  className?: string
  accent?: string
}) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className={cn("flex items-end gap-1", className)}>
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-32 w-full items-end justify-center">
            <div
              className="w-full max-w-8 rounded-t transition-all"
              style={{
                height: `${(b.value / max) * 100}%`,
                minHeight: b.value > 0 ? "4px" : "0",
                backgroundColor: accent,
                opacity: b.value > 0 ? 1 : 0.15,
              }}
              title={`${b.label}: ${b.value}`}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
