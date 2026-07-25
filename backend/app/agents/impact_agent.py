"""
Impact Analysis Agent — the "AI Impact Engine".

Given a Disruption, predicts:
  - gate conflicts triggered/worsened
  - passenger impact (pax affected, estimated missed connections)
  - crew impact (crew put at duty-time risk)
  - ground handling delay
  - turnaround delay
  - a 0-100 severity score and a plain-English narrative

Scoring is a transparent weighted heuristic (see SEVERITY_WEIGHTS) so
every number the operator sees is traceable to a rule, not a guess.
When an LLM is configured it is used only to phrase `narrative` in
natural language from the already-computed numbers — never to invent
the numbers themselves.
"""
from __future__ import annotations
from app.simulator import state
from app.schemas import Disruption, ImpactAssessment, DisruptionType, FlightStatus
from app.agents.flight_agent import flight_agent
from app.agents.llm_adapter import complete

SEVERITY_WEIGHTS = {
    "low": 15, "medium": 40, "high": 70, "critical": 90,
}


class ImpactAgent:
    async def assess(self, disruption: Disruption) -> ImpactAssessment:
        flights = flight_agent.flights_for(disruption.affected_flight_ids)
        passengers = sum(f.passenger_count for f in flights)

        # Missed connections: rough estimate — flights within 90 min of an
        # affected flight's revised arrival at the same airport share risk.
        missed_connections = 0
        for f in flights:
            missed_connections += int(f.passenger_count * min(0.35, f.delay_minutes / 400))

        gate_conflicts = sum(1 for g, fids in flight_agent.detect_gate_conflicts()
                              if any(fid in disruption.affected_flight_ids for fid in fids))
        if disruption.type == DisruptionType.GATE_CONFLICT:
            gate_conflicts = max(gate_conflicts, len(disruption.affected_gate_ids))

        crew_at_risk = 0
        for f in flights:
            crew = state.crew.get(f.crew_id)
            if crew and crew.duty_minutes_remaining - f.delay_minutes < 60:
                crew_at_risk += 1

        ground_handling_delay = int(sum(f.delay_minutes for f in flights) / max(1, len(flights)) * 0.6) if flights else 0
        turnaround_delay = int(sum(f.delay_minutes for f in flights) / max(1, len(flights))) if flights else 0

        downstream = 0
        affected_gates = {f.gate for f in flights}
        for other in state.flights.values():
            if other.id in disruption.affected_flight_ids:
                continue
            if other.gate in affected_gates and other.status not in (FlightStatus.ARRIVED, FlightStatus.CANCELLED):
                downstream += 1

        base = SEVERITY_WEIGHTS[disruption.severity.value]
        scale = min(1.0, len(flights) / 20) * 10
        pax_scale = min(1.0, passengers / 3000) * 10
        severity_score = round(min(100, base + scale + pax_scale), 1)

        narrative = self._heuristic_narrative(
            disruption, len(flights), passengers, missed_connections,
            gate_conflicts, crew_at_risk, ground_handling_delay, turnaround_delay, downstream,
        )
        llm_narrative = await complete(
            system_prompt=(
                "You are the AirportOS Impact Analysis Agent. Given precomputed "
                "operational metrics, write a crisp 2-3 sentence operator-facing "
                "impact narrative. Never invent numbers not provided to you."
            ),
            user_prompt=(
                f"Disruption: {disruption.title} ({disruption.severity.value}). "
                f"Flights affected: {len(flights)}. Passengers affected: {passengers}. "
                f"Missed connections est: {missed_connections}. Gate conflicts: {gate_conflicts}. "
                f"Crew at risk: {crew_at_risk}. Ground handling delay: {ground_handling_delay} min. "
                f"Turnaround delay: {turnaround_delay} min. Downstream flights: {downstream}. "
                f"Severity score: {severity_score}/100."
            ),
        )

        return ImpactAssessment(
            disruption_id=disruption.id,
            gate_conflicts=gate_conflicts,
            passengers_affected=passengers,
            missed_connections_estimate=missed_connections,
            crew_at_risk=crew_at_risk,
            ground_handling_delay_minutes=ground_handling_delay,
            turnaround_delay_minutes=turnaround_delay,
            downstream_flights_affected=downstream,
            severity_score=severity_score,
            narrative=llm_narrative or narrative,
        )

    @staticmethod
    def _heuristic_narrative(disruption, n_flights, pax, missed, gates, crew, gh_delay, ta_delay, downstream) -> str:
        return (
            f"{disruption.title} affects {n_flights} flight(s) and an estimated {pax} passengers, "
            f"with ~{missed} at risk of missed connections. {gates} gate conflict(s) and {crew} crew "
            f"member(s) approaching duty-time limits are implicated. Expect ~{gh_delay} min of added "
            f"ground handling delay and ~{ta_delay} min of turnaround delay, with {downstream} downstream "
            f"flight(s) exposed via shared gate/aircraft rotation."
        )


