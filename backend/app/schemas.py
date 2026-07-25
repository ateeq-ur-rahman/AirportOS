"""Pydantic (wire-format) schemas shared between simulator, agents, and API."""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field


class FlightStatus(str, Enum):
    SCHEDULED = "scheduled"
    BOARDING = "boarding"
    DELAYED = "delayed"
    DEPARTED = "departed"
    IN_AIR = "in_air"
    LANDED = "landed"
    ARRIVED = "arrived"
    CANCELLED = "cancelled"
    DIVERTED = "diverted"


class DisruptionType(str, Enum):
    WEATHER = "weather"
    GATE_CONFLICT = "gate_conflict"
    CREW_SHORTAGE = "crew_shortage"
    TECHNICAL = "technical"
    ATC_HOLD = "atc_hold"
    GROUND_HANDLING = "ground_handling"
    LATE_INBOUND = "late_inbound"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Flight(BaseModel):
    id: str
    callsign: str
    airline: str
    origin: str
    destination: str
    aircraft_type: str
    tail_number: str
    status: FlightStatus
    scheduled_departure: datetime
    estimated_departure: datetime
    scheduled_arrival: datetime
    estimated_arrival: datetime
    gate: str
    crew_id: str
    passenger_count: int
    passenger_capacity: int
    delay_minutes: int = 0
    is_inbound: bool = False  # arriving flight feeding a downstream departure


class Gate(BaseModel):
    id: str
    terminal: str
    compatible_aircraft: list[str]
    occupied_by: Optional[str] = None
    available_at: Optional[datetime] = None


class Crew(BaseModel):
    id: str
    role: Literal["pilot", "cabin", "ground"]
    assigned_flight: Optional[str] = None
    duty_minutes_remaining: int


class Disruption(BaseModel):
    id: str
    type: DisruptionType
    severity: Severity
    title: str
    description: str
    affected_flight_ids: list[str]
    affected_gate_ids: list[str] = Field(default_factory=list)
    detected_at: datetime
    resolved: bool = False


class ImpactAssessment(BaseModel):
    disruption_id: str
    gate_conflicts: int
    passengers_affected: int
    missed_connections_estimate: int
    crew_at_risk: int
    ground_handling_delay_minutes: int
    turnaround_delay_minutes: int
    downstream_flights_affected: int
    severity_score: float  # 0-100
    narrative: str


class RecoveryAction(BaseModel):
    order: int
    action: str
    detail: str
    owner: Literal["AOCC", "Ground Ops", "Gate Agent", "ATC Liaison", "Crew Scheduling"]
    eta_minutes: int


class RecoveryPlan(BaseModel):
    id: str
    disruption_id: str
    rank: int
    title: str
    summary: str
    confidence_score: float          # 0-100
    estimated_time_saved_minutes: float
    estimated_cost_usd: float
    risk_level: Severity
    reasoning: list[str]
    actions: list[RecoveryAction]
    tradeoffs: list[str]
    # Short, comparative checkmarks computed by ranking this plan against its
    # siblings (see recovery_agent._compute_highlights) — e.g. "Lowest
    # operational cost", "Fastest recovery". Every phrase here is derived
    # from the actual numeric fields above, never invented independently.
    highlights: list[str] = Field(default_factory=list)


class ImpactChainStep(BaseModel):
    """One node in the cascading-impact visualization: disruption -> flight
    -> gate -> connecting flight -> passengers -> crew -> cost. Built from
    real simulator/impact data, not scripted."""
    order: int
    label: str
    detail: str
    kind: Literal["disruption", "flight", "gate", "passengers", "crew", "cost"]


class RecoveryValue(BaseModel):
    """Computed after an operator approves a plan — the 'manual vs AirportOS'
    comparison. manual_baseline_minutes is an explicit ESTIMATE (stated as
    such to the operator), not a measured fact; ai_recovery_seconds is the
    actual measured wall-clock time the pipeline took to go from disruption
    detection to plans-ready."""
    manual_baseline_minutes: float
    ai_recovery_seconds: float
    time_saved_minutes: float
    estimated_cost_avoided_usd: float
    passengers_protected: int
    flights_recovered: int


class DecisionRequest(BaseModel):
    disruption_id: str
    plan_id: str
    decision: Literal["approved", "rejected", "overridden"]
    notes: str = ""
    time_to_decision_seconds: float = 0.0


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    message: str
    disruption_id: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str


class LoginRequest(BaseModel):
    username: str
    password: str
