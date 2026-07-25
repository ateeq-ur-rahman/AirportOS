import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutGrid, AlertTriangle, ListChecks, MessagesSquare, GanttChartSquare,
  BellRing, BarChart3, LogOut, PlaneTakeoff, Radar,
} from "lucide-react"
import { useAuth } from "../store/auth"
import { useLiveEvents } from "../hooks/useWebSocket"
import { LiveAINotifications } from "./LiveAINotifications"
import { ReactNode, useEffect, useState } from "react"
import { api } from "../api/client"
import type { FlightSnapshot } from "../types"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/disruptions", label: "Disruption Center", icon: AlertTriangle },
  { to: "/recovery", label: "Recovery Planner", icon: ListChecks },
  { to: "/copilot", label: "AI Copilot", icon: MessagesSquare },
  { to: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { to: "/alerts", label: "Alerts", icon: BellRing },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { connected, lastEvent } = useLiveEvents()
  const [snapshot, setSnapshot] = useState<FlightSnapshot | null>(null)

  useEffect(() => {
    api.flightSnapshot().then(setSnapshot).catch(() => {})
  }, [lastEvent])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void">
      {/* Icon rail */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-panel">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-hairline">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 border border-cyan/30">
            <Radar size={16} className="text-cyan animate-sweep" style={{ animationDuration: "4s" }} />
          </div>
          <div>
            <div className="font-display text-sm font-semibold tracking-wide text-ink">AirportOS</div>
            <div className="text-[10px] font-mono text-ink-dim uppercase tracking-wider">Recovery Copilot</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-cyan/10 text-cyan border border-cyan/20"
                    : "text-ink-dim border border-transparent hover:bg-raised hover:text-ink"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-hairline px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green animate-pulseDot" : "bg-red"}`} />
            <span className="font-mono text-[11px] text-ink-dim">{connected ? "LIVE FEED CONNECTED" : "RECONNECTING…"}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-raised px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{user?.full_name}</div>
              <div className="truncate text-[11px] font-mono uppercase text-ink-dim">{user?.role}</div>
            </div>
            <button
              onClick={() => { logout(); navigate("/login") }}
              className="ml-2 rounded p-1.5 text-ink-dim hover:bg-panel hover:text-red"
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Ticker bar */}
        <div className="flex h-11 shrink-0 items-center gap-6 border-b border-hairline bg-panel px-5 font-mono text-[12px] text-ink-dim">
          <div className="flex items-center gap-1.5">
            <PlaneTakeoff size={13} className="text-cyan" />
            <span className="text-ink">{snapshot?.total_flights ?? "—"}</span> flights
          </div>
          <div className="h-3.5 w-px bg-hairline" />
          <div><span className="text-amber">{snapshot?.delayed_flights ?? "—"}</span> delayed</div>
          <div className="h-3.5 w-px bg-hairline" />
          <div><span className="text-red">{snapshot?.open_disruptions ?? "—"}</span> open disruptions</div>
          <div className="h-3.5 w-px bg-hairline" />
          <div>avg delay <span className="text-ink">{snapshot?.avg_delay_minutes ?? "—"}m</span></div>
          <div className="ml-auto text-[11px] uppercase tracking-widest text-ink-dim/70">AOCC — Hyderabad Ops</div>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <LiveAINotifications lastEvent={lastEvent} />
    </div>
  )
}
