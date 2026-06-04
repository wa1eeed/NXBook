"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "motion/react"
import {
  CheckCircle2, Calendar, Clock, User, MapPin, Video,
  CalendarPlus, MessageCircle, Send, Mail, X, ExternalLink,
} from "lucide-react"
import { cancelBookingPublicAction } from "../../actions"
import { Button } from "@/components/ui/button"
import { formatTime12 } from "@/lib/time"
import {
  icsDataUrl, googleCalendarUrl, whatsappShareUrl,
  telegramShareUrl, emailShareUrl, type CalendarEvent,
} from "@/lib/calendar-links"
import { cn } from "@/lib/utils"

const MEETING_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  zoom: "Zoom",
  custom: "Online meeting",
}

export function ConfirmationClient({
  accent, businessName, slug, bookingId, status,
  serviceName, durationMin, staffName, customerName,
  date, startTime, endTime, location, meeting,
}: {
  accent: string
  businessName: string
  slug: string
  bookingId: string
  status: string
  serviceName: string
  durationMin: number
  staffName: string | null
  customerName: string
  date: string
  startTime: string
  endTime: string
  location: Record<string, string>
  meeting: Record<string, string>
}) {
  const t = useTranslations("confirmation")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelled, setCancelled] = useState(status === "CANCELLED")

  const isOnline = meeting.type && meeting.type !== "in_person"
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(
    locale === "ar" ? "ar-SA" : "en-US",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  )
  const timeLabel = `${formatTime12(startTime, locale)} – ${formatTime12(endTime, locale)}`

  const calEvent: CalendarEvent = {
    title: `${serviceName} — ${businessName}`,
    description: `${serviceName}${staffName ? ` (${staffName})` : ""} @ ${businessName}`,
    location: isOnline ? (meeting.url ?? "") : (location.address ?? businessName),
    date, startTime, endTime,
  }

  const shareText = t("shareText", {
    service: serviceName, business: businessName, date: dateLabel, time: formatTime12(startTime, locale),
  })
  const pageUrl = typeof window !== "undefined" ? window.location.href : ""

  function cancel() {
    startTransition(async () => {
      const res = await cancelBookingPublicAction(slug, bookingId)
      if (res.ok) {
        setCancelled(true)
        setConfirmCancel(false)
        router.refresh()
      }
    })
  }

  if (cancelled) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <X className="size-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">{t("cancelledTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("cancelledBody")}</p>
          <Link
            href={`/${slug}`}
            className="mt-6 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: accent }}
          >
            {t("bookAgain")}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      {/* Celebratory header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex flex-col items-center text-center"
      >
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
          className="flex size-20 items-center justify-center rounded-full text-white shadow-soft"
          style={{ backgroundColor: accent }}
        >
          <CheckCircle2 className="size-11" />
        </motion.div>
        <h1 className="mt-5 text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle", { business: businessName })}</p>
      </motion.div>

      {/* Details card */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      >
        <div className="flex flex-col gap-3 p-5">
          <Row icon={<Calendar className="size-4" />} label={serviceName} sub={t("durationMins", { n: durationMin })} accent={accent} />
          <Row icon={<Clock className="size-4" />} label={dateLabel} sub={timeLabel} accent={accent} />
          {staffName && <Row icon={<User className="size-4" />} label={staffName} sub={t("withStaff")} accent={accent} />}
        </div>

        {/* Location / meeting */}
        {(isOnline || location.googleMaps || location.address) && (
          <div className="border-t border-border bg-muted/20 p-5">
            {isOnline ? (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Video className="size-4" style={{ color: accent }} />
                  {MEETING_LABELS[meeting.type] ?? t("onlineMeeting")}
                </p>
                {meeting.url && (
                  <a
                    href={meeting.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white"
                    style={{ backgroundColor: accent }}
                  >
                    <Video className="size-4" />
                    {t("joinMeeting")}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-4" style={{ color: accent }} />
                  {location.address || businessName}
                </p>
                {location.googleMaps && (
                  <a
                    href={location.googleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <MapPin className="size-4" />
                    {t("openInMaps")}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Add to calendar */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.32 }}
        className="mt-6"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addToCalendar")}</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={icsDataUrl(calEvent)}
            download={`booking-${date}.ics`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <CalendarPlus className="size-4" />
            {t("appleCalendar")}
          </a>
          <a
            href={googleCalendarUrl(calEvent)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <CalendarPlus className="size-4" />
            {t("googleCalendar")}
          </a>
        </div>
      </motion.div>

      {/* Share */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.38 }}
        className="mt-6"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("share")}</p>
        <div className="flex flex-wrap gap-2">
          <ShareBtn href={whatsappShareUrl(shareText)} icon={<MessageCircle className="size-4" />} label="WhatsApp" />
          <ShareBtn href={telegramShareUrl(pageUrl, shareText)} icon={<Send className="size-4" />} label="Telegram" />
          <ShareBtn href={emailShareUrl(t("emailSubject"), `${shareText}\n${pageUrl}`)} icon={<Mail className="size-4" />} label={t("email")} />
        </div>
      </motion.div>

      {/* Cancel */}
      <div className="mt-8 text-center">
        {confirmCancel ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">{t("cancelConfirm")}</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)} disabled={pending}>
                {t("keepBooking")}
              </Button>
              <Button
                size="sm"
                onClick={cancel}
                disabled={pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("confirmCancelBtn")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
          >
            {t("cancelBooking")}
          </button>
        )}
      </div>
    </main>
  )
}

function Row({ icon, label, sub, accent }: { icon: React.ReactNode; label: string; sub: string; accent: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`, color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function ShareBtn({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </a>
  )
}
