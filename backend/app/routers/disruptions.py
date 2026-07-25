from fastapi import APIRouter, Depends, HTTPException
from app.simulator import state, generate_disruption
from app.auth import get_current_user
from app.orchestrator import run_recovery_pipeline, orchestration_backend
from app.eventbus import event_bus, TOPIC_DISRUPTION_DETECTED
from app.agents.impact_agent import build_impact_chain
from app import pipeline_store

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])


@router.get("")
async def list_disruptions(open_only: bool = False, user: dict = Depends(get_current_user)):
    items = list(state.disruptions.values())
    if open_only:
        items = [d for d in items if not d.resolved]
    items.sort(key=lambda d: d.detected_at, reverse=True)
    return {"count": len(items), "disruptions": items, "orchestration_backend": orchestration_backend()}


@router.get("/{disruption_id}")
async def get_disruption(disruption_id: str, user: dict = Depends(get_current_user)):
    d = state.disruptions.get(disruption_id)
    if not d:
        raise HTTPException(404, "Disruption not found")
    return {
        "disruption": d,
        "impact": pipeline_store.impacts.get(disruption_id),
        "plans": pipeline_store.plans.get(disruption_id, []),
        "decision": pipeline_store.decisions.get(disruption_id),
    }


@router.get("/{disruption_id}/impact-chain")
async def impact_chain(disruption_id: str, user: dict = Depends(get_current_user)):
    d = state.disruptions.get(disruption_id)
    impact = pipeline_store.impacts.get(disruption_id)
    if not d or not impact:
        raise HTTPException(404, "Disruption or impact assessment not found")
    return {"disruption_id": disruption_id, "chain": build_impact_chain(d, impact)}


@router.post("/simulate")
async def simulate_disruption(user: dict = Depends(get_current_user)):
    """Manually trigger a disruption + full AI pipeline run — used by the
    'Simulate Disruption' demo button so presenters aren't at the mercy of
    the random tick timer."""
    d = await generate_disruption()
    if not d:
        raise HTTPException(400, "No flights available to simulate a disruption against")
    await event_bus.publish(TOPIC_DISRUPTION_DETECTED, d.model_dump())
    impact, plans = await run_recovery_pipeline(d)
    pipeline_store.impacts[d.id] = impact
    pipeline_store.plans[d.id] = plans
    return {"disruption": d, "impact": impact, "plans": plans}


@router.post("/{disruption_id}/resolve")
async def resolve_disruption(disruption_id: str, user: dict = Depends(get_current_user)):
    d = state.disruptions.get(disruption_id)
    if not d:
        raise HTTPException(404, "Disruption not found")
    d.resolved = True
    return {"status": "resolved", "disruption_id": disruption_id}
