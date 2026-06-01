import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "./wizard"

// Onboarding is protected and single-use: must be logged in, and a user
// who already owns a business is sent straight to the dashboard.
//
// We also show a small "wrong account? sign out" link below the wizard
// in case a visitor lands here while logged into the wrong account
// (e.g. they previously registered and never finished onboarding, then
// clicked "Get started" again expecting a fresh registration form).
export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const existing = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    include: { business: true },
  })
  if (existing) redirect("/dashboard")

  const t = await getTranslations("onboarding")
  const email = session.user.email ?? ""

  return (
    <div className="flex w-full max-w-lg flex-col items-stretch gap-4">
      <OnboardingWizard />
      <p className="text-center text-xs text-muted-foreground">
        {email ? <span className="font-medium">{email}</span> : null}{" "}
        {t("signOutHint")}{" "}
        <Link
          href="/api/auth/signout"
          className="font-medium text-primary hover:underline"
        >
          {t("signOutCta")}
        </Link>
      </p>
    </div>
  )
}
