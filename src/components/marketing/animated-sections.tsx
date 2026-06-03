"use client"

/**
 * animated-sections.tsx
 *
 * Client-side animated components for the NXBook marketing landing page.
 * All motion is purposeful and performance-conscious (will-change + layout
 * animations only where needed). Dark mode and RTL work out of the box via
 * CSS variables and logical CSS properties.
 *
 * Exports:
 *   AnimatedHero          — headline + mock dashboard + social proof
 *   AnimatedFeatureGrid   — staggered scroll-triggered feature cards
 *   AnimatedStats         — count-up numbers
 *   AnimatedAgentsShowcase — agent cards with shine hover effect
 *   ScrollReveal          — generic scroll-triggered reveal wrapper
 */

import React, { useRef, useEffect, useState } from "react"
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react"
import {
  ArrowRight,
  Star,
  Bot,
  CalendarCheck,
  TrendingUp,
  Users,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px", amount: threshold })
  return { ref, isInView }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AnimatedHero
// ─────────────────────────────────────────────────────────────────────────────

interface HeroStat {
  value: string
  label: string
}

interface AnimatedHeroProps {
  headline: string
  subheadline: string
  ctaPrimary: string
  ctaSecondary: string
  isAuthed: boolean
  stats: HeroStat[]
  /** Optional social proof label below star ratings */
  trustedByLabel?: string
  /** Optional "no credit card" disclaimer */
  noCardLabel?: string
  /** Optional live badge label */
  liveBadgeLabel?: string
}

export function AnimatedHero({
  headline,
  subheadline,
  ctaPrimary,
  ctaSecondary,
  isAuthed,
  stats,
  trustedByLabel,
  noCardLabel,
  liveBadgeLabel,
}: AnimatedHeroProps) {
  // Split headline into words for staggered animation
  const words = headline.split(" ")

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  }

  const wordVariants = {
    hidden: { opacity: 0, y: 32, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.7, ease: EASE_OUT_EXPO },
    },
  }

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: 0.55, ease: EASE_OUT_EXPO },
    },
  }

  const ctaVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.75, ease: EASE_OUT_EXPO },
    },
  }

  const socialProofVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.95, ease: EASE_OUT_EXPO },
    },
  }

  const dashboardVariants = {
    hidden: { opacity: 0, y: 48, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.9, delay: 0.3, ease: EASE_OUT_EXPO },
    },
  }

  // Floating animation config (applied directly, not via variants)
  const floatAnimate = {
    y: [0, -10, 0] as number[],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  }

  // Agent notification chip float
  const chipVariants = {
    hidden: { opacity: 0, x: 24, scale: 0.9 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.6, delay: 1.1, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <section className="bg-hero-mesh relative overflow-hidden">
      <div className="bg-dots absolute inset-0 opacity-40" />

      {/* Decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-40 -top-40 size-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.511 0.262 277 / 0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-32 top-20 size-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.7 0.2 330 / 0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-20 sm:pb-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-background/70 px-4 py-1.5 text-sm font-medium text-foreground shadow-soft backdrop-blur">
              <span className="pulse-dot relative size-2 rounded-full bg-emerald-500 text-emerald-500" />
              {liveBadgeLabel ?? "Live — bookings happening now"}
            </span>
          </motion.div>

          {/* Headline — word-by-word stagger */}
          <motion.h1
            className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            aria-label={headline}
          >
            {words.map((word, i) => {
              // Apply gradient to last two words (the differentiator phrase)
              const isAccent = i >= words.length - 2
              return (
                <React.Fragment key={i}>
                  <motion.span
                    className={cn(
                      "inline-block",
                      isAccent && "text-gradient",
                    )}
                    variants={wordVariants}
                  >
                    {word}
                  </motion.span>
                  {i < words.length - 1 && " "}
                </React.Fragment>
              )
            })}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            variants={subtitleVariants}
            initial="hidden"
            animate="visible"
          >
            {subheadline}
          </motion.p>

          {/* CTAs */}
          {!isAuthed && (
            <motion.div
              variants={ctaVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href="/register"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition-shadow hover:shadow-[0_0_0_3px_oklch(0.511_0.262_277_/_0.25)] sm:w-auto"
                  >
                    {ctaPrimary}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href="#how"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-7 py-3.5 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-muted sm:w-auto"
                  >
                    {ctaSecondary}
                  </Link>
                </motion.div>
              </div>

              {noCardLabel && (
                <p className="mt-3 text-sm text-muted-foreground">{noCardLabel}</p>
              )}
            </motion.div>
          )}

          {/* Social proof */}
          <motion.div
            className="mt-6 inline-flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            variants={socialProofVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Stacked avatars */}
            <div className="flex -space-x-2">
              {["V", "A", "S", "M", "L"].map((letter, i) => (
                <span
                  key={i}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-primary-foreground"
                  style={{
                    background: `oklch(${0.45 + i * 0.03} 0.22 ${270 + i * 12})`,
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
              </span>
              <span>{trustedByLabel ?? "Trusted by 500+ businesses"}</span>
            </div>
          </motion.div>
        </div>

        {/* ── Mock dashboard preview ── */}
        <motion.div
          className="relative mx-auto mt-16 max-w-5xl"
          variants={dashboardVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            animate={floatAnimate}
            className="ring-soft overflow-hidden rounded-2xl border border-border bg-card"
            style={{ willChange: "transform" }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-rose-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
              <span className="ms-3 truncate rounded-md bg-background/70 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                nxbook.app/dashboard
              </span>
            </div>

            {/* Dashboard content */}
            <div className="grid gap-px bg-border sm:grid-cols-[200px_1fr]">
              {/* Sidebar */}
              <div className="hidden flex-col gap-1 bg-card p-4 sm:flex">
                {["Home", "Bookings", "Customers", "Agents", "Reports"].map(
                  (l, i) => (
                    <div
                      key={l}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm",
                        i === 0
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {l}
                    </div>
                  ),
                )}
              </div>

              {/* Main area */}
              <div className="bg-card p-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Today", value: "18", sub: "+4 vs yest", color: "text-emerald-600" },
                    { label: "Show rate", value: "92%", sub: "+8% MoM", color: "text-emerald-600" },
                    { label: "Saved", value: "1,840", sub: "SAR · waitlist", color: "text-violet-600" },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="mt-1 text-xl font-bold tracking-tight">{k.value}</p>
                      <p className={cn("mt-0.5 text-[10px]", k.color)}>{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <div className="mt-4 rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-end justify-between">
                    <p className="text-sm font-medium">Bookings this week</p>
                    <p className="text-xs text-muted-foreground">Mon — Sun</p>
                  </div>
                  <div className="flex items-end gap-2">
                    {[55, 70, 50, 85, 95, 78, 100].map((h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary"
                        initial={{ height: 0 }}
                        animate={{ height: h }}
                        transition={{
                          duration: 0.6,
                          delay: 0.8 + i * 0.07,
                          ease: EASE_OUT_EXPO,
                        }}
                        style={{ willChange: "height" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating agent notification chip */}
          <motion.div
            className="absolute -bottom-6 end-2 hidden rounded-xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur sm:flex sm:items-center sm:gap-3"
            variants={chipVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="size-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Waitlist Agent</span>
              <span className="text-[11px] text-muted-foreground">
                Slot offered to Sara — 2 min ago
              </span>
            </div>
            <span className="size-2 rounded-full bg-emerald-500" />
          </motion.div>

          {/* Subtle glow under the dashboard */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(ellipse, oklch(0.511 0.262 277 / 0.18) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AnimatedFeatureGrid
// ─────────────────────────────────────────────────────────────────────────────

interface Feature {
  /** Lucide icon component */
  icon: React.ElementType
  title: string
  desc: string
  /** Tailwind color class prefix e.g. "violet" → bg-violet-500/10, text-violet-600 */
  color?: string
}

interface AnimatedFeatureGridProps {
  features: Feature[]
}

const FEATURE_COLORS = [
  { bg: "bg-violet-500/10 dark:bg-violet-500/15", icon: "text-violet-600 dark:text-violet-400", glow: "group-hover:shadow-violet-500/20" },
  { bg: "bg-indigo-500/10 dark:bg-indigo-500/15", icon: "text-indigo-600 dark:text-indigo-400", glow: "group-hover:shadow-indigo-500/20" },
  { bg: "bg-sky-500/10 dark:bg-sky-500/15",    icon: "text-sky-600 dark:text-sky-400",    glow: "group-hover:shadow-sky-500/20"    },
  { bg: "bg-emerald-500/10 dark:bg-emerald-500/15", icon: "text-emerald-600 dark:text-emerald-400", glow: "group-hover:shadow-emerald-500/20" },
  { bg: "bg-amber-500/10 dark:bg-amber-500/15", icon: "text-amber-600 dark:text-amber-400", glow: "group-hover:shadow-amber-500/20" },
  { bg: "bg-rose-500/10 dark:bg-rose-500/15",  icon: "text-rose-600 dark:text-rose-400",  glow: "group-hover:shadow-rose-500/20"  },
]

export function AnimatedFeatureGrid({ features }: AnimatedFeatureGridProps) {
  const { ref, isInView } = useScrollReveal(0.1)

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.09,
      },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 36, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <motion.div
      ref={ref}
      className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {features.map((feature, i) => {
        const palette = FEATURE_COLORS[i % FEATURE_COLORS.length]
        const Icon = feature.icon

        return (
          <motion.div
            key={i}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border bg-card p-6",
              "transition-all duration-300",
              "hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_16px_40px_-12px_oklch(0.511_0.262_277_/_0.22)]",
            )}
            variants={cardVariants}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            {/* Subtle background glow on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 20%, oklch(0.511 0.262 277 / 0.06) 0%, transparent 60%)",
              }}
            />

            {/* Top border glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />

            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-xl transition-colors duration-300",
                palette.bg,
                "group-hover:bg-primary group-hover:shadow-md",
                palette.glow,
              )}
            >
              <Icon
                className={cn(
                  "size-6 transition-colors duration-300",
                  palette.icon,
                  "group-hover:text-primary-foreground",
                )}
              />
            </div>

            <h3 className="mt-5 text-lg font-semibold leading-snug">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.desc}
            </p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AnimatedStats
// ─────────────────────────────────────────────────────────────────────────────

interface Stat {
  value: number
  suffix: string
  label: string
  prefix?: string
}

interface AnimatedStatsProps {
  stats: Stat[]
}

function CountUpNumber({
  value,
  suffix,
  prefix,
  isInView,
  delay,
}: {
  value: number
  suffix: string
  prefix?: string
  isInView: boolean
  delay: number
}) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, {
    stiffness: 60,
    damping: 18,
    restDelta: 0.01,
  })
  const display = useTransform(spring, (v) => {
    if (value >= 1000) {
      return v >= 1000
        ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
        : Math.round(v).toString()
    }
    return Math.round(v).toString()
  })

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        motionValue.set(value)
      }, delay * 1000)
      return () => clearTimeout(timeout)
    }
  }, [isInView, motionValue, value, delay])

  return (
    <span className="tabular-nums">
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  )
}

export function AnimatedStats({ stats }: AnimatedStatsProps) {
  const { ref, isInView } = useScrollReveal(0.3)

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.12 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.55, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <motion.div
      ref={ref}
      className="mx-auto grid max-w-5xl gap-8 px-6 py-12 sm:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {stats.map((s, i) => (
        <motion.div key={i} className="group text-center" variants={itemVariants}>
          {/* Decorative ring on hover */}
          <div className="relative inline-block">
            <p
              className="text-4xl font-extrabold tracking-tight text-primary transition-colors sm:text-5xl"
              aria-label={`${s.prefix ?? ""}${s.value}${s.suffix}`}
            >
              <CountUpNumber
                value={s.value}
                suffix={s.suffix}
                prefix={s.prefix}
                isInView={isInView}
                delay={i * 0.12}
              />
            </p>

            {/* Animated underline */}
            <motion.div
              className="mx-auto mt-1 h-0.5 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.12, ease: EASE_OUT_EXPO }}
              style={{ originX: "50%" }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AnimatedAgentsShowcase
// ─────────────────────────────────────────────────────────────────────────────

interface AgentCard {
  /** Tailwind gradient classes e.g. "from-violet-500/15 to-indigo-500/10" */
  color: string
  /** Icon color + bg classes e.g. "bg-violet-500/15 text-violet-600 dark:text-violet-300" */
  iconBg: string
  /** Lucide icon component */
  icon: React.ElementType
  title: string
  desc: string
}

interface AnimatedAgentsShowcaseProps {
  agents: AgentCard[]
}

export function AnimatedAgentsShowcase({ agents }: AnimatedAgentsShowcaseProps) {
  const { ref, isInView } = useScrollReveal(0.1)

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.13 },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.65, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <motion.div
      ref={ref}
      className="mt-14 grid gap-5 sm:grid-cols-2"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {agents.map((agent, i) => {
        const Icon = agent.icon
        return (
          <motion.div
            key={i}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border",
              "bg-gradient-to-br",
              agent.color,
              "p-7",
            )}
            variants={cardVariants}
            whileHover={{
              scale: 1.025,
              y: -4,
              transition: { duration: 0.25, ease: EASE_IN_OUT },
            }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Shine sweep on hover */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              initial={{ x: "-100%", opacity: 0 }}
              whileHover={{
                x: "120%",
                opacity: [0, 0.15, 0],
                transition: { duration: 0.55, ease: "easeInOut" },
              }}
              style={{
                background:
                  "linear-gradient(105deg, transparent, oklch(1 0 0 / 0.5), transparent)",
                skewX: -15,
              }}
            />

            {/* Top edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60"
            />

            <div className="flex items-start gap-4">
              <motion.span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl",
                  agent.iconBg,
                )}
                whileHover={{ rotate: [0, -6, 6, 0], transition: { duration: 0.5 } }}
              >
                <Icon className="size-6" />
              </motion.span>

              <div>
                <h3 className="text-lg font-semibold leading-snug">{agent.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {agent.desc}
                </p>

                {/* "Active" indicator */}
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-background/50 px-2.5 py-1 text-xs font-medium backdrop-blur">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active
                </div>
              </div>
            </div>

            {/* Decorative corner blob */}
            <div
              aria-hidden
              className="pointer-events-none absolute -end-8 -top-8 size-32 rounded-full opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.511 0.262 277 / 0.6) 0%, transparent 70%)",
              }}
            />
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ScrollReveal
// ─────────────────────────────────────────────────────────────────────────────

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  direction?: "up" | "left" | "right"
  className?: string
  /** How far the element travels before revealing (px). Default 28. */
  distance?: number
}

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className,
  distance = 28,
}: ScrollRevealProps) {
  const { ref, isInView } = useScrollReveal(0.15)

  const initial = {
    opacity: 0,
    x:
      direction === "left"
        ? -distance
        : direction === "right"
          ? distance
          : 0,
    y: direction === "up" ? distance : 0,
    filter: "blur(3px)",
  }

  const animate = isInView
    ? { opacity: 1, x: 0, y: 0, filter: "blur(0px)" }
    : initial

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={animate}
      transition={{
        duration: 0.65,
        delay,
        ease: EASE_OUT_EXPO,
      }}
    >
      {children}
    </motion.div>
  )
}
