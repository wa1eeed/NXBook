import { getTranslations } from "next-intl/server"
import { confirmOffer } from "@/lib/waitlist"

// Public waitlist confirmation link target. The customer taps the
// link from their WhatsApp offer; confirming converts it to a booking.
// Not under /dashboard, so middleware leaves it public.
export default async function WaitlistConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("waitlist")
  const res = await confirmOffer(id)

  const ok = res.ok
  const message = ok ? t("confirmed") : t(`confirmError.${res.error}`)

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-full text-3xl ${
          ok
            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {ok ? "✓" : "⏰"}
      </div>
      <h1 className="text-xl font-bold">{message}</h1>
    </main>
  )
}
