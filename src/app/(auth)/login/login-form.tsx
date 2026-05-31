"use client"

import { useActionState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { loginAction, type LoginResult } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm() {
  const t = useTranslations("auth")
  const router = useRouter()
  const params = useSearchParams()
  const justRegistered = params.get("registered") === "1"

  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null,
  )

  useEffect(() => {
    // Middleware decides where to land (onboarding vs dashboard) based on
    // the fresh session; a full navigation lets it run.
    if (state?.ok) router.push("/dashboard")
  }, [state, router])

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("login")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {justRegistered && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {t("registeredNotice")}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {state && !state.ok && (
            <p className="text-sm text-destructive">{t(`errors.${state.error}`)}</p>
          )}
        </CardContent>
        <CardFooter className="mt-2 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("submitting") : t("login")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t("register")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
