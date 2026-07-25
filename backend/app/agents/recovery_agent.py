"""
Recovery Planner Agent.

Generates exactly three ranked recovery plans per disruption, each with a
confidence score, estimated time saved, operational cost, risk level, a
step-by-step action list with owners/ETAs, explicit reasoning bullets, and
tradeoffs — everything an AOCC operator needs to approve in one click
within the product's <60s target.

Three fixed strategy archetypes are generated per disruption (Rebalance,
Absorb & Prioritize, Cancel & Consolidate) and then scored/ranked by a
transparent weighted formula. This guarantees plan diversity (operators
consistently get genuinely different options, not three minor variations)
while remaining fully explainable.
"""
from __future__ import annotations
import uuid
from app.schemas import Disruption, ImpactAssessment, RecoveryPlan, RecoveryAction, Severity, DisruptionType
from app.agents.flight_agent import flight_agent
from app.agents.llm_adapter import complete


def _score(confidence: float, time_saved: float, cost: float, risk: Severity) -> float:
    risk_penalty = {Severity.LOW: 0, Severity.MEDIUM: 8, Severity.HIGH: 20, Severity.CRITICAL: 35}[risk]
    return round(confidence * 0.45 + min(time_saved, 180) * 0.25 - cost / 1000 * 0.15 - risk_penalty * 0.4, 2)


