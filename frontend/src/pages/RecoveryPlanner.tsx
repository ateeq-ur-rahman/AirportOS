import { useEffect, useState, useRef } from "react"
import { useLocation } from "react-router-dom"
import { Check, X, Clock3, TrendingUp, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react"
import clsx from "clsx"
import { api } from "../api/client"
import { Panel } from "../components/StatCard"
import { SeverityBadge, TypeBadge } from "../components/Badge"
import { ConfidenceRing } from "../components/ConfidenceRing"
import { ApprovalTimeline } from "../components/ApprovalTimeline"
import { RecoveryValuePanel } from "../components/RecoveryValuePanel"
import type { Disruption, RecoveryPlan, RecoveryValue } from "../types"

export default function RecoveryPlanner() {
  const location = useLocation() as { state?: { disruptionId?: string } }
  const [disruptions, setDisruptions] = useState<Disruption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(location.state?.disruptionId ?? null)
  const [plans, setPlans] = useState<RecoveryPlan[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [decidedPlanId, setDecidedPlanId] = useState<string | null>(null)
  const [approvingPlanId, setApprovingPlanId] = useState<string | null>(null)
  const [recoveryValue, setRecoveryValue] = useState<Record<string, RecoveryValue>>({})
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    api.disruptions(true).then((res) => {
      setDisruptions(res.disruptions)
      if (!selectedId && res.disruptions.length) setSelectedId(res.disruptions[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    startRef.current = Date.now()
    setDecidedPlanId(null)
    api.plansFor(selectedId).then((res) => setPlans(res.plans)).catch(() => setPlans([]))
  }, [selectedId])

  const selected = disruptions.find((d) => d.id === selectedId)

  async function decide(plan: RecoveryPlan, decision: "approved" | "rejected") {
    setDeciding(true)
    setError(null)
    try {
      const seconds = (Date.now() - startRef.current) / 1000
      const result = await api.decide({ disruption_id: plan.disruption_id, plan_id: plan.id, decision, time_to_decision_seconds: seconds })
      if (decision === "approved") {
        if (result.recovery_value) setRecoveryValue((v) => ({ ...v, [plan.id]: result.recovery_value! }))
        setApprovingPlanId(plan.id) // shows the execution timeline; decidedPlanId is set once it completes
      } else {
        setDecidedPlanId(plan.id)
      }
    } catch (e: any) {
      // Most common real-world cause: the backend restarted (e.g. during
      // development with --reload) and this plan_id/disruption_id no
      // longer exists in its in-memory state. Tell the operator plainly
      // rather than letting the click silently do nothing.
      const message = String(e?.message || e)
      if (message.includes("404")) {
        setError("This plan is no longer available — the disruption data may have refreshed. Reloading the page.")
        setTimeout(() => window.location.reload(), 1800)
      } else {
        setError(`Couldn't record your decision: ${message}`)
      }
    } finally {
      setDeciding(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Recovery Planner</h1>
        <p className="mt-1 text-sm text-ink-dim">Three AI-ranked recovery plans, ready for one-click operator approval.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {disruptions.map((d) => (
          <button
            key={d.id} onClick={() => setSelectedId(d.id)}
            className={clsx(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
              selectedId === d.id ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-hairline bg-panel text-ink-dim hover:text-ink"
            )}
          >
            <TypeBadge type={d.type} />
            {d.title}
          </button>
        ))}
        {disruptions.length === 0 && <p className="text-sm text-ink-dim">No open disruptions. Trigger one from the Dashboard or Disruption Center.</p>}
      </div>

      {selected && (
        <div className="flex items-center gap-3 rounded-lg border border-hairline bg-panel px-4 py-3">
          <SeverityBadge severity={selected.severity} />
          <span className="text-sm text-ink">{selected.title}</span>
          <span className="ml-auto font-mono text-[11px] text-ink-dim">{selected.affected_flight_ids.length} flight(s) affected</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isTop = plan.rank === 1
          const isDecided = decidedPlanId === plan.id
          const open = expanded === plan.id
          return (
            <div
              key={plan.id}
              className={clsx(
                "flex flex-col rounded-xl border bg-panel p-5",
                isTop ? "border-cyan/40 shadow-glow" : "border-hairline"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={clsx(
                    "mb-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                    isTop ? "bg-cyan/15 text-cyan" : "bg-raised text-ink-dim"
                  )}>
                    {isTop ? "★ Recommended · Rank 1" : `Rank ${plan.rank}`}
                  </span>
                  <h3 className="font-display text-base font-semibold leading-snug text-ink">{plan.title}</h3>
                </div>
                <ConfidenceRing value={plan.confidence_score} size={64} />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-dim">{plan.summary}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md bg-raised py-2">
                  <TrendingUp size={13} className="mx-auto mb-1 text-green" />
                  <div className="font-mono text-sm text-ink">{plan.estimated_time_saved_minutes}m</div>
                  <div className="text-[10px] text-ink-dim">saved</div>
                </div>
                <div className="rounded-md bg-raised py-2">
                  <Clock3 size={13} className="mx-auto mb-1 text-blue" />
                  <div className="font-mono text-sm capitalize text-ink">{plan.risk_level}</div>
                  <div className="text-[10px] text-ink-dim">risk</div>
                </div>
              </div>

              {plan.highlights.length > 0 && (
                <div className="mt-4 rounded-lg border border-hairline bg-raised/40 p-3">
                  <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-dim">Why this plan?</div>
                  <ul className="space-y-1">
                    {plan.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                        <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-green" /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => setExpanded(open ? null : plan.id)}
                className="mt-4 flex items-center justify-center gap-1 text-xs text-ink-dim hover:text-ink"
              >
                {open ? "Hide reasoning" : "Show reasoning & actions"}
                {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {open && (
                <div className="mt-3 space-y-3 border-t border-hairline pt-3 text-sm">
                  <div>
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-wider text-ink-dim">Why the AI recommends this</div>
                    <ul className="space-y-1">
                      {plan.reasoning.map((r, i) => (
                        <li key={i} className="flex gap-2 text-ink-dim"><span className="text-cyan">›</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-wider text-ink-dim">Action sequence</div>
                    <ol className="space-y-1.5">
                      {plan.actions.map((a) => (
                        <li key={a.order} className="flex items-start gap-2">
                          <span className="mt-0.5 font-mono text-[11px] text-cyan">{a.order}.</span>
                          <div>
                            <div className="text-ink">{a.action} <span className="text-ink-dim">— {a.owner}, ~{a.eta_minutes}m</span></div>
                            <div className="text-xs text-ink-dim">{a.detail}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-wider text-ink-dim">Tradeoffs</div>
                    <ul className="space-y-1">
                      {plan.tradeoffs.map((t, i) => (
                        <li key={i} className="flex gap-2 text-ink-dim"><span className="text-amber">!</span>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
                {approvingPlanId === plan.id ? (
                  <ApprovalTimeline onDone={() => { setApprovingPlanId(null); setDecidedPlanId(plan.id) }} />
                ) : isDecided ? (
                  <div className="flex items-center justify-center gap-2 rounded-md bg-green/10 py-2.5 text-sm font-semibold text-green">
                    <Check size={15} /> Plan approved & logged
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      disabled={deciding}
                      onClick={() => decide(plan, "approved")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-cyan py-2.5 text-sm font-semibold text-void hover:bg-cyan/90 disabled:opacity-50"
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      disabled={deciding}
                      onClick={() => decide(plan, "rejected")}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-hairline px-3 py-2.5 text-sm text-ink-dim hover:border-red/40 hover:text-red disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {isDecided && recoveryValue[plan.id] && <RecoveryValuePanel value={recoveryValue[plan.id]} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
