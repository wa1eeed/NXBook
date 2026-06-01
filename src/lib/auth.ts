import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Required when running behind a reverse proxy (Coolify/Caddy/Nginx):
  // lets NextAuth trust the forwarded Host header instead of throwing
  // UntrustedHost on a custom domain. Also honors AUTH_TRUST_HOST env.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials)

        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            businesses: {
              include: { business: true },
              take: 1,
            },
          },
        })

        if (!user || !user.isVerified) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          businessId: user.businesses[0]?.businessId ?? null,
          businessSlug: user.businesses[0]?.business?.slug ?? null,
          onboardingDone: user.businesses[0]?.business?.onboardingDone ?? false,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as typeof user & { role?: string; businessId?: string; businessSlug?: string; onboardingDone?: boolean }
        token.id = u.id
        token.role = u.role
        token.businessId = u.businessId
        token.businessSlug = u.businessSlug
        token.onboardingDone = u.onboardingDone
      }

      // After onboarding the JWT still has businessId=null (it was minted at
      // login, before the Business existed). A client-triggered session
      // update() re-reads the user's first business here so the dashboard
      // becomes reachable without forcing a re-login. This branch only runs
      // in the Node /api/auth/session route — never in edge middleware — so
      // Prisma is safe to call.
      if (trigger === "update" && token.id) {
        const membership = await prisma.businessMember.findFirst({
          where: { userId: token.id as string },
          include: { business: true },
          orderBy: { createdAt: "asc" },
        })
        if (membership) {
          token.businessId = membership.businessId
          token.businessSlug = membership.business.slug
          token.onboardingDone = membership.business.onboardingDone
          token.role = membership.role
        }
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.businessId = token.businessId as string
      session.user.businessSlug = token.businessSlug as string
      session.user.onboardingDone = token.onboardingDone as boolean
      return session
    },
  },
})
