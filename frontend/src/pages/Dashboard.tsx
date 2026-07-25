import { useEffect, useState, useMemo } from "react"
import { PlaneTakeoff, Clock, AlertTriangle, DoorOpen, Zap, Brain, Gauge, DollarSign, Users2 } from "lucide-react"
import { api } from "../api/client"
import { useLiveEvents } from "../hooks/useWebSocket"
import { StatCard, Panel } from "../components/StatCard"
import { StatusText } from "../components/Badge"
import type { Flight, FlightSnapshot, AnalyticsKpis } from "../types"

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<FlightSnapshot | null>(null)
  const [kpis, setKpis] = useState<AnalyticsKpis | null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [filter, setFilter] = useState<"all" | "delayed">("all")
  const [simulating, setSimulating] = useState(false)
  const { lastEvent } = useLiveEvents()

  async function refresh() {
    const [snap, list, analytics] = await Promise.all([
      api.flightSnapshot(),
      api.flights({ delayed_only: filter === "delayed", limit: 60 }),
      api.analytics().catch(() => null),
    ])
    setSnapshot(snap)
    setFlights(list.flights)
    if (analytics) setKpis(analytics.kpis)
  }

  useEffect(() => { refresh() }, [filter])
  useEffect(() => {
    if (["flights.updates", "disruptions.detected", "decisions.audit"].includes(lastEvent?.type || "")) refresh()
  }, [lastEvent])

  const statusCounts = useMemo(() => {
    if (!snapshot) return []
    return Object.entries(snapshot.by_status).sort((a, b) => b[1] - a[1])
  }, [snapshot])

  async function handleSimulate() {
    setSimulating(true)
    try {
      await api.simulateDisruption()
      await refresh()
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Live Flight Dashboard</h1>
          <p className="mt-1 text-sm text-ink-dim">Real-time operational picture across every active flight and gate.</p>
        </div>
        <button
          onClick={handleSimulate} disabled={simulating}
          className="flex items-center gap-2 rounded-md bg-cyan px-4 py-2.5 text-sm font-semibold text-void hover:bg-cyan/90 disabled:opacity-60"
        >
          <Zap size={15} className={simulating ? "animate-pulse" : ""} />
          {simulating ? "Injecting disruption…" : "Simulate Disruption"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Flights Today" value={snapshot?.total_flights ?? "—"} icon={<PlaneTakeoff size={16} />} accent="cyan" />
        <StatCard label="Delayed Flights" value={snapshot?.delayed_flights ?? "—"} sub={`avg ${snapshot?.avg_delay_minutes ?? 0} min`} icon={<AlertTriangle size={16} />} accent="amber" />
        <StatCard label="Passengers Affected" value={kpis ? kpis.total_passengers_impacted : "—"} sub="across all disruptions detected" icon={<Users2 size={16} />} accent="amber" />
        <StatCard label="Open Disruptions" value={snapshot?.open_disruptions ?? "—"} icon={<DoorOpen size={16} />} accent="red" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="AI Decisions Generated" value={kpis ? kpis.ai_decisions_generated : "—"} sub="ranked recovery plans" icon={<Brain size={15} />} accent="cyan" />
        <StatCard label="Recovery Success Rate" value={kpis ? `${kpis.recovery_success_rate_pct}%` : "—"} icon={<Gauge size={15} />} accent="green" />
        <StatCard label="Avg Recovery Time" value={kpis ? `${kpis.avg_ai_recovery_seconds}s` : "—"} sub="AI pipeline, measured" icon={<Clock size={15} />} accent="blue" />
        <StatCard label="Cost Saved Today" value={kpis ? `$${kpis.estimated_cost_saved_today_usd.toLocaleString()}` : "—"} icon={<DollarSign size={15} />} accent="amber" />
        <StatCard label="Gate Utilization" value={kpis ? `${kpis.gate_utilization_pct}%` : "—"} icon={<DoorOpen size={15} />} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Flight Board"
          className="xl:col-span-2"
          action={
            <div className="flex gap-1 rounded-md border border-hairline bg-raised p-0.5">
              {(["all", "delayed"] as const).map((f) => (
                <button
                  key={f} onClick={() => setFilter(f)}
                  className={`rounded px-2.5 py-1 text-xs font-mono uppercase transition ${filter === f ? "bg-cyan/15 text-cyan" : "text-ink-dim hover:text-ink"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        >
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel text-[11px] font-mono uppercase tracking-wider text-ink-dim">
                <tr className="border-b border-hairline">
                  <th className="py-2 pr-3">Flight</th>
                  <th className="py-2 pr-3">Route</th>
                  <th className="py-2 pr-3">Gate</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Delay</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((f) => (
                  <tr key={f.id} className="border-b border-hairline/60 hover:bg-raised/50">
                    <td className="py-2 pr-3">
                      <div className="font-mono text-ink">{f.callsign}</div>
                      <div className="text-[11px] text-ink-dim">{f.airline}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-ink-dim">{f.origin} → {f.destination}</td>
                    <td className="py-2 pr-3 font-mono text-ink-dim">{f.gate}</td>
                    <td className="py-2 pr-3"><StatusText status={f.status} /></td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {f.delay_minutes > 0 ? <span className="text-amber">+{f.delay_minutes}m</span> : <span className="text-ink-dim">on time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Status Breakdown">
          <div className="space-y-3">
            {statusCounts.map(([status, count]) => (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <StatusText status={status} />
                  <span className="font-mono text-ink-dim">{count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-raised">
                  <div
                    className="h-1.5 rounded-full bg-cyan"
                    style={{ width: `${snapshot ? (count / snapshot.total_flights) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