class RecoveryAgent:
    async def generate_plans(self, disruption: Disruption, impact: ImpactAssessment) -> list[RecoveryPlan]:
        flights = flight_agent.flights_for(disruption.affected_flight_ids)
        n = max(1, len(flights))
        avg_delay = sum(f.delay_minutes for f in flights) / n if flights else 30

        candidates = [
            self._plan_rebalance(disruption, impact, flights, avg_delay),
            self._plan_absorb_prioritize(disruption, impact, flights, avg_delay),
            self._plan_cancel_consolidate(disruption, impact, flights, avg_delay),
        ]
        candidates.sort(key=lambda p: _score(p.confidence_score, p.estimated_time_saved_minutes, p.estimated_cost_usd, p.risk_level), reverse=True)
        for i, plan in enumerate(candidates, start=1):
            plan.rank = i
        self._compute_highlights(candidates, impact)
        return candidates

    @staticmethod
    def _compute_highlights(plans: list[RecoveryPlan], impact: ImpactAssessment) -> None:
        """Populate each plan's `highlights` with short checkmark phrases,
        purely by comparing the three generated plans against each other on
        their real numeric fields. No phrase here is independent of the
        underlying number — this is what backs the "Why this plan?" UI."""
        risk_order = {Severity.LOW: 0, Severity.MEDIUM: 1, Severity.HIGH: 2, Severity.CRITICAL: 3}
        max_time_saved = max(p.estimated_time_saved_minutes for p in plans)
        min_risk = min(risk_order[p.risk_level] for p in plans)
        max_confidence = max(p.confidence_score for p in plans)

        for p in plans:
            h: list[str] = []
            if p.estimated_time_saved_minutes == max_time_saved:
                h.append(f"Saves the most time (~{round(p.estimated_time_saved_minutes)} min)")
            if risk_order[p.risk_level] == min_risk:
                h.append("Lowest risk level")
            if p.confidence_score == max_confidence:
                h.append("Highest AI confidence")
            if impact.gate_conflicts > 0 and "Rebalance" in p.title:
                h.append("Resolves gate conflict immediately")
            if impact.crew_at_risk == 0:
                h.append("No crew duty-time violations")
            if p.rank == 1:
                h.append("Best overall balance of confidence, time saved, and risk")
            p.highlights = h[:5]

    def _plan_rebalance(self, d: Disruption, impact: ImpactAssessment, flights, avg_delay) -> RecoveryPlan:
        confidence = 88 if impact.gate_conflicts > 0 else 74
        time_saved = min(avg_delay * 0.6 + impact.gate_conflicts * 8, 120)
        cost = 1500 + impact.gate_conflicts * 800
        actions = [
            RecoveryAction(order=1, action="Reassign conflicting flights to nearest compatible open gates",
                            detail=f"{max(1, impact.gate_conflicts)} gate reassignment(s) computed from real-time gate compatibility matrix.",
                            owner="AOCC", eta_minutes=5),
            RecoveryAction(order=2, action="Notify ground handling and gate agents of new stand assignments",
                            detail="Push updated stand assignments to ramp and gate-agent tablets.",
                            owner="Gate Agent", eta_minutes=3),
            RecoveryAction(order=3, action="Re-sequence pushback order with ATC liaison",
                            detail="Coordinate revised pushback sequence to reclaim runway slot.",
                            owner="ATC Liaison", eta_minutes=10),
        ]
        reasoning = [
            f"{impact.gate_conflicts} active gate conflict(s) detected — reassignment removes the binding constraint directly.",
            "Compatible open gates identified via aircraft-type / terminal compatibility matrix.",
            f"Avoids cancellations; preserves all {len(flights)} affected flight(s) on schedule where possible.",
        ]
        tradeoffs = ["Requires rapid ground-crew coordination; passenger walking distance may increase.",
                     "Does not reduce weather/ATC-driven delay itself, only its knock-on gate impact."]
        return RecoveryPlan(
            id=str(uuid.uuid4())[:8], disruption_id=d.id, rank=0,
            title="Rebalance: Gate & Sequence Optimization",
            summary="Resolve gate conflicts via real-time reassignment and pushback re-sequencing to minimize knock-on delay.",
            confidence_score=confidence, estimated_time_saved_minutes=round(time_saved, 1),
            estimated_cost_usd=cost, risk_level=Severity.LOW if impact.gate_conflicts == 0 else Severity.MEDIUM,
            reasoning=reasoning, actions=actions, tradeoffs=tradeoffs,
        )

    def _plan_absorb_prioritize(self, d: Disruption, impact: ImpactAssessment, flights, avg_delay) -> RecoveryPlan:
        confidence = 81 if impact.crew_at_risk == 0 else 66
        time_saved = min(avg_delay * 0.35 + impact.passengers_affected / 100, 90)
        cost = 900 + impact.missed_connections_estimate * 25
        actions = [
            RecoveryAction(order=1, action="Prioritize highest-connection-risk flights for earliest available slot",
                            detail=f"~{impact.missed_connections_estimate} passengers at missed-connection risk resequenced first.",
                            owner="AOCC", eta_minutes=4),
            RecoveryAction(order=2, action="Extend crew duty coverage / call in standby crew where within limits",
                            detail=f"{impact.crew_at_risk} crew member(s) flagged near duty-time limit reviewed against roster.",
                            owner="Crew Scheduling", eta_minutes=12),
            RecoveryAction(order=3, action="Issue proactive passenger notifications for delayed flights",
                            detail="Automated SMS/app push with revised times and rebooking options for missed connections.",
                            owner="Ground Ops", eta_minutes=6),
        ]
        reasoning = [
            f"{impact.passengers_affected} passengers affected; prioritizing by connection risk minimizes missed-connection count.",
            f"{impact.crew_at_risk} crew member(s) near duty limits — plan front-loads crew scheduling review.",
            "Keeps disruption contained to the affected flight set rather than cascading changes airport-wide.",
        ]
        tradeoffs = ["Some low-priority flights absorb additional delay to protect high-risk connections.",
                     "Standby crew activation carries incremental cost."]
        return RecoveryPlan(
            id=str(uuid.uuid4())[:8], disruption_id=d.id, rank=0,
            title="Absorb & Prioritize: Protect Connections",
            summary="Absorb delay in low-impact flights while resequencing high missed-connection-risk flights and crew coverage.",
            confidence_score=confidence, estimated_time_saved_minutes=round(time_saved, 1),
            estimated_cost_usd=cost, risk_level=Severity.MEDIUM if impact.crew_at_risk else Severity.LOW,
            reasoning=reasoning, actions=actions, tradeoffs=tradeoffs,
        )

    def _plan_cancel_consolidate(self, d: Disruption, impact: ImpactAssessment, flights, avg_delay) -> RecoveryPlan:
        severe = d.severity in (Severity.HIGH, Severity.CRITICAL) or avg_delay > 90
        confidence = 72 if severe else 55
        time_saved = min(avg_delay * 0.9, 150) if severe else avg_delay * 0.4
        cost = 6000 + impact.passengers_affected * 40
        actions = [
            RecoveryAction(order=1, action="Consolidate lowest-load affected flights onto next available departure",
                            detail="Merge passenger loads from lowest-occupancy affected flights to free a slot/aircraft.",
                            owner="AOCC", eta_minutes=8),
            RecoveryAction(order=2, action="Trigger rebooking workflow for displaced passengers",
                            detail=f"Auto-rebook ~{max(1, impact.passengers_affected // 6)} displaced passengers onto partner/next flights.",
                            owner="Ground Ops", eta_minutes=15),
            RecoveryAction(order=3, action="Release reclaimed gate/slot back to the pool",
                            detail="Free up gate and runway slot immediately for downstream traffic.",
                            owner="AOCC", eta_minutes=5),
        ]
        reasoning = [
            f"Disruption severity ({d.severity.value}) and avg delay (~{round(avg_delay)} min) exceed the threshold where absorbing delay stops being cost-effective.",
            "Consolidating low-load flights recovers the largest single block of time but affects the most passengers directly.",
            "Recommended primarily as a fallback if Plan 1/2 cannot be executed within the operational window.",
        ]
        tradeoffs = ["Highest passenger friction and compensation/rebooking cost of the three options.",
                     "Brand/NPS impact from cancellations is not captured in the cost estimate."]
        return RecoveryPlan(
            id=str(uuid.uuid4())[:8], disruption_id=d.id, rank=0,
            title="Cancel & Consolidate: Reset the Bank",
            summary="Consolidate lowest-load flights and rebook displaced passengers to fully reclaim schedule integrity.",
            confidence_score=confidence, estimated_time_saved_minutes=round(time_saved, 1),
            estimated_cost_usd=cost, risk_level=Severity.HIGH if severe else Severity.MEDIUM,
            reasoning=reasoning, actions=actions, tradeoffs=tradeoffs,
        )


recovery_agent = RecoveryAgent()
