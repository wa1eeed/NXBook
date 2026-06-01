"use client"

// Dashboard-scoped error boundary — keeps the chrome and surfaces a
// recoverable error instead of a full-page 500 when a server query
// (e.g. DB unavailable) throws inside a dashboard route.
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Couldn&apos;t load this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        A server error occurred while loading your dashboard. If this keeps
        happening, the database may be unreachable or not yet migrated.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
