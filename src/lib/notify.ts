// ============================================================
// Notification guard + dispatch. The foundation's notification.ts
// builds Twilio/Resend clients at module load with required env
// vars — which THROWS on the TODO placeholder keys. So we NEVER
// import it statically. Instead we check provider config first and
// dynamically import only when configured; otherwise we record a
// "skipped" NotificationLog so the flow is observable without keys.
// ============================================================

import { prisma } from "@/lib/prisma"
import { NotificationChannel } from "@prisma/client"

function configured(value: string | undefined): boolean {
  return !!value && !value.startsWith("TODO")
}

export function twilioConfigured(): boolean {
  return (
    configured(process.env.TWILIO_ACCOUNT_SID) &&
    configured(process.env.TWILIO_AUTH_TOKEN) &&
    process.env.TWILIO_ACCOUNT_SID!.startsWith("AC")
  )
}

export function resendConfigured(): boolean {
  return configured(process.env.RESEND_API_KEY)
}

interface WhatsAppArgs {
  businessId: string
  to: string
  body: string
  type: string
}

/**
 * Send a WhatsApp message if Twilio is configured; otherwise log a
 * "skipped" notification so dev/test flows remain fully observable.
 * Never throws — notification failures must not break booking flows.
 */
export async function dispatchWhatsApp(args: WhatsAppArgs): Promise<void> {
  if (!twilioConfigured()) {
    await prisma.notificationLog.create({
      data: {
        businessId: args.businessId,
        channel: NotificationChannel.WHATSAPP,
        recipient: args.to,
        type: args.type,
        body: args.body,
        status: "skipped",
        error: "twilio_not_configured",
      },
    })
    return
  }
  // Dynamic import: only load (and construct the Twilio client) when keys exist.
  const { sendWhatsApp } = await import("@/lib/notification")
  await sendWhatsApp(args)
}

interface EmailArgs {
  businessId: string
  to: string
  subject: string
  html: string
  type: string
}

export async function dispatchEmail(args: EmailArgs): Promise<void> {
  if (!resendConfigured()) {
    await prisma.notificationLog.create({
      data: {
        businessId: args.businessId,
        channel: NotificationChannel.EMAIL,
        recipient: args.to,
        type: args.type,
        body: args.html,
        status: "skipped",
        error: "resend_not_configured",
      },
    })
    return
  }
  const { sendEmail } = await import("@/lib/notification")
  await sendEmail(args)
}
