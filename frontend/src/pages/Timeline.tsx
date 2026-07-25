import { useEffect, useState } from "react"
import { AlertTriangle, Brain, ListChecks, CheckCircle2, PlaneTakeoff } from "lucide-react"
import { useLiveEvents } from "../hooks/useWebSocket"
import { Panel } from "../components/StatCard"
import { api } from "../api/client"
import type { Disruption } from "../types"

const ICONS: Record<string, any> = {
  "disruptions.detected": AlertTriangle,
  "impact.assessed": Brain,
  "recovery.plans": ListChecks,
  "decisions.audit": CheckCircle2,
  "flights.updates": PlaneTakeoff,
}

const COLORS: Record<string, string> = {
  "disruptions.detected": "text-red bg-red/10 border-red/30",
  "impact.assessed": "text-amber bg-amber/10 border-amber/30",
  "recovery.plans": "text-cyan bg-cyan/10 border-cyan/30",
  "decisions.audit": "text-green bg-green/10 border-green/30",
  "flights.updates": "text-ink-dim bg-raised border-hairline",
}

const LABELS: Record<string, string> = {
  "disruptions.detected": "Disruption Detected",
  "impact.assessed": "Impact Assessed",
  "recovery.plans": "Recovery Plans Generated",
  "decisions.audit": "Operator Decision Logged",
  "flights.updates": "Flight State Update",
}

function summarize(type: string, data: any): string {
  switch (type) {
    case "disruptions.detected": return `${data.title} — ${data.affected_flight_ids?.length ?? 0} flight(s), ${data.severity} severity`
    case "impact.assessed": return `${data.passengers_affected} pax affected, severity score ${data.severity_score}/100`
    case "recovery.plans": return `${data.plans?.length ?? 0} plans generated for disruption ${data.disruption_id}`
    case "decisions.audit": return `${data.operator} ${data.decision} plan ${data.plan_id}`
    case "flights.updates": return `${data.updated_flight_ids?.length ?? 0} flight(s) advanced state`
    default: return JSON.stringify(data).slice(0, 80)
  }
}

export default function Timeline() {
  const { events } = useLiveEvents(150)
  const [seed, setSeed] = useState<Disruption[]>([])

  useEffect(() => { api.disruptions().then((r) => setSeed(r.disruptions)) }, [])

  const feed = events.filter((e) => e.type !== "flights.updates" || Math.random() < 0.15)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Timeline</h1>
        <p className="mt-1 text-sm text-ink-dim">Live event stream across detection, AI analysis, planning, and operator decisions.</p>
      </div>

      <Panel>
        {feed.length === 0 && (
          <p className="text-sm text-ink-dim">
            No live events yet this session — {seed.length} historical disruption(s) on record. Trigger a disruption to watch the pipeline run in real time.
          </p>
        )}
        <ol className="relative space-y-5 border-l border-hairline pl-6">
          {feed.map((e, i) => {
            const Icon = ICONS[e.type] || AlertTriangle
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border ${COLORS[e.type]}`}>
                  <Icon size={12} />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{LABELS[e.type] || e.type}</span>
                  <span className="font-mono text-[11px] text-ink-dim">{new Date(e.published_at).toLocaleTimeString()}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-dim">{summarize(e.type, e.data)}</p>
              </li>
            )
          })}
        </ol>
      </Panel>
    </div>
  )
}
