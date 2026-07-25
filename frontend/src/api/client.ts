import type {
  Flight, Gate, Disruption, ImpactAssessment, RecoveryPlan, FlightSnapshot, DecisionRecord, ImpactChainStep,
} from "../types"

const BASE = "/api"

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("airportos_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401) {
    localStorage.removeItem("airportos_token")
    localStorage.removeItem("airportos_user")
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; username: string; full_name: string; role: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  flights: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString()
    return request<{ count: number; flights: Flight[] }>(`/flights${qs ? `?${qs}` : ""}`)
  },
  flightSnapshot: () => request<FlightSnapshot>("/flights/snapshot"),
  gates: () => request<{ count: number; gates: Gate[] }>("/flights/gates"),

  disruptions: (openOnly = false) =>
    request<{ count: number; disruptions: Disruption[]; orchestration_backend: string }>(
      `/disruptions${openOnly ? "?open_only=true" : ""}`
    ),
  disruptionDetail: (id: string) =>
    request<{ disruption: Disruption; impact: ImpactAssessment | null; plans: RecoveryPlan[]; decision: DecisionRecord | null }>(
      `/disruptions/${id}`
    ),
  impactChain: (disruptionId: string) =>
    request<{ disruption_id: string; chain: ImpactChainStep[] }>(`/disruptions/${disruptionId}/impact-chain`),
  simulateDisruption: () =>
    request<{ disruption: Disruption; impact: ImpactAssessment; plans: RecoveryPlan[] }>("/disruptions/simulate", {
      method: "POST",
    }),
  resolveDisruption: (id: string) => request(`/disruptions/${id}/resolve`, { method: "POST" }),

  plansFor: (disruptionId: string) =>
    request<{ disruption_id: string; plans: RecoveryPlan[] }>(`/recovery/${disruptionId}/plans`),
  decide: (body: { disruption_id: string; plan_id: string; decision: string; notes?: string; time_to_decision_seconds?: number }) =>
    request<DecisionRecord>("/recovery/decide", { method: "POST", body: JSON.stringify(body) }),

  chat: (message: string, disruptionId?: string) =>
    request<{ role: string; content: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, disruption_id: disruptionId }),
    }),

  analytics: () => request<any>("/analytics/overview"),
}
