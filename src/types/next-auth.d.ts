import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      businessId: string
      businessSlug: string
      onboardingDone: boolean
    } & DefaultSession["user"]
  }
}