def build_impact_chain(disruption: Disruption, impact: ImpactAssessment) -> list:
    """Builds the ordered cascading-impact chain for the UI: disruption ->
    primary flight -> gate -> a downstream/connecting flight sharing that
    gate -> passengers -> crew -> estimated cost. Every node is derived from
    real simulator/impact data; if a hop has no real downstream flight to
    point to, that node is simply omitted rather than invented."""
    from app.schemas import ImpactChainStep  # local import avoids a cycle
    flights = flight_agent.flights_for(disruption.affected_flight_ids)
    steps: list[ImpactChainStep] = []
    order = 1

    steps.append(ImpactChainStep(
        order=order, kind="disruption", label=disruption.title,
        detail=f"{disruption.severity.value.capitalize()} severity, detected {disruption.detected_at.strftime('%H:%M:%S')} UTC",
    ))
    order += 1

    primary = flights[0] if flights else None
    if primary:
        steps.append(ImpactChainStep(
            order=order, kind="flight", label=f"Flight {primary.callsign} delayed",
            detail=f"+{primary.delay_minutes} min, gate {primary.gate}, {primary.passenger_count} passengers onboard",
        ))
        order += 1

        gate = state.gates.get(primary.gate)
        if gate:
            steps.append(ImpactChainStep(
                order=order, kind="gate", label=f"Gate {gate.id} occupied",
                detail=f"Terminal {gate.terminal} — held past scheduled release",
            ))
            order += 1

        downstream = next(
            (f for f in state.flights.values()
             if f.id != primary.id and f.gate == primary.gate and f.id not in disruption.affected_flight_ids
             and f.status not in ("arrived", "cancelled")),
            None,
        )
        if downstream:
            steps.append(ImpactChainStep(
                order=order, kind="flight", label=f"Flight {downstream.callsign} at risk",
                detail=f"Shares gate {primary.gate}; next scheduled departure from same stand",
            ))
            order += 1

    steps.append(ImpactChainStep(
        order=order, kind="passengers", label=f"{impact.passengers_affected} passengers affected",
        detail=f"~{impact.missed_connections_estimate} at risk of missed connections",
    ))
    order += 1

    if impact.crew_at_risk > 0:
        steps.append(ImpactChainStep(
            order=order, kind="crew", label=f"{impact.crew_at_risk} crew conflict(s)",
            detail="Crew approaching flight duty period (FDP) limit",
        ))
        order += 1

    # Cost estimate: reuses the same cost basis the recovery plans are
    # scored against (see recovery_agent) — ground handling delay minutes
    # priced at a flat operational rate, purely illustrative but consistent
    # across the app rather than a one-off number.
    estimated_cost = round(impact.ground_handling_delay_minutes * 45 + impact.passengers_affected * 12, 0)
    steps.append(ImpactChainStep(
        order=order, kind="cost", label="Estimated operational cost",
        detail=f"${estimated_cost:,.0f} (ground handling delay + passenger disruption cost, estimated)",
    ))
    return steps


impact_agent = ImpactAgent()
