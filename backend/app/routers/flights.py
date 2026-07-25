from fastapi import APIRouter, Depends, Query
from app.simulator import state
from app.agents.flight_agent import flight_agent
from app.auth import get_current_user

router = APIRouter(prefix="/api/flights", tags=["flights"])


@router.get("")
async def list_flights(
    status: str | None = None,
    gate: str | None = None,
    delayed_only: bool = False,
    limit: int = Query(500, le=2000),
    user: dict = Depends(get_current_user),
):
    flights = list(state.flights.values())
    if status:
        flights = [f for f in flights if f.status.value == status]
    if gate:
        flights = [f for f in flights if f.gate == gate]
    if delayed_only:
        flights = [f for f in flights if f.delay_minutes > 0]
    flights.sort(key=lambda f: f.scheduled_departure)
    return {"count": len(flights), "flights": flights[:limit]}


@router.get("/snapshot")
async def snapshot(user: dict = Depends(get_current_user)):
    return flight_agent.get_snapshot()


@router.get("/gates")
async def list_gates(user: dict = Depends(get_current_user)):
    return {"count": len(state.gates), "gates": list(state.gates.values())}


@router.get("/{flight_id}")
async def get_flight(flight_id: str, user: dict = Depends(get_current_user)):
    return state.flights.get(flight_id)
