from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.database import get_session, DecisionLog, RecoveryPlanLog, DisruptionLog
from app.schemas import DecisionRequest
from app.auth import get_current_user
from app.simulator import state
from app.eventbus import event_bus, TOPIC_DECISIONS_AUDIT
from app.recovery_value import compute_recovery_value
from app import pipeline_store

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.get("/{disruption_id}/plans")
async def get_plans(disruption_id: str, user: dict = Depends(get_current_user)):
    plans = pipeline_store.plans.get(disruption_id)
    if plans is None:
        raise HTTPException(404, "No plans generated yet for this disruption")
    return {"disruption_id": disruption_id, "plans": plans}


@router.post("/decide")
async def decide(body: DecisionRequest, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    plans = pipeline_store.plans.get(body.disruption_id, [])
    plan = next((p for p in plans if p.id == body.plan_id), None)
    if not plan:
        raise HTTPException(404, "Plan not found for this disruption")

    disruption = state.disruptions.get(body.disruption_id)
    if disruption and body.decision == "approved":
        disruption.resolved = True

    # Persist durable audit trail
    session.add(DisruptionLog(
        disruption_id=body.disruption_id, type=disruption.type.value if disruption else "unknown",
        severity=disruption.severity.value if disruption else "unknown",
        flight_ids=disruption.affected_flight_ids if disruption else [],
        raw_payload=disruption.model_dump(mode="json") if disruption else {},
    ))
    for i, p in enumerate(plans, start=1):
        session.add(RecoveryPlanLog(
            disruption_id=body.disruption_id, plan_id=p.id, rank=p.rank, title=p.title,
            confidence_score=p.confidence_score, estimated_time_saved_minutes=p.estimated_time_saved_minutes,
            estimated_cost_usd=p.estimated_cost_usd, risk_level=p.risk_level.value,
            reasoning=p.reasoning, actions=[a.model_dump() for a in p.actions],
        ))
    decision_log = DecisionLog(
        disruption_id=body.disruption_id, plan_id=body.plan_id, operator_username=user["username"],
        decision=body.decision, notes=body.notes, time_to_decision_seconds=body.time_to_decision_seconds,
        resulting_state={"plan_title": plan.title, "confidence": plan.confidence_score},
    )
    session.add(decision_log)
    await session.commit()

    record = {
        "disruption_id": body.disruption_id, "plan_id": body.plan_id, "decision": body.decision,
        "operator": user["username"], "notes": body.notes,
        "time_to_decision_seconds": body.time_to_decision_seconds,
        "created_at": datetime.utcnow().isoformat(),
    }

    if body.decision == "approved" and disruption:
        impact = pipeline_store.impacts.get(body.disruption_id)
        if impact:
            record["recovery_value"] = compute_recovery_value(disruption, impact, plan).model_dump()

    pipeline_store.decisions[body.disruption_id] = record
    await event_bus.publish(TOPIC_DECISIONS_AUDIT, record)
    return record
