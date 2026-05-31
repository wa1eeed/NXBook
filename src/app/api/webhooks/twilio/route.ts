import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Twilio status callback — updates delivery status in NotificationLog
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const messageSid = form.get("MessageSid") as string
  const status = form.get("MessageStatus") as string  // delivered, failed, etc

  if (messageSid && status) {
    await prisma.notificationLog.updateMany({
      where: { externalId: messageSid },
      data: { status },
    })
  }

  return new NextResponse(null, { status: 200 })
}
