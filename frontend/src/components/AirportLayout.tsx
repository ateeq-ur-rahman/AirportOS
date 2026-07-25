import { useMemo } from "react"
import clsx from "clsx"
import type { Gate, Flight } from "../types"

/**
 * Simplified schematic airport layout — not a real map. Groups actual gates
 * by terminal into a grid, colors each by real occupancy (derived by
 * matching live flights to their assigned gate, since simulated gates don't
 * carry a separate occupancy flag), and highlights whichever gate(s) are
 * tied to the currently-selected disruption.
 */
export function AirportLayout({
  gates, flights, highlightGateIds = [], conflictGateIds = [],
}: { gates: Gate[]; flights: Flight[]; highlightGateIds?: string[]; conflictGateIds?: string[] }) {
  const occupancy = useMemo(() => {
    const map = new Map<string, Flight>()
    for (const f of flights) {
      if (f.status !== "arrived" && f.status !== "cancelled" && f.status !== "diverted") {
        map.set(f.gate, f)
      }
    }
    return map
  }, [flights])

  const byTerminal = useMemo(() => {
    const grouped: Record<string, Gate[]> = {}
    for (const g of gates) {
      grouped[g.terminal] = grouped[g.terminal] || []
      grouped[g.terminal].push(g)
    }
    return grouped
  }, [gates])

  return (
    <div className="space-y-5">
      {Object.entries(byTerminal).map(([terminal, terminalGates]) => (
        <div key={terminal}>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Terminal {terminal}</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 md:grid-cols-12">
            {terminalGates.map((g) => {
              const occupiedFlight = occupancy.get(g.id)
              const isHighlighted = highlightGateIds.includes(g.id)
              const isConflict = conflictGateIds.includes(g.id)
              return (
                <div
                  key={g.id}
                  title={occupiedFlight ? `${g.id} — ${occupiedFlight.callsign} (${occupiedFlight.status})` : `${g.id} — available`}
                  className={clsx(
                    "flex aspect-square flex-col items-center justify-center rounded border text-[9px] font-mono transition-all",
                    isConflict && "border-red bg-red/20 text-red animate-pulseDot",
                    !isConflict && isHighlighted && "border-cyan bg-cyan/20 text-cyan ring-1 ring-cyan/50",
                    !isConflict && !isHighlighted && occupiedFlight && "border-amber/40 bg-amber/10 text-amber",
                    !isConflict && !isHighlighted && !occupiedFlight && "border-hairline bg-raised text-ink-dim"
                  )}
                >
                  {g.id.replace("G", "")}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-ink-dim">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-hairline bg-raised" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-amber/40 bg-amber/10" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-cyan bg-cyan/20" /> Selected disruption</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-red bg-red/20" /> Conflict</span>
      </div>
    </div>
  )
}
