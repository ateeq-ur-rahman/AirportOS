import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Zap, Users, DoorOpen, UserX, Timer, ArrowRight, Loader2 } from "lucide-react"
import { api } from "../api/client"
import { useLiveEvents } from "../hooks/useWebSocket"
import { Panel, StatCard } from "../components/StatCard"
import { SeverityBadge, TypeBadge } from "../components/Badge"
import { ImpactChain } from "../components/ImpactChain"
import { AirportLayout } from "../components/AirportLayout"
import type { Disruption, ImpactAssessment, ImpactChainStep, Gate, Flight } from "../types"

export default function DisruptionCenter() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([])
  const [selected, setSelected] = useState<Disruption | null>(null)
  const [impact, setImpact] = useState<ImpactAssessment | null>(null)
  const [chain, setChain] = useState<ImpactChainStep[]>([])
  const [gates, setGates] = useState<Gate[]>([])
  const [flights, setFlights] = useState<Flight[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const { lastEvent } = useLiveEvents()
  const navigate = useNavigate()

  useEffect(() => {
    api.gates().then((r) => setGates(r.gates))
    api.flights({ limit: 2000 }).then((r) => setFlights(r.flights))
  }, [])

  async function refreshList() {
    const res = await api.disruptions()
    setDisruptions(res.disruptions)
    if (!selected && res.disruptions.length) void openDetail(res.disruptions[0])
  }

  async function openDetail(d: Disruption) {
    setSelected(d)
    setLoadingDetail(true)
    setChain([])
    try {
      const detail = await api.disruptionDetail(d.id)
      setImpact(detail.impact)
      if (detail.impact) {
        const chainRes = await api.impactChain(d.id).catch(() => null)
        if (chainRes) setChain(chainRes.chain)
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => { refreshList() }, [])
  useEffect(() => {
    if (lastEvent?.type === "disruptions.detected" || lastEvent?.type === "impact.assessed") refreshList()
  }, [lastEvent])

  async function handleSimulate() {
    setSimulating(true)
    try {
      const res = await api.simulateDisruption()
      await refreshList()
      openDetail(res.disruption)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">AI Disruption Center</h1>
          <p className="mt-1 text-sm text-ink-dim">Every disruption detected in real time, with AI-computed operational impact.</p>
        </div>
        <button
          onClick={handleSimulate} disabled={simulating}
          className="flex items-center gap-2 rounded-md bg-cyan px-4 py-2.5 text-sm font-semibold text-void hover:bg-cyan/90 disabled:opacity-60"
        >
          <Zap size={15} className={simulating ? "animate-pulse" : ""} />
          {simulating ? "Detecting…" : "Simulate Disruption"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title={`Active Disruptions (${disruptions.length})`} className="lg:col-span-1">
          <div className="max-h-[640px] space-y-2 overflow-y-auto">
            {disruptions.length === 0 && <p className="text-sm text-ink-dim">No disruptions detected yet — trigger one above.</p>}
            {disruptions.map((d) => (
              <button
                key={d.id} onClick={() => openDetail(d)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selected?.id === d.id ? "border-cyan/40 bg-cyan/5" : "border-hairline bg-raised/40 hover:border-hairline hover:bg-raised"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <TypeBadge type={d.type} />
                  <SeverityBadge severity={d.severity} />
                </div>
                <div className="text-sm text-ink">{d.title}</div>
                <div className="mt-1 text-[11px] font-mono text-ink-dim">
                  {d.affected_flight_ids.length} flight(s) · {d.resolved ? "resolved" : "open"}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-6 lg:col-span-2">
          {selected && (
            <Panel
              title="Disruption Detail"
              action={
                <button
                  onClick={() => navigate("/recovery", { state: { disruptionId: selected.id } })}
                  className="flex items-center gap-1.5 rounded-md bg-raised px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-hairline"
                >
                  View Recovery Plans <ArrowRight size={13} />
                </button>
              }
            >
              <div className="mb-3 flex items-center gap-2">
                <TypeBadge type={selected.type} />
                <SeverityBadge severity={selected.severity} />
                <span className="ml-auto font-mono text-[11px] text-ink-dim">{new Date(selected.detected_at).toLocaleTimeString()}</span>
              </div>
              <h3 className="font-display text-base font-semibold text-ink">{selected.title}</h3>
              <p className="mt-1.5 text-sm text-ink-dim">{selected.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.affected_flight_ids.slice(0, 12).map((fid) => (
                  <span key={fid} className="rounded border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">{fid}</span>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="AI Impact Assessment">
            {loadingDetail && (
              <div className="flex items-center gap-2 text-sm text-ink-dim"><Loader2 size={14} className="animate-spin" /> Computing impact…</div>
            )}
            {!loadingDetail && !impact && <p className="text-sm text-ink-dim">No impact assessment available for this disruption yet.</p>}
            {!loadingDetail && impact && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <StatCard label="Passengers Affected" value={impact.passengers_affected} icon={<Users size={15} />} accent="amber" />
                  <StatCard label="Gate Conflicts" value={impact.gate_conflicts} icon={<DoorOpen size={15} />} accent="red" />
                  <StatCard label="Crew At Risk" value={impact.crew_at_risk} icon={<UserX size={15} />} accent="red" />
                  <StatCard label="Missed Connections (est.)" value={impact.missed_connections_estimate} accent="amber" />
                  <StatCard label="Ground Handling Delay" value={`${impact.ground_handling_delay_minutes}m`} icon={<Timer size={15} />} accent="blue" />
                  <StatCard label="Turnaround Delay" value={`${impact.turnaround_delay_minutes}m`} icon={<Timer size={15} />} accent="blue" />
                </div>
                <div className="rounded-lg border border-hairline bg-raised/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-ink-dim">Severity Score</span>
                    <span className="font-display text-lg font-semibold text-cyan">{impact.severity_score}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-panel">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan to-red" style={{ width: `${impact.severity_score}%` }} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-dim">{impact.narrative}</p>
                </div>
              </div>
            )}
          </Panel>

          {chain.length > 0 && (
            <Panel title="Cascading Impact">
              <ImpactChain steps={chain} />
            </Panel>
          )}

          {gates.length > 0 && selected && (
            <Panel title="Airport Layout">
              <AirportLayout
                gates={gates}
                flights={flights}
                highlightGateIds={selected.affected_gate_ids}
                conflictGateIds={selected.type === "gate_conflict" ? selected.affected_gate_ids : []}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
