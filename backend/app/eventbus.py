"""
Event bus abstraction.

Production target: Apache Kafka (topics: flights.updates, disruptions.detected,
impact.assessed, recovery.plans, decisions.audit).

For this MVP the identical publish/subscribe contract is implemented with an
in-process asyncio.Queue fan-out so the whole system runs with zero external
brokers. Swapping in a real Kafka client means implementing this same
`EventBus` interface with aiokafka producers/consumers and flipping
KAFKA_ENABLED=true in config.py — no call sites elsewhere in the codebase
need to change. This is the standard "hexagonal / ports & adapters" pattern.
"""
from __future__ import annotations
import asyncio
import json
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Coroutine


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._history: dict[str, list[dict]] = defaultdict(list)

    def subscribe(self, topic: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers[topic].append(q)
        return q

    def unsubscribe(self, topic: str, q: asyncio.Queue) -> None:
        if q in self._subscribers[topic]:
            self._subscribers[topic].remove(q)

    async def publish(self, topic: str, payload: dict[str, Any]) -> None:
        envelope = {
            "topic": topic,
            "published_at": datetime.utcnow().isoformat(),
            "payload": payload,
        }
        self._history[topic].append(envelope)
        self._history[topic] = self._history[topic][-500:]
        for q in list(self._subscribers[topic]):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await q.put(envelope)

    def recent(self, topic: str, limit: int = 50) -> list[dict]:
        return self._history[topic][-limit:]


# Process-wide singleton, imported by simulator, agents, and the websocket router.
event_bus = EventBus()

TOPIC_FLIGHT_UPDATES = "flights.updates"
TOPIC_DISRUPTION_DETECTED = "disruptions.detected"
TOPIC_IMPACT_ASSESSED = "impact.assessed"
TOPIC_RECOVERY_PLANS = "recovery.plans"
TOPIC_DECISIONS_AUDIT = "decisions.audit"
