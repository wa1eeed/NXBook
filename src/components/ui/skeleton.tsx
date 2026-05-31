import { cn } from "@/lib/utils"

// Pulsing placeholder shown while content loads.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// A ready-made list-of-rows skeleton for dashboard pages.
function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-border p-4"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="size-9 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, ListSkeleton }
