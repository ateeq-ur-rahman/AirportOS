"""
AOCC Copilot Agent — conversational interface over live operational state,
the most recent disruption, and its generated recovery plans. Uses the LLM
adapter when configured; otherwise answers with a retrieval-style heuristic
responder so the Copilot page is always functional in demos.

Deliberately scoped: the suggested prompts this agent supports are limited
to what it can answer from real data (live snapshot, the current
disruption's impact assessment, and its 3 generated plans). It does not
attempt predictive ("what disruption happens next") or hypothetical
("what if delay increases by X minutes") reasoning, since neither is backed
by real predictive/simulation logic — a plausible-sounding guess here would
be worse than not offering the prompt at all.
"""
from __future__ import annotations
from app.simulator import state
from app.agents.flight_agent import flight_agent
from app.agents.llm_adapter import complete
from app import pipeline_store


SYSTEM_PROMPT = (
    "You are the AirportOS AOCC Copilot: a concise, operational co-pilot for "
    "airport operations controllers. Answer using only the operational context "
    "provided — never invent numbers not given to you. Prefer short, actionable "
    "answers with concrete numbers. If asked to compare plans or explain a "
    "recommendation, use the plan data provided verbatim."
)


class CopilotAgent:
    async def answer(self, message: str, disruption_id: str | None = None) -> str:
        snapshot = flight_agent.get_snapshot()
        context_lines = [
            f"Live snapshot: {snapshot['total_flights']} flights, {snapshot['active_flights']} active, "
            f"{snapshot['delayed_flights']} delayed (avg {snapshot['avg_delay_minutes']} min), "
            f"{snapshot['open_disruptions']} open disruptions.",
        ]
        target = None
        if disruption_id and disruption_id in state.disruptions:
            target = state.disruptions[disruption_id]
        elif state.disruptions:
            target = list(state.disruptions.values())[-1]

        impact = pipeline_store.impacts.get(target.id) if target else None
        plans = pipeline_store.plans.get(target.id, []) if target else []

        if target:
            context_lines.append(
                f"Most relevant disruption: {target.title} ({target.severity.value}), "
                f"affecting {len(target.affected_flight_ids)} flight(s): {', '.join(target.affected_flight_ids[:8])}."
            )
        if impact:
            context_lines.append(
                f"Impact: {impact.passengers_affected} passengers affected, {impact.gate_conflicts} gate conflicts, "
                f"{impact.crew_at_risk} crew at risk, severity score {impact.severity_score}/100."
            )
        if plans:
            for p in plans:
                context_lines.append(
                    f"Plan (rank {p.rank}) '{p.title}': confidence {p.confidence_score}, "
                    f"saves {p.estimated_time_saved_minutes} min, risk {p.risk_level.value}. "
                    f"Why: {'; '.join(p.highlights) if p.highlights else '; '.join(p.reasoning)}."
                )

        llm_reply = await complete(SYSTEM_PROMPT, "\n".join(context_lines) + f"\n\nOperator question: {message}")
        if llm_reply:
            return llm_reply
        return self._heuristic_answer(message, snapshot, target, impact, plans)

    @staticmethod
    def _heuristic_answer(message: str, snapshot: dict, disruption, impact, plans: list) -> str:
        m = message.lower()

        if any(k in m for k in ["status", "how many", "overview", "summary"]):
            return (f"Live status: {snapshot['total_flights']} flights tracked, {snapshot['active_flights']} active, "
                    f"{snapshot['delayed_flights']} currently delayed (avg {snapshot['avg_delay_minutes']} min), "
                    f"{snapshot['open_disruptions']} open disruption(s).")

        if plans and any(k in m for k in ["compare", "vs", "versus", "difference between"]):
            lines = [f"{p.title} (rank {p.rank}): {p.confidence_score}% confidence, "
                     f"{p.estimated_time_saved_minutes}min saved, {p.risk_level.value} risk"
                     for p in plans]
            return "Comparing the 3 generated plans:\n" + "\n".join(lines)

        if plans and any(k in m for k in ["confidence", "explain the score", "how confident"]):
            top = plans[0]
            return (f"The top-ranked plan ('{top.title}') has {top.confidence_score}% confidence. That figure "
                    f"reflects how reliable this type of recovery action is given what's true right now "
                    f"(e.g. whether a gate conflict is actually present, whether crew are within duty limits) — "
                    f"it's a rule-based score, not a black box. Separately, plans are RANKED #1/#2/#3 by a "
                    f"weighted formula that combines confidence with time saved, cost, and risk together. "
                    f"This plan's rank-1 position reflects: {'; '.join(top.highlights) if top.highlights else 'see plan reasoning in the Recovery Planner.'}")

        if plans and any(k in m for k in ["why is", "why plan", "recommend", "best plan", "top plan"]):
            top = plans[0]
            return (f"'{top.title}' is ranked #1 because: {'; '.join(top.highlights) if top.highlights else '; '.join(top.reasoning)}.")

        if impact and any(k in m for k in ["passenger impact", "passengers", "pax"]):
            return (f"{impact.passengers_affected} passengers affected, ~{impact.missed_connections_estimate} at risk "
                    f"of missed connections, {impact.crew_at_risk} crew member(s) near duty-time limits.")

        if any(k in m for k in ["gate utilization", "gate usage", "gates"]):
            occupied = len({f.gate for f in state.flights.values() if f.status.value not in ("arrived", "cancelled", "diverted")})
            pct = round(occupied / max(1, len(state.gates)) * 100, 1)
            return f"Gate utilization: {occupied} of {len(state.gates)} gates currently occupied ({pct}%)."

        if plans and any(k in m for k in ["recovery report", "generate a report", "summary report"]):
            top = plans[0]
            lines = [
                f"Recovery Report — {disruption.title if disruption else 'N/A'}",
                f"Severity: {disruption.severity.value if disruption else 'N/A'} | Passengers affected: {impact.passengers_affected if impact else 'N/A'}",
                f"Recommended plan: {top.title} (confidence {top.confidence_score}%, saves {top.estimated_time_saved_minutes} min)",
                f"Reasoning: {'; '.join(top.reasoning)}",
            ]
            return "\n".join(lines)

        if disruption and any(k in m for k in ["disrupt", "delay", "what happened"]):
            return (f"Latest disruption: '{disruption.title}' ({disruption.severity.value} severity), "
                    f"affecting {len(disruption.affected_flight_ids)} flight(s). Open the Disruption Center "
                    f"to view the AI-generated impact assessment and ranked recovery plans.")

        return ("I can help with live flight status, disruption details, plan comparisons, and recovery "
                "recommendations. Try: 'Why is the top plan recommended?' or 'Compare the recovery plans.'")


copilot_agent = CopilotAgent()
