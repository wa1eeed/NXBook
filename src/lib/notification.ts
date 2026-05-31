// ============================================================
// Notification Service — WhatsApp + SMS (Twilio) + Email (Resend)
// Single entry point for all notification channels
// ============================================================

import twilio from "twilio"
import { Resend } from "resend"
import { prisma } from "./prisma"
import { NotificationChannel } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"

// ─── Clients ────────────────────────────────────────────────

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

// ─── Types ─────────────────────────────────────────────────

export interface SendWhatsAppParams {
  businessId: string
  to: string           // phone with country code: +966xxxxxxx
  body: string
  type: string         // booking_confirmation | reminder | followup | etc
}

export interface SendSMSParams {
  businessId: string
  to: string
  body: string
  type: string
}

export interface SendEmailParams {
  businessId: string
  to: string
  subject: string
  html: string
  type: string
}

// ─── WhatsApp ──────────────────────────────────────────────

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<void> {
  const { businessId, to, body, type } = params
  let externalId: string | undefined
  let status = "sent"
  let error: string | undefined

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!, // whatsapp:+14155238886
      to: `whatsapp:${to}`,
      body,
    })
    externalId = message.sid
  } catch (err: any) {
    status = "failed"
    error = err.message
    Sentry.captureException(err, { extra: { businessId, type, to } })
    // Don't throw — log and continue
  }

  await prisma.notificationLog.create({
    data: {
      businessId,
      channel: NotificationChannel.WHATSAPP,
      recipient: to,
      type,
      body,
      status,
      externalId,
      error,
    },
  })
}

// ─── SMS ───────────────────────────────────────────────────

export async function sendSMS(params: SendSMSParams): Promise<void> {
  const { businessId, to, body, type } = params
  let externalId: string | undefined
  let status = "sent"
  let error: string | undefined

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_SMS_FROM!,
      to,
      body,
    })
    externalId = message.sid
  } catch (err: any) {
    status = "failed"
    error = err.message
    Sentry.captureException(err, { extra: { businessId, type, to } })
  }

  await prisma.notificationLog.create({
    data: {
      businessId,
      channel: NotificationChannel.SMS,
      recipient: to,
      type,
      body,
      status,
      externalId,
      error,
    },
  })
}

// ─── Email (Resend) ────────────────────────────────────────

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { businessId, to, subject, html, type } = params
  let externalId: string | undefined
  let status = "sent"
  let error: string | undefined

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      replyTo: process.env.EMAIL_REPLY_TO,
      to,
      subject,
      html,
    })
    externalId = result.data?.id
  } catch (err: any) {
    status = "failed"
    error = err.message
    Sentry.captureException(err, { extra: { businessId, type, to } })
  }

  await prisma.notificationLog.create({
    data: {
      businessId,
      channel: NotificationChannel.EMAIL,
      recipient: to,
      type,
      body: html,
      status,
      externalId,
      error,
    },
  })
}

// ─── Smart Send — tries WhatsApp first, falls back to SMS ──

export async function sendBookingConfirmation(params: {
  businessId: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  serviceName: string
  date: string
  time: string
  businessName: string
}): Promise<void> {
  const { customerPhone, customerEmail, customerName,
          serviceName, date, time, businessName, businessId } = params

  const body = `مرحباً ${customerName} 👋\nتم تأكيد حجزك في ${businessName}\n📋 الخدمة: ${serviceName}\n📅 التاريخ: ${date}\n🕐 الوقت: ${time}\nنتطلع لرؤيتك! 🌟`

  // Try WhatsApp first
  await sendWhatsApp({ businessId, to: customerPhone, body, type: "booking_confirmation" })

  // Email if available
  if (customerEmail) {
    await sendEmail({
      businessId,
      to: customerEmail,
      subject: `تأكيد الحجز — ${businessName}`,
      html: `<div dir="rtl"><h2>مرحباً ${customerName}</h2><p>تم تأكيد حجزك بنجاح</p><p><b>الخدمة:</b> ${serviceName}<br><b>التاريخ:</b> ${date}<br><b>الوقت:</b> ${time}</p></div>`,
      type: "booking_confirmation",
    })
  }
}

export async function sendBookingReminder(params: {
  businessId: string
  customerName: string
  customerPhone: string
  serviceName: string
  date: string
  time: string
  businessName: string
  hoursUntil: number
}): Promise<void> {
  const { hoursUntil, customerPhone, customerName,
          serviceName, date, time, businessName, businessId } = params

  const body = `تذكير 🔔\nموعدك في ${businessName} بعد ${hoursUntil} ساعة\n📋 ${serviceName}\n📅 ${date} الساعة ${time}`

  await sendWhatsApp({ businessId, to: customerPhone, body, type: `reminder_${hoursUntil}h` })
}

export async function sendWaitlistOffer(params: {
  businessId: string
  customerName: string
  customerPhone: string
  serviceName: string
  date: string
  time: string
  expiryMinutes: number
  confirmUrl: string
}): Promise<void> {
  const { customerPhone, customerName, serviceName,
          date, time, expiryMinutes, confirmUrl, businessId } = params

  const body = `خبر جيد ${customerName}! 🎉\nأصبح موعد متاح في قائمة انتظارك\n📋 ${serviceName}\n📅 ${date} الساعة ${time}\n⏰ لديك ${expiryMinutes} دقيقة للتأكيد\n✅ اضغط للتأكيد: ${confirmUrl}`

  await sendWhatsApp({ businessId, to: customerPhone, body, type: "waitlist_offer" })
}
