"use client"

// Global error boundary — catches root-level render/runtime errors,
// reports them to Sentry, and shows a minimal recovery screen instead
// of a bare "Internal Server Error". (Next.js requires this to be a
// full HTML document because it replaces the root layout on error.)
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#0b0b0f",
          color: "#e5e5ea",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 520, padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#9a9aa2", marginBottom: 16 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ color: "#6a6a72", fontSize: 12, fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#5b53e8",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
