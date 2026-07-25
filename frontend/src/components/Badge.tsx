import clsx from "clsx"
import type { Severity } from "../types"

const SEVERITY_STYLES: Record<Severity, string> = {
  low: "bg-green/10 text-green border-green/30",
  medium: "bg-amber/10 text-amber border-amber/30",
  high: "bg-red/10 text-red border-red/30",
  critical: "bg-red/20 text-red border-red/50",
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider",
      SEVERITY_STYLES[severity]
    )}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", {
        "bg-green": severity === "low",
        "bg-amber": severity === "medium",
        "bg-red animate-pulseDot": severity === "high" || severity === "critical",
      })} />
      {severity}
    </span>
  )
}

const TYPE_LABELS: Record<string, string> = {
  weather: "Weather", gate_conflict: "Gate Conflict", crew_shortage: "Crew Shortage",
  technical: "Technical / AOG", atc_hold: "ATC Hold", ground_handling: "Ground Handling",
  late_inbound: "Late Inbound",
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded border border-hairline bg-raised px-2 py-0.5 text-[11px] font-mono text-ink-dim">
      {TYPE_LABELS[type] || type}
    </span>
  )
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "text-ink-dim", boarding: "text-blue", delayed: "text-amber",
  departed: "text-cyan", in_air: "text-cyan", landed: "text-green",
  arrived: "text-green", cancelled: "text-red", diverted: "text-red",
}

export function StatusText({ status }: { status: string }) {
  return <span className={clsx("font-mono text-xs uppercase", STATUS_STYLES[status])}>{status.replace("_", " ")}</span>
}
