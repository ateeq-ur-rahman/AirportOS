from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, DecisionLog, RecoveryPlanLog
from app.auth import get_current_user
from app.simulator import state
from app.agents.flight_agent import flight_agent
from app import pipeline_store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    snapshot = flight_agent.get_snapshot()

    total_decisions = (await session.execute(select(func.count(DecisionLog.id)))).scalar() or 0
    approved = (await session.execute(
        select(func.count(DecisionLog.id)).where(DecisionLog.decision == "approved"))).scalar() or 0
    avg_ttd = (await session.execute(select(func.avg(DecisionLog.time_to_decision_seconds)))).scalar() or 0
    avg_conf = (await session.execute(select(func.avg(RecoveryPlanLog.confidence_score)))).scalar() or 0
    total_savings = (await session.execute(
        select(func.sum(RecoveryPlanLog.estimated_time_saved_minutes))
        .join(DecisionLog, DecisionLog.plan_id == RecoveryPlanLog.plan_id)
        .where(DecisionLog.decision == "approved")
    )).scalar() or 0

    by_type: dict[str, int] = {}
    for d in state.disruptions.values():
        by_type[d.type.value] = by_type.get(d.type.value, 0) + 1

    # Executive KPIs — all computed from real in-memory/session-scoped data,
    # not placeholders. Gate utilization and operator workload reflect the
    # current live simulator tick; cost-saved/flights-recovered accumulate
    # across this session's approved decisions (see recovery_value.py).
    occupied_gate_ids = {f.gate for f in state.flights.values()
                          if f.status.value not in ("arrived", "cancelled", "diverted")}
    gate_utilization_pct = round(min(100, len(occupied_gate_ids) / max(1, len(state.gates)) * 100), 1)

    approved_records = [r for r in pipeline_store.decisions.values() if r.get("recovery_value")]
    cost_saved_today = round(sum(r["recovery_value"]["estimated_cost_avoided_usd"] for r in approved_records), 0)
    flights_recovered_today = sum(r["recovery_value"]["flights_recovered"] for r in approved_records)
    ai_recovery_seconds = [r["recovery_value"]["ai_recovery_seconds"] for r in approved_records]
    avg_ai_recovery_seconds = round(sum(ai_recovery_seconds) / len(ai_recovery_seconds), 1) if ai_recovery_seconds else 0

    operator_workload = snapshot["open_disruptions"]  # open disruptions currently awaiting an operator decision

    # Sum of passengers_affected across every impact assessment computed this
    # session (not just approved ones) — real accumulation, not an estimate.
    total_passengers_impacted = sum(i.passengers_affected for i in pipeline_store.impacts.values())
    # Every generated recovery plan counts as one AI decision surfaced to an
    # operator (3 plans per disruption by design — see recovery_agent.py).
    ai_decisions_generated = sum(len(p) for p in pipeline_store.plans.values())

    return {
        "live_snapshot": snapshot,
        "disruptions_by_type": by_type,
        "total_disruptions": len(state.disruptions),
        "decisions": {
            "total": total_decisions,
            "approved": approved,
            "approval_rate_pct": round(approved / total_decisions * 100, 1) if total_decisions else 0,
            "avg_time_to_decision_seconds": round(float(avg_ttd), 1),
        },
        "avg_plan_confidence": round(float(avg_conf), 1),
        "total_estimated_minutes_saved": round(float(total_savings), 1),
        "kpis": {
            "recovery_success_rate_pct": round(approved / total_decisions * 100, 1) if total_decisions else 0,
            "avg_ai_recovery_seconds": avg_ai_recovery_seconds,
            "estimated_cost_saved_today_usd": cost_saved_today,
            "gate_utilization_pct": gate_utilization_pct,
            "operator_workload": operator_workload,
            "flights_recovered_today": flights_recovered_today,
            "total_passengers_impacted": total_passengers_impacted,
            "ai_decisions_generated": ai_decisions_generated,
        },
    }
