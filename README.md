# AirportOS — AI Disruption Recovery Copilot

Enterprise MVP that helps an Airport Operations Control Center (AOCC) go
from **disruption detected → three ranked, explainable recovery plans →
one-click operator approval** in under 60 seconds.

This is deliberately scoped to the disruption-recovery workflow only — it
is **not** a full Airport Management System. There is no baggage system,
no revenue management, no crew rostering UI, etc. Everything here exists
to make the recovery loop real, fast, and demo-able end to end.

![status](https://img.shields.io/badge/status-MVP-2DD9C8) ![tests](https://img.shields.io/badge/backend%20tests-passing-3DDC84)

---

## What it does

1. **Simulates** a live airport: 500 flights, 90 gates, crew, and status
   transitions, ticking in real time.
2. **Injects disruptions** at random (weather, gate conflicts, crew
   shortages, technical/AOG, ATC holds, ground handling delays, late
   inbound aircraft) — or an operator triggers one on demand.
3. **Detects** every disruption the moment it occurs and pushes it onto
   the event bus.
4. Runs an **AI Impact Engine** that scores gate conflicts, passenger
   impact, crew impact, ground handling delay, and turnaround delay —
   fully explainable, every number traceable to a rule.
5. Runs a **Recovery Planner Agent** that generates **three ranked
   plans** per disruption, each with a confidence score, estimated time
   saved, operational cost, risk level, step-by-step actions with owners
   and ETAs, reasoning, and tradeoffs.
6. Presents plans to the operator for **one-click approval**, and logs
   every decision to a durable audit trail for later analysis.

## Architecture at a glance

```
┌─────────────┐      ┌──────────────────────────────────────────┐      ┌─────────────┐
│   React UI  │◄────►│                FastAPI                    │◄────►│  PostgreSQL │
│ (Vite + TS) │  WS  │  Simulator → Event Bus → Agent Pipeline    │      │ (audit log) │
└─────────────┘      │  Flight │ Impact │ Recovery │ Copilot      │      └─────────────┘
                      │  Agent  │ Agent  │ Agent    │ Agent        │
                      └──────────────────────────────────────────┘
```

- **Simulator**: in-memory "live AODB" generating and advancing 500+
  flights, 90 gates, and crew records; injects disruptions on a random
  cadence (`app/simulator.py`).
- **Event Bus**: publish/subscribe abstraction (`app/eventbus.py`). The
  production target is **Kafka**; the MVP implements the identical
  interface over `asyncio.Queue` so the whole system runs with zero
  external brokers. Swapping in `aiokafka` behind the same interface is
  the only change needed to go to Kafka — see `docs/ARCHITECTURE.md`.
- **Agent pipeline** (`app/orchestrator.py`): Flight Agent → Impact
  Analysis Agent → Recovery Planner Agent, implemented as a **LangGraph**
  `StateGraph` when the package is available, with an automatic
  sequential fallback otherwise. AOCC Copilot Agent runs independently
  behind `/api/chat`.
- **LLM adapter** (`app/agents/llm_adapter.py`): pluggable. If
  `OPENAI_API_KEY` is set, narrative text and chat replies are generated
  by the configured model (`OPENAI_MODEL`, default `gpt-5`). If not set,
  every agent falls back to a deterministic, fully-explainable heuristic
  engine — **the underlying scoring/ranking logic is never an LLM call**,
  only the natural-language narration is, so the product is 100% demoable
  offline and every recommendation is reproducible and auditable.
- **WebSocket bridge**: every event-bus topic is fanned out to connected
  browsers over `/ws/live`, so the dashboard, timeline, and alerts pages
  update in real time with no polling required (REST endpoints exist too,
  and are used for on-demand fetches).
- **PostgreSQL**: durable audit trail only — `disruption_logs`,
  `recovery_plan_logs`, `decision_logs`. Live operational state (flights,
  gates, crew) is intentionally kept in-memory for sub-second access; see
  `backend/schema.sql` and `docs/ARCHITECTURE.md` for the production
  AODB-backed design.

## Demo credentials

Seeded automatically on first backend startup:

| Username     | Password        | Role       |
|--------------|-----------------|------------|
| `operator`   | `operator123`   | Operator   |
| `supervisor` | `supervisor123` | Supervisor |
| `admin`      | `admin123`      | Admin      |

## Quickstart (Docker Compose)

```bash
git clone <this-repo> && cd airportos
cp .env.example .env        # optional: add OPENAI_API_KEY to enable live LLM narration
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend API docs (Swagger): http://localhost:8000/docs
- Backend health: http://localhost:8000/api/health

Log in with the `operator` demo account, then click **Simulate
Disruption** on the dashboard (or wait — one fires automatically every
few ticks) to watch the full detect → assess → plan → approve loop run
live.

## Local development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Postgres must be reachable at DATABASE_URL (see app/config.py), or point
# DATABASE_URL at a local sqlite+aiosqlite:///./dev.db for quick iteration.
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # proxies /api and /ws to http://localhost:8000 (see vite.config.ts)
```

## Tests

```bash
cd backend
pytest -q
```

9 tests covering the simulator, the impact/recovery agents (bounded
scores, exactly 3 ranked plans, non-empty reasoning/actions), and the
full API flow (login → simulate → approve). All passing as of this
commit.

## Repository layout

```
backend/
  app/
    agents/            # Flight, Impact, Recovery, Copilot agents + LLM adapter
    routers/            # auth, flights, disruptions, recovery, chat, analytics, ws
    simulator.py         # airport simulator / demo data generator
    orchestrator.py       # LangGraph pipeline (Impact -> Recovery)
    eventbus.py            # Kafka-shaped pub/sub, in-process implementation
    database.py, schemas.py, config.py, auth.py, main.py
  tests/
  schema.sql             # reference PostgreSQL schema
  Dockerfile
frontend/
  src/
    pages/               # Login, Dashboard, DisruptionCenter, RecoveryPlanner,
                          # Copilot, Timeline, Alerts, Analytics
    components/           # Layout, ConfidenceRing, Badge, StatCard/Panel
    api/, hooks/, store/, types/
  Dockerfile, nginx.conf
k8s/                      # namespace, configmap/secrets, postgres, redis,
                          # backend (+HPA), frontend, ingress
.github/workflows/ci.yml  # test -> build -> (documented) publish/deploy
docs/
  ARCHITECTURE.md
  API.md
  DEPLOYMENT.md
docker-compose.yml
```

## Design

Dark "AOCC console" theme: near-black graphite base (`#0A0E14`), a signal
cyan accent (`#2DD9C8`) for AI/recovery elements, amber/red for
warning/critical severity. Space Grotesk for headings, Inter for body
text, IBM Plex Mono for flight numbers, timestamps, and data-dense
readouts — the console should read like real operations-room
instrumentation, not a generic SaaS dashboard. The signature element is
the **confidence ring**: a circular gauge on every recovery plan card
that lets an operator read AI confidence at a glance, the way they'd read
any other instrument in the room.

## What's scoped out of this MVP (by design)

- Kafka, and a managed Redis-backed cache layer, are wired as
  **documented, swappable interfaces** rather than running services in
  this MVP — see `docs/ARCHITECTURE.md` for the exact upgrade path.
- GPT-5/OpenAI integration is fully wired but optional — the product is
  built to be genuinely useful and fully explainable without it.
- No production auth provider (SSO/SAML), no multi-airport tenancy, no
  mobile app — all reasonable Phase 2 scope, intentionally excluded here
  to keep the recovery workflow the star of the demo.
