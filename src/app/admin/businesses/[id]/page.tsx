import { notFound } from "next/navigation"
import { requireSuperAdmin } from "@/lib/tenant"
import { getBusinessDetail } from "./data"
import { BusinessDetailClient } from "./business-detail-client"

export default async function AdminBusinessDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireSuperAdmin()
  const { id } = await params
  const data = await getBusinessDetail(id)
  if (!data) notFound()

  return <BusinessDetailClient data={data} />
}
