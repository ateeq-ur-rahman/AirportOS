/**
 * Signature visual element: a circular "confidence ring" that reads at a
 * glance like an instrument gauge — the AI's confidence in a recovery plan,
 * rendered the way an operator would expect to see a control-room dial.
 */
export function ConfidenceRing({ value, size = 72 }: { value: number; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c - (pct / 100) * c
  const color = pct >= 80 ? "#2DD9C8" : pct >= 60 ? "#F2A93B" : "#FF5D5D"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#26303F" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg font-semibold leading-none" style={{ color }}>{Math.round(pct)}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mt-0.5">conf.</span>
      </div>
    </div>
  )
}
