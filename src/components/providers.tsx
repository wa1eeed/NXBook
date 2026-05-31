"use client"

// Client-side context providers. SessionProvider exposes useSession()
// (needed to refresh the JWT after onboarding). The Toaster mounts once
// here so any client component can fire toasts via react-hot-toast.
import { SessionProvider } from "next-auth/react"
import { Toaster } from "react-hot-toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          },
          success: { iconTheme: { primary: "var(--primary)", secondary: "var(--card)" } },
        }}
      />
    </SessionProvider>
  )
}
