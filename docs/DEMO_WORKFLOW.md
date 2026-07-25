# Demo Workflow

This walks through the same flow as `docs/DEPLOYMENT.md` §5, with what
you'll see on screen at each step. Run `docker compose up --build`, open
http://localhost:8080, and follow along — actual screenshots aren't
included in this repo (no rendering environment was available while
generating it), but every screen below is fully implemented and running
in the codebase.

## 1. Login
Dark console login screen, radar-sweep logomark, demo account picker for
`operator` / `supervisor` / `admin`. Signs in via `POST /api/auth/login`,
stores a JWT, redirects to the dashboard.

## 2. Live Flight Dashboard (`/`)
Top ticker bar: live flight count, delayed count, open disruptions,
average delay — updates over the WebSocket as the simulator ticks.
Below: 4 stat cards (Total/Active/Delayed/Open Disruptions), a scrollable
flight board (callsign, route, gate, status, delay), a status-breakdown
panel with proportional bars, and a **Simulate Disruption** button that
calls `POST /api/disruptions/simulate` and immediately refreshes.

## 3. AI Disruption Center (`/disruptions`)
Left column: every disruption detected this session, newest first, each
tagged with type + severity. Selecting one shows its detail (affected
flights, description, detection time) and the **AI Impact Assessment**:
6 metric cards (passengers affected, gate conflicts, crew at risk, missed
connections, ground handling delay, turnaround delay), a 0–100 severity
score bar, and a plain-English narrative explaining the numbers.

## 4. Recovery Planner (`/recovery`)
Three cards, one per ranked plan, each showing:
- Rank badge (top plan marked "★ Recommended")
- The signature **confidence ring** (circular gauge, color-coded by
  confidence band)
- Estimated time saved, operational cost, risk level
- Expandable reasoning bullets, a numbered action sequence with owner +
  ETA per step, and tradeoffs
- **Approve** / reject buttons — approving calls `POST
  /api/recovery/decide`, logs the decision (with elapsed
  time-to-decision), and marks the disruption resolved

## 5. AI Copilot (`/copilot`)
Chat interface over live operational context. Try: *"What's the current
operational status?"*, *"What's the latest disruption and its impact?"*,
*"What should we do about it?"* — answered either by the configured LLM
or the built-in heuristic responder if no API key is set.

## 6. Timeline (`/timeline`)
Chronological, color-coded event feed straight off the WebSocket:
disruption detected → impact assessed → recovery plans generated →
operator decision logged, interleaved with a sampled trickle of routine
flight-state updates so the feed feels alive without being noisy.

## 7. Alerts (`/alerts`)
Three sections: disruptions needing immediate attention (high/critical,
unresolved), other open disruptions, and a resolved history — each with
a direct "Recover" shortcut into the Recovery Planner for that
disruption.

## 8. Analytics (`/analytics`)
KPI cards (avg plan confidence, approval rate, avg time-to-decision,
total minutes saved) plus a disruption-type pie chart and a live
flight-status bar chart, refreshing every 8 seconds from
`GET /api/analytics/overview`.

---

**Capturing real screenshots:** run the stack locally as above and use
your OS/browser screenshot tool on each route — no special setup is
needed since every page is a normal client-rendered React route.
