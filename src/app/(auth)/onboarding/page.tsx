import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "./wizard"

// Onboarding is protected and single-use: must be logged in, and a user
// who already owns a business is sent straight to the dashboard.
export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const existing = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    include: { business: true },
  })
  if (existing) redirect("/dashboard")

  return <OnboardingWizard />
}
