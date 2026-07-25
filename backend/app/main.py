"""
AirportOS backend entrypoint.

Wires together: DB init + demo user seeding, the airport simulator
background loop, the event-bus -> WebSocket bridge, the auto-triggered
disruption -> impact -> recovery-plan pipeline, and all REST routers.
"""
from __future__ import annotations
import asyncio
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import init_db, AsyncSessionLocal, User
from app.auth import hash_password
from app.simulator import state, simulation_loop
from app.eventbus import event_bus, TOPIC_DISRUPTION_DETECTED, TOPIC_FLIGHT_UPDATES, TOPIC_IMPACT_ASSESSED, TOPIC_RECOVERY_PLANS, TOPIC_DECISIONS_AUDIT
from app.websocket_manager import manager
from app.orchestrator import run_recovery_pipeline
from app import pipeline_store

from app.routers import auth, flights, disruptions, recovery, chat, analytics, ws

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":%(message)r}',
    stream=sys.stdout,
)
logger = logging.getLogger("airportos")

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(flights.router)
app.include_router(disruptions.router)
app.include_router(recovery.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(ws.router)


DEMO_USERS = [
    {"username": "operator", "password": "operator123", "full_name": "Asha Rao", "role": "operator"},
    {"username": "supervisor", "password": "supervisor123", "full_name": "Vikram Nair", "role": "supervisor"},
    {"username": "admin", "password": "admin123", "full_name": "System Admin", "role": "admin"},
]


async def seed_demo_users():
    async with AsyncSessionLocal() as session:
        for u in DEMO_USERS:
            existing = (await session.execute(select(User).where(User.username == u["username"]))).scalar_one_or_none()
            if not existing:
                session.add(User(username=u["username"], hashed_password=hash_password(u["password"]),
                                  full_name=u["full_name"], role=u["role"]))
        await session.commit()


async def eventbus_to_websocket_bridge():
    """Fans every relevant event-bus topic out to connected WebSocket clients."""
    topics = [TOPIC_FLIGHT_UPDATES, TOPIC_DISRUPTION_DETECTED, TOPIC_IMPACT_ASSESSED, TOPIC_RECOVERY_PLANS, TOPIC_DECISIONS_AUDIT]
    queues = {t: event_bus.subscribe(t) for t in topics}

    async def pump(topic: str, q: asyncio.Queue):
        while True:
            envelope = await q.get()
            await manager.broadcast({"type": topic, "data": envelope["payload"], "published_at": envelope["published_at"]})

    await asyncio.gather(*[pump(t, q) for t, q in queues.items()])


async def auto_pipeline_trigger():
    """Every time a disruption is detected, automatically run the
    Impact -> Recovery pipeline so the Disruption Center / Recovery Planner
    have plans ready the moment an operator opens them (the product's core
    '<60 second recovery' promise)."""
    q = event_bus.subscribe(TOPIC_DISRUPTION_DETECTED)
    while True:
        envelope = await q.get()
        disruption_id = envelope["payload"]["id"]
        disruption = state.disruptions.get(disruption_id)
        if not disruption:
            continue
        try:
            impact, plans = await run_recovery_pipeline(disruption)
            pipeline_store.impacts[disruption_id] = impact
            pipeline_store.plans[disruption_id] = plans
            logger.info(f'"pipeline complete for {disruption_id}: {len(plans)} plans, top confidence {plans[0].confidence_score}"')
        except Exception as e:
            logger.exception(f'"pipeline failed for {disruption_id}: {e}"')


@app.on_event("startup")
async def on_startup():
    logger.info('"AirportOS backend starting up"')
    await init_db()
    await seed_demo_users()
    state.bootstrap(settings.SIMULATOR_FLIGHT_COUNT, settings.SIMULATOR_GATE_COUNT)
    logger.info(f'"Simulator bootstrapped: {len(state.flights)} flights, {len(state.gates)} gates"')

    asyncio.create_task(simulation_loop())
    asyncio.create_task(eventbus_to_websocket_bridge())
    asyncio.create_task(auto_pipeline_trigger())


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "flights": len(state.flights), "gates": len(state.gates)}
