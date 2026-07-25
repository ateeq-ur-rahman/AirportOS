export type FlightStatus =
  | "scheduled" | "boarding" | "delayed" | "departed" | "in_air" | "landed" | "arrived" | "cancelled" | "diverted"

export type DisruptionType =
  | "weather" | "gate_conflict" | "crew_shortage" | "technical" | "atc_hold" | "ground_handling" | "late_inbound"

export type Severity = "low" | "medium" | "high" | "critical"

export interface Flight {
  id: string
  callsign: string
  airline: string
  origin: string
  destination: string
  aircraft_type: string
  tail_number: string
  status: FlightStatus
  scheduled_departure: string
  estimated_departure: string
  scheduled_arrival: string
  estimated_arrival: string
  gate: string
  crew_id: string
  passenger_count: number
  passenger_capacity: number
  delay_minutes: number
  is_inbound: boolean
}

export interface Gate {
  id: string
  terminal: string
  compatible_aircraft: string[]
  occupied_by?: string | null
}

export interface Disruption {
  id: string
  type: DisruptionType
  severity: Severity
  title: string
  description: string
  affected_flight_ids: string[]
  affected_gate_ids: string[]
  detected_at: string
  resolved: boolean
}

export interface ImpactAssessment {
  disruption_id: string
  gate_conflicts: number
  passengers_affected: number
  missed_connections_estimate: number
  crew_at_risk: number
  ground_handling_delay_minutes: number
  turnaround_delay_minutes: number
  downstream_flights_affected: number
  severity_score: number
  narrative: string
}

export interface RecoveryAction {
  order: number
  action: string
  detail: string
  owner: string
  eta_minutes: number
}

export interface RecoveryPlan {
  id: string
  disruption_id: string
  rank: number
  title: string
  summary: string
  confidence_score: number
  estimated_time_saved_minutes: number
  estimated_cost_usd: number
  risk_level: Severity
  reasoning: string[]
  actions: RecoveryAction[]
  tradeoffs: string[]
  highlights: string[]
}

export interface ImpactChainStep {
  order: number
  label: string
  detail: string
  kind: "disruption" | "flight" | "gate" | "passengers" | "crew" | "cost"
}

export interface RecoveryValue {
  manual_baseline_minutes: number
  ai_recovery_seconds: number
  time_saved_minutes: number
  estimated_cost_avoided_usd: number
  passengers_protected: number
  flights_recovered: number
}

export interface AnalyticsKpis {
  recovery_success_rate_pct: number
  avg_ai_recovery_seconds: number
  estimated_cost_saved_today_usd: number
  gate_utilization_pct: number
  operator_workload: number
  flights_recovered_today: number
  total_passengers_impacted: number
  ai_decisions_generated: number
}

export interface FlightSnapshot {
  total_flights: number
  active_flights: number
  delayed_flights: number
  avg_delay_minutes: number
  by_status: Record<string, number>
  total_gates: number
  open_disruptions: number
}

export interface DecisionRecord {
  disruption_id: string
  plan_id: string
  decision: "approved" | "rejected" | "overridden"
  operator: string
  notes: string
  time_to_decision_seconds: number
  created_at: string
  recovery_value?: RecoveryValue
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: number
}

export interface AuthUser {
  username: string
  full_name: string
  role: string
  token: string
}
