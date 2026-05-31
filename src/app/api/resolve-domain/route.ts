// ============================================================
// Internal endpoint: resolve a custom domain → tenant slug.
// Called by middleware (edge) which can't use Prisma directly.
// Runs on the Node runtime. Returns { slug } or 404.
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { resolveDomainToSlug } from "@/lib/domains"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host")
  if (!host) return NextResponse.json({ error: "missing host" }, { status: 400 })

  const slug = await resolveDomainToSlug(host)
  if (!slug) return NextResponse.json({ slug: null }, { status: 404 })

  // Short cache to spare the DB; domains change rarely.
  return NextResponse.json(
    { slug },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  )
}
