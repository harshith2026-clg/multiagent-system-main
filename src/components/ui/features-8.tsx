"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const monochrome = ["#fafafa", "#d4d4d8", "#a1a1aa", "#52525b"]

const verdictData = [
  { name: "Positive", value: 2 },
  { name: "Mixed", value: 1 },
  { name: "Negative", value: 1 },
]

const completionData = [
  { agent: "Technical", value: 96 },
  { agent: "HR", value: 92 },
  { agent: "Hiring", value: 94 },
  { agent: "Skeptic", value: 89 },
]

const latencyData = [
  { agent: "Technical", value: 1.8 },
  { agent: "HR", value: 1.2 },
  { agent: "Hiring", value: 1.5 },
  { agent: "Skeptic", value: 2.1 },
]

const tokenData = [
  { name: "Technical", value: 31 },
  { name: "HR", value: 22 },
  { name: "Hiring", value: 27 },
  { name: "Skeptic", value: 20 },
]

const confidenceData = [
  { agent: "Technical", value: 91 },
  { agent: "HR", value: 87 },
  { agent: "Hiring", value: 89 },
  { agent: "Skeptic", value: 84 },
]

type TooltipProps = {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>
  suffix?: string
}

function MonoTooltip({ active, payload, suffix = "" }: TooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-zinc-700 bg-white px-3 py-2 text-xs font-semibold text-zinc-950 shadow-xl dark:bg-zinc-950 dark:text-zinc-50">
      <div>{String(item.name ?? item.payload?.agent ?? item.payload?.name ?? "Metric")}</div>
      <div className="mt-1 text-zinc-500">{item.value}{suffix}</div>
    </div>
  )
}

function MetricBarChart({ title, data, max, suffix = "" }: { title: string; data: { agent: string; value: number }[]; max: number; suffix?: string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-50 shadow-none">
      <CardHeader>
        <CardTitle className="text-base tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={8}>
              <XAxis dataKey="agent" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
              <YAxis domain={[0, max]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<MonoTooltip suffix={suffix} />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900}>
                {data.map((_, index) => <Cell key={index} fill={monochrome[index % monochrome.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function Features() {
  const [activeSlice, setActiveSlice] = useState<number | undefined>()

  return (
    <section className="bg-[#09090b] py-16 font-sans text-white md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Agentic AI observability</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">See how the agents reason, perform, and converge.</h2>
          <p className="mt-4 leading-7 text-zinc-400">Interactive monochrome metrics for completion, latency, token usage, and decision confidence.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-50 shadow-none">
            <CardHeader>
              <CardTitle className="text-base tracking-tight">Agent verdict mix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verdictData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={98}
                      paddingAngle={2}
                      activeIndex={activeSlice}
                      onMouseEnter={(_, index) => setActiveSlice(index)}
                      onMouseLeave={() => setActiveSlice(undefined)}
                      isAnimationActive
                      animationDuration={900}
                    >
                      {verdictData.map((_, index) => <Cell key={index} fill={monochrome[index]} stroke="#09090b" />)}
                    </Pie>
                    <Tooltip content={<MonoTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <MetricBarChart title="Task completion rates" data={completionData} max={100} suffix="%" />
          <MetricBarChart title="Agent latency" data={latencyData} max={2.5} suffix="s" />

          <Card className="border-zinc-800 bg-zinc-950 text-zinc-50 shadow-none">
            <CardHeader><CardTitle className="text-base tracking-tight">Token usage distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tokenData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} paddingAngle={2} isAnimationActive animationDuration={1000}>
                      {tokenData.map((_, index) => <Cell key={index} fill={monochrome[index]} stroke="#09090b" />)}
                    </Pie>
                    <Tooltip content={<MonoTooltip suffix="%" />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <MetricBarChart title="Confidence scores" data={confidenceData} max={100} suffix="%" />
        </div>
      </div>
    </section>
  )
}
