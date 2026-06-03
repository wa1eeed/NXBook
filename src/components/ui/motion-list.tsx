"use client"

// Staggered entrance for lists/grids. Short, purposeful (≤300ms) and
// fully disabled under prefers-reduced-motion (CLAUDE.md §13).
import { motion, useReducedMotion } from "motion/react"

export function MotionList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: {
            type: "spring",
            stiffness: 380,
            damping: 28,
            mass: 0.8,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
