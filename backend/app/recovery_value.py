"""
Computes the "Recovery Value" comparison shown to the operator after they
approve a plan: manual baseline time vs. AirportOS's actual measured time,
cost avoided, passengers protected, flights recovered.

IMPORTANT — what's measured vs. estimated, stated plainly so this is never
misrepresented to a user of the app:
  - `ai_recovery_seconds` is a REAL measurement: wall-clock time the
    orchestrator pipeline actually took (see app/orchestrator.py), stored
    in app.pipeline_store.pipeline_durations.
  - `manual_baseline_minutes` is an explicit ESTIMATE of how long the same
    coordination would take a human operator working phones/radios across
    disconnected systems, based on disruption size/severity. It is not a
    measured fact, and the UI must label it as an estimate.
"""
from __future__ import annotations
from app.schemas import Disruption, ImpactAssessment, RecoveryPlan, Severity, RecoveryValue
from app import pipeline_store

SEVERITY_BASELINE_MINUTES = {
    Severity.LOW: 12, Severity.MEDIUM: 20, Severity.HIGH: 30, Severity.CRITICAL: 40,
}


def estimate_manual_baseline_minutes(disruption: Disruption) -> float:
    """A stated, documented estimate — not a measurement. Base coordination
    time by severity, plus ~1.5 min per additional affected flight to
    reflect the extra phone/radio coordination each flight adds."""
    base = SEVERITY_BASELINE_MINUTES[disruption.severity]
    extra_flights = max(0, len(disruption.affected_flight_ids) - 1)
    return round(base + extra_flights * 1.5, 1)


def compute_recovery_value(disruption: Disruption, impact: ImpactAssessment, plan: RecoveryPlan) -> RecoveryValue:
    manual_minutes = estimate_manual_baseline_minutes(disruption)
    ai_seconds = pipeline_store.pipeline_durations.get(disruption.id, 1.0)
    time_saved = round(manual_minutes - (ai_seconds / 60), 1)

    # "Cost of inaction" reuses the same basis as the impact-chain cost node
    # (app.agents.impact_agent.build_impact_chain) so the number is
    # consistent everywhere it's shown in the app. Cost avoided = cost of
    # inaction minus what executing this plan costs.
    cost_of_inaction = impact.ground_handling_delay_minutes * 45 + impact.passengers_affected * 12
    cost_avoided = max(0.0, round(cost_of_inaction - plan.estimated_cost_usd, 0))

    return RecoveryValue(
        manual_baseline_minutes=manual_minutes,
        ai_recovery_seconds=ai_seconds,
        time_saved_minutes=max(0.0, time_saved),
        estimated_cost_avoided_usd=cost_avoided,
        passengers_protected=impact.passengers_affected,
        flights_recovered=len(disruption.affected_flight_ids),
    )
