import { useEffect, useState } from "react"
import { AlertTriangle, PlaneTakeoff, DoorOpen, Users, UserX, DollarSign, ArrowDown } from "lucide-react"
import clsx from "clsx"
import type { ImpactChainStep } from "../types"

const ICONS: Record<ImpactChainStep["kind"], any> = {
  disruption: AlertTriangle, flight: PlaneTakeoff, gate: DoorOpen,
  passengers: Users, crew: UserX, cost: DollarSign,
}

const COLORS: Record<ImpactChainStep["kind"], string> = {
  disruption: "border-red/40 bg-red/5 text-red",
  flight: "border-amber/40 bg-amber/5 text-amber",
  gate: "border-blue/40 bg-blue/5 text-blue",
  passengers: "border-cyan/40 bg-cyan/5 text-cyan",
  crew: "border-red/40 bg-red/5 text-red",
  cost: "border-amber/50 bg-amber/10 text-amber",
}

/**
 * Cascading impact visualization: disruption -> flight -> gate -> connecting
 * flight -> passengers -> crew -> cost, rendered as connected cards that
 * animate in sequentially so the operator sees, in order, exactly why a
 * disruption matters. Every step comes from GET /disruptions/{id}/impact-chain
 * — real simulator/impact data, not scripted content.
 */
export function ImpactChain({ steps }: { steps: ImpactChainStep[] }) {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    setVisible(0)
    if (!steps.length) return
    const timers = steps.map((_, i) => setTimeout(() => setVisible(i + 1), i * 220))
    return () => timers.forEach(clearTimeout)
  }, [steps])

  return (
    <div className="flex flex-col items-stretch">
      {steps.map((step, i) => {
        const Icon = ICONS[step.kind]
        const shown = i < visible
        return (
          <div key={step.order} className="flex flex-col items-center">
            <div
              className={clsx(
                "w-full rounded-lg border px-4 py-3 transition-all duration-300",
                COLORS[step.kind],
                shown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon size={15} />
                <span className="text-sm font-semibold text-ink">{step.label}</span>
              </div>
              <p className="mt-1 pl-[23px] text-xs text-ink-dim">{step.detail}</p>
            </div>
            {i < steps.length - 1 && (
              <ArrowDown
                size={16}
                className={clsx("my-1 text-ink-dim transition-opacity duration-300", shown ? "opacity-60" : "opacity-0")}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
