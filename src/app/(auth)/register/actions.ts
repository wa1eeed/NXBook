"use server"

// ============================================================
// Registration server action — creates the OWNER user account.
// The Business itself is created later in the onboarding wizard.
// ============================================================

import { z } from "zod"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { rateLimit, LIMITS, clientIp } from "@/lib/ratelimit"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type RegisterResult = { ok: true } | { ok: false; error: string }

export async function registerUser(
  _prev: RegisterResult | null,
  formData: FormData,
): Promise<RegisterResult> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { ok: false, error: "invalidInput" }
  }

  // Brute-force / abuse guard per IP.
  const ip = clientIp(await headers())
  const rl = await rateLimit(`auth:ip:${ip}`, LIMITS.auth.limit, LIMITS.auth.windowSec)
  if (!rl.ok) return { ok: false, error: "rateLimited" }

  const { email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { ok: false, error: "emailTaken" }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const verifyToken = randomBytes(32).toString("hex")

  // In dev we auto-verify so the account can log in immediately. In
  // production this would stay false until the email link is clicked
  // (email verification is wired in a later slice).
  const isVerified = process.env.NODE_ENV !== "production"

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "OWNER",
      isVerified,
      verifyToken,
    },
  })

  return { ok: true }
}
