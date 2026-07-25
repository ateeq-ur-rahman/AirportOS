import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts"
import { Gauge, Timer, ThumbsUp, ListChecks } from "lucide-react"
import { api } from "../api/client"
import { StatCard, Panel } from "../components/StatCard"

const PIE_COLORS = ["#2DD9C8", "#F2A93B", "#FF5D5D", "#4E8FFF", "#3DDC84", "#8D9BB0", "#9B7BFF"]

export default function Analytics() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    api.analytics().then(setData)
    const id = setInterval(() => api.analytics().then(setData), 8000)
    return () => clearInterval(id)
  }, [])

  if (!data) return <div className="p-6 text-sm text-ink-dim">Loading analytics…</div>

  const typeData = Object.entries(data.disruptions_by_type || {}).map(([name, value]) => ({ name, value }))
  const statusData = Object.entries(data.live_snapshot?.by_status || {}).map(([name, value]) => ({ name, value }))

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-ink-dim">Operational KPIs and the AI decision-learning loop.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Avg Plan Confidence" value={`${data.avg_plan_confidence}%`} icon={<Gauge size={16} />} accent="cyan" />
        <StatCard label="Approval Rate" value={`${data.decisions.approval_rate_pct}%`} sub={`${data.decisions.approved}/${data.decisions.total} decisions`} icon={<ThumbsUp size={16} />} accent="green" />
        <StatCard label="Avg Time-to-Decision" value={`${data.decisions.avg_time_to_decision_seconds}s`} sub="operator response time" icon={<Timer size={16} />} accent="blue" />
        <StatCard label="Minutes Saved (Approved)" value={Math.round(data.total_estimated_minutes_saved)} icon={<ListChecks size={16} />} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Disruptions by Type">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#121821", border: "1px solid #26303F", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Live Flight Status Distribution">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26303F" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8D9BB0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8D9BB0", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#121821", border: "1px solid #26303F", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#2DD9C8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Decision Log Summary">
        <p className="text-sm text-ink-dim">
          {data.decisions.total} operator decision(s) logged · {data.decisions.approved} approved
          ({data.decisions.approval_rate_pct}%) · average confidence of proposed plans {data.avg_plan_confidence}%.
          Every decision feeds the durable audit trail used to refine future recovery-plan scoring.
        </p>
      </Panel>
    </div>
  )
}
