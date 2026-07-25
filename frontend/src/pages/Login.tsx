import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Radar, Loader2 } from "lucide-react"
import { useAuth } from "../store/auth"

const DEMO_ACCOUNTS = [
  { username: "operator", password: "operator123", role: "Operator" },
  { username: "supervisor", password: "supervisor123", role: "Supervisor" },
  { username: "admin", password: "admin123", role: "Admin" },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("operator")
  const [password, setPassword] = useState("operator123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(username, password)
      navigate("/")
    } catch {
      setError("Invalid username or password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-void px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full border border-cyan" />
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full border border-cyan" />
        <div className="absolute -left-40 -top-40 h-[240px] w-[240px] rounded-full border border-cyan" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10">
            <Radar size={22} className="text-cyan animate-sweep" style={{ animationDuration: "4s" }} />
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">AirportOS</h1>
          <p className="mt-1 text-sm text-ink-dim">AI Disruption Recovery Copilot</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-hairline bg-panel p-6">
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-dim">Username</label>
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-md border border-hairline bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-cyan"
            placeholder="operator"
          />
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-dim">Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-md border border-hairline bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-cyan"
            placeholder="••••••••"
          />
          {error && <p className="mb-2 text-xs text-red">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-cyan px-4 py-2.5 text-sm font-semibold text-void transition hover:bg-cyan/90 disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Sign in to AOCC
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-hairline bg-panel/60 p-4">
          <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-ink-dim">Demo accounts</p>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username} type="button"
                onClick={() => { setUsername(a.username); setPassword(a.password) }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-ink-dim hover:bg-raised hover:text-ink"
              >
                <span className="font-mono">{a.username}</span>
                <span>{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
