// ============================================================
// Theme system — customizable per-business appearance.
// A business stores a themeConfig { preset, primary, secondary,
// radius, mode }. We resolve it to CSS custom properties that the
// ThemeProvider injects inline, so the tenant's public page and
// dashboard render in their brand. ALL colors flow through CSS
// variables — never hardcoded (CLAUDE.md §13).
// ============================================================

export type ThemeMode = "light" | "dark"
export type ThemeRadius = "none" | "sm" | "md" | "lg" | "xl"

export interface ThemeConfig {
  preset: string // preset id, or "custom"
  primary: string // oklch(...) or hex — used as the brand accent
  secondary: string // oklch(...) for subtle accents/charts
  radius: ThemeRadius
  mode: ThemeMode | "system"
}

export interface ThemePreset {
  id: string
  nameEn: string
  nameAr: string
  primary: string
  secondary: string
  // A swatch for preview cards (CSS color).
  swatch: string
}

// 6 curated presets. Primary in oklch for perceptual consistency.
export const THEME_PRESETS: ThemePreset[] = [
  { id: "indigo", nameEn: "Indigo", nameAr: "إنديغو", primary: "oklch(0.511 0.262 276.97)", secondary: "oklch(0.7 0.16 330)", swatch: "#5b53e8" },
  { id: "emerald", nameEn: "Emerald", nameAr: "زمردي", primary: "oklch(0.6 0.17 162)", secondary: "oklch(0.7 0.15 195)", swatch: "#0ea66e" },
  { id: "rose", nameEn: "Rose", nameAr: "وردي", primary: "oklch(0.62 0.22 12)", secondary: "oklch(0.7 0.18 350)", swatch: "#e54666" },
  { id: "amber", nameEn: "Amber", nameAr: "كهرماني", primary: "oklch(0.71 0.17 65)", secondary: "oklch(0.65 0.17 45)", swatch: "#e08c2b" },
  { id: "ocean", nameEn: "Ocean", nameAr: "محيطي", primary: "oklch(0.58 0.16 230)", secondary: "oklch(0.66 0.15 200)", swatch: "#1f8fcf" },
  { id: "slate", nameEn: "Slate", nameAr: "رمادي", primary: "oklch(0.45 0.04 265)", secondary: "oklch(0.6 0.05 265)", swatch: "#4a5568" },
]

export const RADIUS_REM: Record<ThemeRadius, string> = {
  none: "0rem",
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.125rem",
}

export const DEFAULT_THEME: ThemeConfig = {
  preset: "indigo",
  primary: THEME_PRESETS[0].primary,
  secondary: THEME_PRESETS[0].secondary,
  radius: "md",
  mode: "light",
}

// Parse a stored themeConfig (Prisma Json) into a complete ThemeConfig,
// filling gaps from DEFAULT_THEME. Tolerant of nulls/partials.
export function resolveTheme(raw: unknown): ThemeConfig {
  const t = (raw ?? {}) as Partial<ThemeConfig>
  return {
    preset: t.preset ?? DEFAULT_THEME.preset,
    primary: t.primary ?? DEFAULT_THEME.primary,
    secondary: t.secondary ?? DEFAULT_THEME.secondary,
    radius: (t.radius as ThemeRadius) ?? DEFAULT_THEME.radius,
    mode: t.mode ?? DEFAULT_THEME.mode,
  }
}

/**
 * Build the inline CSS variables for a resolved theme. Returns a style
 * object suitable for a wrapping element. Only the brand-driven tokens
 * are overridden; the rest inherit from globals.css.
 */
export function themeVars(theme: ThemeConfig): Record<string, string> {
  return {
    "--primary": theme.primary,
    "--ring": theme.primary,
    "--sidebar-primary": theme.primary,
    "--sidebar-ring": theme.primary,
    "--chart-1": theme.primary,
    "--chart-2": theme.secondary,
    "--radius": RADIUS_REM[theme.radius],
  }
}
