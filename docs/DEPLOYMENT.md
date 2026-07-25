# Deployment Guide

## 1. Local demo (recommended for exec/investor demos)

```bash
cp .env.example .env    # optionally set OPENAI_API_KEY / OPENAI_MODEL
docker compose up --build
```

Services and ports:
- `postgres` — 5432 (internal + host-mapped for inspection)
- `redis` — 6379 (reserved for future caching; not on the hot path yet)
- `backend` (FastAPI) — 8000, docs at `/docs`
- `frontend` (nginx serving the Vite build, proxying `/api` and `/ws` to
  `backend`) — 8080

First boot takes a few seconds while the simulator bootstraps 500
flights and 90 gates and the demo users are seeded — watch `docker
compose logs -f backend` for `"Simulator bootstrapped: 500 flights, 90
gates"`.

## 2. Kubernetes

Manifests live in `k8s/`, applied in order:

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secrets.yaml      # replace placeholder values first
kubectl apply -f k8s/03-postgres.yaml
kubectl apply -f k8s/04-redis.yaml
kubectl apply -f k8s/05-backend.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-ingress.yaml
```

Before applying, push built images to your registry and update the
`image:` fields in `05-backend.yaml` / `06-frontend.yaml`
(`ghcr.io/your-org/airportos-backend:<tag>` and
`.../airportos-frontend:<tag>`), and update `07-ingress.yaml`'s host.

```bash
docker build -t ghcr.io/your-org/airportos-backend:<tag> ./backend
docker build -t ghcr.io/your-org/airportos-frontend:<tag> ./frontend
docker push ghcr.io/your-org/airportos-backend:<tag>
docker push ghcr.io/your-org/airportos-frontend:<tag>
```

Notes:
- `05-backend.yaml` runs 3 replicas behind an HPA (65% CPU target, 3–10
  pods) — safe because all live state lives per-request in Postgres or
  the in-process simulator; **note the current MVP simulator is
  single-process, in-memory state**, so horizontally scaling the backend
  in this exact form would give each pod its own independent simulated
  airport. For a real multi-pod deployment, move live flight state
  behind the AODB/Redis-backed store described in
  `docs/ARCHITECTURE.md` before scaling beyond 1 replica, or run the
  simulator as a single dedicated writer process publishing to Kafka
  with API pods as stateless consumers.
- Postgres is deployed as a single-replica `StatefulSet` for the demo;
  use a managed Postgres (RDS/Cloud SQL/Azure Database) in production.
- Secrets in `02-secrets.yaml` are placeholders — use `kubectl create
  secret` imperatively, or a secrets manager (Sealed Secrets, External
  Secrets Operator, Vault), never commit real values.

## 3. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
1. **backend-test** — installs requirements, runs `pytest` against a
   throwaway SQLite database.
2. **frontend-build** — `npm install`, `tsc -b`, `npm run build`.
3. **docker-build** — builds both images (not pushed) to catch
   Dockerfile regressions.

A commented-out `publish` job template shows the next step: log in to a
registry, push tagged images, and `kubectl set image` to roll the
deployment. Wire in registry + cluster credentials as repository secrets
before enabling it.

## 4. Environment variables

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | placeholder | **Must** be overridden in any non-local deployment |
| `DATABASE_URL` | `postgresql+asyncpg://airportos:airportos@postgres:5432/airportos` | |
| `REDIS_URL` | `redis://redis:6379/0` | Reserved for future use |
| `SIMULATOR_FLIGHT_COUNT` | `500` | |
| `SIMULATOR_GATE_COUNT` | `90` | |
| `SIMULATOR_TICK_SECONDS` | `2.0` | |
| `OPENAI_API_KEY` | unset | Leave unset to run fully on the heuristic reasoning engine |
| `OPENAI_MODEL` | `gpt-5` | |
| `KAFKA_ENABLED` | `false` | See `docs/ARCHITECTURE.md` for the Kafka upgrade path |
| `CORS_ORIGINS` | `["*"]` | Restrict in production |

## 5. Demo script (suggested)

1. Log in as `operator`.
2. Open **Dashboard** — point out the live flight count, gate count, and
   the connected live-feed indicator.
3. Click **Simulate Disruption**.
4. Switch to **AI Disruption Center** — show the AI Impact Assessment
   populate (passengers affected, gate conflicts, crew at risk,
   severity score + narrative).
5. Switch to **Recovery Planner** — show all three ranked plans, expand
   "reasoning & actions" on the top plan, click **Approve**.
6. Switch to **Timeline** — show the same event (detected → assessed →
   planned → decided) as a live audit trail.
7. Switch to **Analytics** — show approval rate, average confidence, and
   total minutes saved accumulating across the session.
