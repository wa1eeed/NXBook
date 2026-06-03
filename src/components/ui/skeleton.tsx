import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded-md", className)}
      {...props}
    />
  )
}

// Pre-built skeleton layouts
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <Skeleton className="size-9 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}

// Keep legacy export for existing consumers
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
