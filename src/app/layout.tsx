import type { Metadata } from "next"
import { Geist, Geist_Mono, Cairo } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { localeDirection, type Locale } from "@/i18n/config"
import { Providers } from "@/components/providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "NXBook — Booking that guarantees customers show up",
  description:
    "Multi-tenant booking SaaS with smart waitlists, no-show intelligence, and autonomous AI agents.",
}

// Latin UI fonts.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
// Arabic-capable font with strong RTL support.
const cairo = Cairo({ variable: "--font-arabic", subsets: ["arabic", "latin"] })

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await getLocale()) as Locale
  const messages = await getMessages()
  const dir = localeDirection(locale)

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
