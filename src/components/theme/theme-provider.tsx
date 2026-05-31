// ============================================================
// ThemeProvider — injects a business's theme as inline CSS vars on a
// wrapper div, and toggles the `dark` class for dark mode. Server
// component: takes a resolved ThemeConfig and renders its children
// inside the themed scope. Used by the dashboard shell and the public
// tenant page so each business renders in its own brand.
// ============================================================

import type { CSSProperties } from "react"
import { themeVars, type ThemeConfig } from "@/lib/theme"

export function ThemeScope({
  theme,
  className,
  children,
}: {
  theme: ThemeConfig
  className?: string
  children: React.ReactNode
}) {
  const isDark = theme.mode === "dark"
  return (
    <div
      className={[isDark ? "dark" : "", className].filter(Boolean).join(" ")}
      style={themeVars(theme) as CSSProperties}
    >
      {children}
    </div>
  )
}
