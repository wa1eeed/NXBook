import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUploadUrl, StorageKeys } from "@/lib/storage"
import { z } from "zod"

const schema = z.object({
  type: z.enum(["business_logo", "service_image", "staff_avatar"]),
  ext: z.enum(["jpg", "jpeg", "png", "webp"]),
  targetId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 })

  const { type, ext, targetId } = parsed.data
  const businessId = session.user.businessId
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`

  let key: string
  switch (type) {
    case "business_logo":
      key = StorageKeys.businessLogo(businessId, ext); break
    case "service_image":
      key = StorageKeys.serviceImage(businessId, targetId!, ext); break
    case "staff_avatar":
      key = StorageKeys.staffAvatar(businessId, targetId!, ext); break
  }

  const uploadUrl = await getUploadUrl(key!, contentType)
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

  return NextResponse.json({ uploadUrl, publicUrl, key })
}
