import { getTranslations } from "next-intl/server"

// Placeholder for dashboard sections built in later slices, so the
// sidebar nav resolves instead of 404-ing.
export async function ComingSoon({ sectionKey }: { sectionKey: string }) {
  const td = await getTranslations("dashboard")
  const tc = await getTranslations("common")
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{td(sectionKey)}</h1>
      <p className="text-sm text-muted-foreground">{tc("comingSoon")}</p>
    </div>
  )
}
