"use server"

// ============================================================
// Auth server actions usable from client forms. Wraps next-auth
// signIn/signOut so credentials never touch a client bundle.
// ============================================================

import { z } from "zod"
import { AuthError } from "next-auth"
import { signIn, signOut } from "@/lib/auth"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginResult = { ok: true } | { ok: false; error: string }

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { ok: false, error: "invalidInput" }
  }

  try {
    // redirect:false → we handle navigation client-side after success.
    await signIn("credentials", { ...parsed.data, redirect: false })
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "invalidCredentials" }
    }
    throw err
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" })
}
