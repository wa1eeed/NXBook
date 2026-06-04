// ============================================================
// Calendar + share link helpers for booking confirmations.
// Pure functions — no DB, safe in client or server components.
// ============================================================

export interface CalendarEvent {
  title: string
  description: string
  location: string
  /** Local date "YYYY-MM-DD" */
  date: string
  /** "HH:MM" 24h */
  startTime: string
  /** "HH:MM" 24h */
  endTime: string
}

/** Format a local date+time into an iCal UTC-ish stamp "YYYYMMDDTHHMMSS". */
function toStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-")
  const [h, min] = time.split(":")
  return `${y}${m}${d}T${h}${min}00`
}

/** Build a downloadable .ics file body. */
export function buildIcsContent(ev: CalendarEvent): string {
  const dtStart = toStamp(ev.date, ev.startTime)
  const dtEnd = toStamp(ev.date, ev.endTime)
  // Escape commas/semicolons/newlines per RFC 5545.
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NXBook//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

/** A data: URL for the ICS file (works as an href download). */
export function icsDataUrl(ev: CalendarEvent): string {
  const content = buildIcsContent(ev)
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`
}

/** Google Calendar "add event" link. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const dates = `${toStamp(ev.date, ev.startTime)}/${toStamp(ev.date, ev.endTime)}`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    details: ev.description,
    location: ev.location,
    dates,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** WhatsApp share link with a prefilled message. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Telegram share link. */
export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

/** Email share (mailto:) link. */
export function emailShareUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
