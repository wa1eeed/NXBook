import { NextRequest, NextResponse } from "next/server"
import { handleMoyasarWebhook, verifyWebhookSignature } from "@/lib/payment"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("x-moyasar-signature") ?? ""

  if (!verifyWebhookSignature(body, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  try {
    await handleMoyasarWebhook(JSON.parse(body))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
