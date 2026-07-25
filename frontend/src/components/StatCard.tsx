import { ReactNode } from "react"
import clsx from "clsx"

export function StatCard({
  label, value, sub, icon, accent = "cyan",
}: { label: string; value: ReactNode; sub?: string; icon?: ReactNode; accent?: "cyan" | "amber" | "red" | "blue" | "green" }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-dim">{label}</span>
        {icon && <span className={clsx("opacity-80", {
          "text-cyan": accent === "cyan", "text-amber": accent === "amber", "text-red": accent === "red",
          "text-blue": accent === "blue", "text-green": accent === "green",
        })}>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-dim">{sub}</div>}
    </div>
  )
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-hairline bg-panel", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
