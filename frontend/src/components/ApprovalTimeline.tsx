import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

const STEPS = [
  "Updating gate allocation…",
  "Notifying ground crew…",
  "Updating FIDS…",
  "Updating passenger displays…",
  "Recovery completed.",
]

/**
 * Purely a UI representation of plan execution kicking off after approval —
 * the backend has already durably logged the decision by the time this
 * renders (see POST /api/recovery/decide). This animates through the
 * dispatch sequence a real integration would trigger next (gate systems,
 * ground crew paging, FIDS, passenger displays) so the operator sees what
 * "approved" sets in motion, not just a static confirmation.
 */
export function ApprovalTimeline({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onDone?.(), 700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 500)
    return () => clearTimeout(t)
  }, [step])

  return (
    <div className="space-y-2 rounded-lg border border-green/30 bg-green/5 p-4">
      {STEPS.map((label, i) => {
        const done = i < step || (i === STEPS.length - 1 && step === STEPS.length - 1)
        const active = i === step && !done
        return (
          <div key={label} className="flex items-center gap-2 text-sm">
            {done ? (
              <CheckCircle2 size={14} className="text-green" />
            ) : active ? (
              <Loader2 size={14} className="animate-spin text-cyan" />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full border border-hairline" />
            )}
            <span className={done ? "text-ink" : active ? "text-cyan" : "text-ink-dim"}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
