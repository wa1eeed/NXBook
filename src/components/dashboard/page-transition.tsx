"use client"

import { motion, useReducedMotion } from "motion/react"

// Subtle fade + slight upward slide on every dashboard page navigation.
// Respects prefers-reduced-motion — falls back to plain div.
export function DashboardPageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.9 }}
    >
      {children}
    </motion.div>
  )
}
