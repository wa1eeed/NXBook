"use server"

// Reports export — generates a CSV of the current window's metrics,
// tenant-scoped. Returns the CSV string; the client triggers download.
import { requireBusiness } from "@/lib/tenant"
import { computeReport } from "@/lib/reports"

export async function exportReportCsv(days: number): Promise<string> {
  const ctx = await requireBusiness()
  const m = await computeReport(ctx.businessId, days)

  const rows: [string, string | number][] = [
    ["Metric", "Value"],
    ["Period (days)", m.days],
    ["Total bookings", m.totalBookings],
    ["Attended", m.attended],
    ["No-shows", m.noShows],
    ["Cancelled", m.cancelled],
    ["Attendance rate %", m.attendanceRate],
    ["No-show rate %", m.noShowRate],
    ["Revenue (SAR)", m.revenue],
    ["Avg price (SAR)", m.avgPrice],
    ["Waitlist joined", m.waitlistJoined],
    ["Waitlist confirmed", m.waitlistConfirmed],
    ["Waitlist conversion %", m.waitlistConversionRate],
    ["Revenue saved by waitlist (SAR)", m.revenueSaved],
  ]
  return rows.map((r) => r.join(",")).join("\n")
}
