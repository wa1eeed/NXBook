"use client"

// Recharts visualisations for the 360° overview. Pure presentational —
// receives plain serializable arrays from the server component, so no
// React components/classes cross the RSC boundary.
import { useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface ChartsData {
  mrrSeries: { month: string; mrr: number }[]
  planDistribution: { planName: string; count: number; color: string }[]
  bizGrowthSeries: { month: string; count: number }[]
}

const axisProps = {
  stroke: "currentColor",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56 text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

export function AdminCharts({ data }: { data: ChartsData }) {
  const t = useTranslations("admin.overview")
  const hasPlans = data.planDistribution.length > 0

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title={t("mrrTrend")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.mrrSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} width={36} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
              formatter={(v) => [`${v as number} SAR`, t("mrr")]}
            />
            <Area
              type="monotone"
              dataKey="mrr"
              stroke="#0EA5E9"
              strokeWidth={2}
              fill="url(#mrrFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("planDist")}>
        {hasPlans ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.planDistribution}
                dataKey="count"
                nameKey="planName"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {data.planDistribution.map((p) => (
                  <Cell key={p.planName} fill={p.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm">
            {t("noData")}
          </div>
        )}
      </ChartCard>

      <ChartCard title={t("bizGrowth")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bizGrowthSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
