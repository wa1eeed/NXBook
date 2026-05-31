import { requireBusiness } from "@/lib/tenant"
import { ImportClient } from "./import-client"

export default async function ImportCustomersPage() {
  // Gate the page behind tenant resolution; the action re-checks auth.
  await requireBusiness()
  return <ImportClient />
}
