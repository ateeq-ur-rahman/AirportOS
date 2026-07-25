import { useEffect, useState, useRef } from "react"
import { AlertTriangle, Brain, ListChecks, CheckCircle2, X } from "lucide-react"
import clsx from "clsx"
import type { LiveEvent } from "../hooks/useWebSocket"

interface Toast {
  id: number
  icon: any
  color: string
  title: string
  detail: string
}

const CONFIG: Record<string, { icon: any; color: string; title: (d: any) => string; detail: (d: any) => string }> = {
  "disruptions.detected": {
    icon: AlertTriangle, color: "text-red border-red/30 bg-red/10",
    title: () => "Disruption detected",
    detail: (d) => d.title || "Analyzing…",
  },
  "impact.assessed": {
    icon: Brain, color: "text-amber border-amber/30 bg-amber/10",
    title: () => "Impact analyzed",
    detail: (d) => `${d.passengers_affected ?? 0} passengers, severity ${d.severity_score ?? "—"}/100`,
  },
  "recovery.plans": {
    icon: ListChecks, color: "text-cyan border-cyan/30 bg-cyan/10",
    title: () => "Recovery plans ready",
    detail: (d) => `${d.plans?.length ?? 0} ranked plans generated — awaiting approval`,
  },
  "decisions.audit": {
    icon: CheckCircle2, color: "text-green border-green/30 bg-green/10",
    title: () => "Operator decision logged",
    detail: (d) => `${d.operator ?? "operator"} ${d.decision ?? ""} the recommended plan`,
  },
}

/**
 * Global toast stack driven by the SAME live event stream the rest of the
 * app consumes (see useLiveEvents / /ws/live) — not a scripted animation.
 * Each toast reflects a real disruption/impact/plan/decision event as it
 * happens, so the AI's activity is visible without the operator needing to
 * navigate anywhere to see it.
 */
export function LiveAINotifications({ lastEvent }: { lastEvent: LiveEvent | null }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (!lastEvent) return
    const key = `${lastEvent.type}-${lastEvent.published_at}`
    if (seen.current === key) return
    seen.current = key

    const cfg = CONFIG[lastEvent.type]
    if (!cfg) return

    const id = idRef.current++
    const toast: Toast = {
      id, icon: cfg.icon, color: cfg.color,
      title: cfg.title(lastEvent.data), detail: cfg.detail(lastEvent.data),
    }
    setToasts((t) => [toast, ...t].slice(0, 4))
    const timer = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
    return () => clearTimeout(timer)
  }, [lastEvent])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.icon
        return (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur",
              "bg-panel/95 animate-[fadeIn_0.2s_ease]",
              t.color
            )}
          >
            <Icon size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-ink">{t.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-ink-dim">{t.detail}</div>
            </div>
            <button
              onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              className="shrink-0 text-ink-dim hover:text-ink"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
