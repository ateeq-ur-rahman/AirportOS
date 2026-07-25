# Architecture

## Design goal

Everything in this system is organized around one number: **recovery
decisions available to an operator within 60 seconds of a disruption
being detected.** That constrains every architectural choice below.

## Component map

```
Browser (React/TS/Tailwind)
   │ REST (fetch)            │ WebSocket (/ws/live)
   ▼                          ▼
FastAPI app (Uvicorn, ASGI)
   │
   ├── Simulator (asyncio background task, ticks every SIMULATOR_TICK_SECONDS)
   │      generates flights/gates/crew, advances flight status,
   │      injects disruptions at random intervals
   │
   ├── EventBus (pub/sub; Kafka-shaped interface, in-process impl)
   │      topics: flights.updates, disruptions.detected,
   │              impact.assessed, recovery.plans, decisions.audit
   │
   ├── Orchestrator (LangGraph StateGraph, sequential fallback)
   │      Flight Agent (snapshot/conflict detection)
   │        → Impact Analysis Agent (heuristic scoring + optional LLM narrative)
   │        → Recovery Planner Agent (3 scored/ranked plans)
   │
   ├── Copilot Agent (independent; retrieval-style heuristic or LLM)
   │
   ├── WebSocket bridge (fans every EventBus topic out to browsers)
   │
   └── REST routers (auth, flights, disruptions, recovery, chat, analytics)
            │
            ▼
       PostgreSQL (durable audit trail only)
```

## Why in-memory live state + Postgres audit trail (not everything in Postgres)

500+ flights need to be read/updated on every tick and on every API call
with sub-second latency to keep the end-to-end "detect → 3 plans ready"
loop under budget. A relational round-trip per flight update at that
volume is unnecessary overhead for state that is, definitionally,
ephemeral (today's flight schedule). Instead:

- **Live state** (flights, gates, crew, open disruptions) lives in
  `app.simulator.SimulatorState`, a single in-process object, giving O(1)
  dict access.
- **Durable state** — the decision audit trail (`decision_logs`), the
  historical record of what disruptions occurred (`disruption_logs`), and
  the plans that were generated for them (`recovery_plan_logs`) — is
  written to PostgreSQL, because this is exactly the data a real airport
  would need to survive a restart, feed BI tooling, and eventually train
  or fine-tune models on operator behavior.

### Production upgrade path

Swap the in-memory `SimulatorState` for a real AODB (Airport Operational
Database) integration: flights/gates/crew become first-class Postgres
tables (or a dedicated low-latency store, e.g. a Redis-backed cache in
front of Postgres) fed by CDC (change data capture) from the airline's
AODB, weather feed, and ATC feed. The `FlightAgent` interface
(`get_snapshot`, `detect_gate_conflicts`, `flights_for`) does not need to
change — only what's behind it does. This is the standard ports &
adapters pattern used throughout this codebase.

## Event bus: why asyncio.Queue now, Kafka later

`app/eventbus.py` defines the same `publish(topic, payload)` /
`subscribe(topic) -> Queue` contract Kafka would provide, backed by
`asyncio.Queue` fan-out instead of a broker. This means:

- The **whole system runs with zero external infrastructure** beyond
  Postgres, which is exactly what you want for a fast investor/executive
  demo and for CI.
- The migration to Kafka is isolated to one file: implement `EventBus`
  with `aiokafka` producers/consumers against the same five named topics
  (`flights.updates`, `disruptions.detected`, `impact.assessed`,
  `recovery.plans`, `decisions.audit`), flip `KAFKA_ENABLED=true` in
  `app/config.py`, and no other module needs to change — every publisher
  and subscriber in the codebase already talks to `event_bus`, not to
  the transport.
- At real airport scale, Kafka additionally buys you: multiple AOCC
  instances/regions consuming the same disruption stream, replay for
  incident post-mortems, and integration points for downstream systems
  (crew scheduling, passenger notification, BI) without coupling them to
  this FastAPI process.

## AI agent design

### Flight Agent
Maintains the query-friendly view over live state and does structural
detection (gate double-booking) independent of the randomly-injected
disruption types. In production this subscribes to AODB/ACARS/ATC feeds
directly.

### Impact Analysis Agent ("AI Impact Engine")
Computes gate conflicts, passenger impact, crew impact, ground handling
delay, turnaround delay, and a 0–100 severity score via a **transparent
weighted heuristic** (see `SEVERITY_WEIGHTS` in `impact_agent.py`).
Every number an operator sees is traceable to a specific rule. When an
LLM is configured, it is used *only* to phrase the narrative paragraph
from already-computed numbers — it cannot alter or invent the metrics.
This is a deliberate explainability choice: an AOCC operator approving a
gate reassignment in an executive demo needs to be able to say *why* a
number is what it is, not "the model said so."

### Recovery Planner Agent
Generates three fixed strategy archetypes per disruption —
**Rebalance** (gate/sequence optimization), **Absorb & Prioritize**
(protect missed connections + crew coverage), and **Cancel &
Consolidate** (reclaim schedule integrity at higher passenger cost) —
each populated from the actual impact numbers, then ranked by a
transparent scoring formula (`_score()` in `recovery_agent.py`) that
trades off confidence, time saved, cost, and risk. This guarantees
operators consistently see three *genuinely different* strategies rather
than three minor variations of the same idea, while remaining fully
explainable end to end.

### AOCC Copilot Agent
A conversational layer over the same live snapshot + latest
disruption/plan context, with an LLM-backed responder when configured
and a retrieval-style heuristic fallback otherwise, so the Copilot page
is always functional in a demo environment with no API key configured.

### Orchestration (LangGraph)
`app/orchestrator.py` wires Impact → Recovery as a `langgraph.StateGraph`
when the package is importable. If it isn't (e.g. a constrained
environment), the identical node functions run sequentially instead —
same state shape, same output — so the service degrades gracefully
rather than failing to start over an optional dependency.

## Security

- JWT bearer auth (`app/auth.py`), bcrypt-hashed passwords, three seeded
  demo roles (operator/supervisor/admin).
- `SECRET_KEY` must be overridden via environment/secret in any real
  deployment — the default in `config.py` is explicitly a placeholder.
- CORS is wide-open (`*`) for demo convenience; restrict
  `CORS_ORIGINS` in production.

## Observability

- Structured (JSON-ish) logging configured in `app/main.py`.
- `/api/health` liveness/readiness endpoint used by both the Docker
  Compose healthcheck and the Kubernetes probes.
- Every pipeline run logs disruption id, plan count, and top plan
  confidence, so operational health is visible in log aggregation
  without extra instrumentation.
