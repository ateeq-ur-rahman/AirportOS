# API Reference

Base URL: `http://localhost:8000` (local) — interactive Swagger UI is
always available at **`/docs`** (ReDoc at `/redoc`) since this is a
standard FastAPI app; this document is a curated summary for quick
reference.

All endpoints except `/api/auth/login` and `/api/health` require a JWT
bearer token: `Authorization: Bearer <token>`.

## Auth

### `POST /api/auth/login`
```json
// request
{ "username": "operator", "password": "operator123" }
// response
{ "access_token": "...", "token_type": "bearer", "username": "operator", "full_name": "Asha Rao", "role": "operator" }
```

### `GET /api/auth/me`
Returns the decoded identity of the current token.

## Flights

| Method | Path | Description |
|---|---|---|
| GET | `/api/flights` | List flights. Query params: `status`, `gate`, `delayed_only`, `limit` (default 500, max 2000). |
| GET | `/api/flights/snapshot` | Aggregate live counts (total/active/delayed, avg delay, by-status breakdown, open disruptions). Powers the dashboard header ticker. |
| GET | `/api/flights/gates` | List all gates. |
| GET | `/api/flights/{flight_id}` | Single flight detail. |

## Disruptions

| Method | Path | Description |
|---|---|---|
| GET | `/api/disruptions?open_only=false` | List disruptions, newest first. |
| GET | `/api/disruptions/{id}` | Disruption + its impact assessment + its recovery plans + any logged decision. |
| POST | `/api/disruptions/simulate` | **Manually trigger** a random disruption and synchronously run the full Impact → Recovery pipeline. Used by the "Simulate Disruption" button. Returns `{ disruption, impact, plans }`. |
| POST | `/api/disruptions/{id}/resolve` | Mark a disruption resolved without approving a specific plan. |

## Recovery

| Method | Path | Description |
|---|---|---|
| GET | `/api/recovery/{disruption_id}/plans` | The 3 ranked plans currently on file for a disruption. |
| POST | `/api/recovery/decide` | Operator decision. Body: `{ disruption_id, plan_id, decision: "approved"\|"rejected"\|"overridden", notes?, time_to_decision_seconds? }`. Persists to `decision_logs` + `recovery_plan_logs` + `disruption_logs`, marks the disruption resolved on approval, and publishes to the `decisions.audit` event topic. |

## Chat (AOCC Copilot)

### `POST /api/chat`
```json
// request
{ "message": "What should we do about the latest disruption?", "disruption_id": null }
// response
{ "role": "assistant", "content": "..." }
```

## Analytics

### `GET /api/analytics/overview`
Returns live snapshot, disruption counts by type, decision totals/approval
rate/avg time-to-decision, average plan confidence, and total estimated
minutes saved across approved plans. Powers the Analytics page.

## WebSocket

### `WS /ws/live`
No auth handshake required for the MVP (add a token query param + server
check before production use). Streams every event bus message as:
```json
{ "type": "disruptions.detected", "data": { ... }, "published_at": "2026-07-22T10:15:00Z" }
```
Event `type` values: `flights.updates`, `disruptions.detected`,
`impact.assessed`, `recovery.plans`, `decisions.audit`.

## Error format

Standard FastAPI/Starlette error body:
```json
{ "detail": "human-readable message" }
```
`401` on missing/invalid/expired token, `404` on missing resource, `400`
on invalid simulate requests (e.g. no flights available).
