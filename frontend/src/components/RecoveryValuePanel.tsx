import { Clock3, DollarSign, Users, PlaneTakeoff, Zap } from "lucide-react"
import type { RecoveryValue } from "../types"

/**
 * Manual-vs-AirportOS comparison shown after an operator approves a plan.
 * `manual_baseline_minutes` is labeled explicitly as an estimate (it is —
 * see backend/app/recovery_value.py); `ai_recovery_seconds` is a real
 * measured wall-clock time from the pipeline run. Never blur that distinction
 * in the copy here.
 */
export function RecoveryValuePanel({ value }: { value: RecoveryValue }) {
  return (
    <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap size={16} className="text-cyan" />
        <h3 className="font-display text-sm font-semibold text-ink">Recovery Value</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-dim">
            <Clock3 size={11} /> Manual recovery (est.)
          </div>
          <div className="font-display text-lg font-semibold text-ink-dim">{value.manual_baseline_minutes} min</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan">
            <Zap size={11} /> AirportOS recovery
          </div>
          <div className="font-display text-lg font-semibold text-cyan">{value.ai_recovery_seconds}s</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-green">
            <Clock3 size={11} /> Time saved
          </div>
          <div className="font-display text-lg font-semibold text-green">{value.time_saved_minutes} min</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber">
            <DollarSign size={11} /> Cost avoided (est.)
          </div>
          <div className="font-display text-lg font-semibold text-amber">${value.estimated_cost_avoided_usd.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-dim">
            <Users size={11} /> Passengers protected
          </div>
          <div className="font-display text-lg font-semibold text-ink">{value.passengers_protected}</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-dim">
            <PlaneTakeoff size={11} /> Flights recovered
          </div>
          <div className="font-display text-lg font-semibold text-ink">{value.flights_recovered}</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-dim">
        Manual recovery time is an operational estimate based on disruption severity and scope. AirportOS recovery time is measured — the actual pipeline runtime for this disruption.
      </p>
    </div>
  )
}
