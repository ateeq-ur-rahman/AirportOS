import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertOctagon, ArrowRight, CheckCircle2 } from "lucide-react"
import { api } from "../api/client"
import { useLiveEvents } from "../hooks/useWebSocket"
import { Panel } from "../components/StatCard"
import { SeverityBadge, TypeBadge } from "../components/Badge"
import type { Disruption } from "../types"

export default function Alerts() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([])
  const { lastEvent } = useLiveEvents()
  const navigate = useNavigate()

  async function refresh() {
    const res = await api.disruptions()
    setDisruptions(res.disruptions)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (lastEvent?.type === "disruptions.detected" || lastEvent?.type === "decisions.audit") refresh()
  }, [lastEvent])

  const critical = disruptions.filter((d) => !d.resolved && (d.severity === "critical" || d.severity === "high"))
  const other = disruptions.filter((d) => !critical.includes(d) && !d.resolved)
  const resolved = disruptions.filter((d) => d.resolved)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
          <AlertOctagon size={20} className="text-red" /> Alerts
        </h1>
        <p className="mt-1 text-sm text-ink-dim">High and critical severity disruptions requiring immediate operator attention.</p>
      </div>

      <Panel title={`Requires Attention (${critical.length})`}>
        {critical.length === 0 && <p className="text-sm text-ink-dim">No critical or high-severity disruptions open right now.</p>}
        <div className="space-y-2">
          {critical.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-red/30 bg-red/5 p-3">
              <SeverityBadge severity={d.severity} />
              <TypeBadge type={d.type} />
              <span className="flex-1 text-sm text-ink">{d.title}</span>
              <span className="font-mono text-[11px] text-ink-dim">{d.affected_flight_ids.length} flights</span>
              <button
                onClick={() => navigate("/recovery", { state: { disruptionId: d.id } })}
                className="flex items-center gap-1 rounded-md bg-red/15 px-2.5 py-1.5 text-xs font-semibold text-red hover:bg-red/25"
              >
                Recover <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`Other Open (${other.length})`}>
        {other.length === 0 && <p className="text-sm text-ink-dim">Nothing else open.</p>}
        <div className="space-y-2">
          {other.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-raised/40 p-3">
              <SeverityBadge severity={d.severity} />
              <TypeBadge type={d.type} />
              <span className="flex-1 text-sm text-ink">{d.title}</span>
              <button
                onClick={() => navigate("/recovery", { state: { disruptionId: d.id } })}
                className="flex items-center gap-1 rounded-md bg-raised px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink"
              >
                Recover <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`Resolved (${resolved.length})`}>
        {resolved.length === 0 && <p className="text-sm text-ink-dim">No resolved disruptions yet.</p>}
        <div className="space-y-2">
          {resolved.slice(0, 8).map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-raised/20 p-3 opacity-70">
              <CheckCircle2 size={15} className="text-green" />
              <TypeBadge type={d.type} />
              <span className="flex-1 text-sm text-ink-dim line-through">{d.title}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
