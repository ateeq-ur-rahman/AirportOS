"""
Multi-agent orchestration pipeline: Flight Agent -> Impact Analysis Agent
-> Recovery Planner Agent, triggered on every detected disruption.

Implemented as a LangGraph StateGraph when the `langgraph` package is
importable (production path). If it is not installed/importable in a given
environment, an equivalent sequential async pipeline is used instead —
same node functions, same state shape — so behavior is identical either
way and the service never fails to start over an optional dependency.
"""
from __future__ import annotations
import time
from typing import TypedDict, Optional
from app.schemas import Disruption, ImpactAssessment, RecoveryPlan
from app.agents.impact_agent import impact_agent
from app.agents.recovery_agent import recovery_agent
from app.eventbus import event_bus, TOPIC_IMPACT_ASSESSED, TOPIC_RECOVERY_PLANS
from app import pipeline_store


class PipelineState(TypedDict, total=False):
    disruption: Disruption
    impact: Optional[ImpactAssessment]
    plans: Optional[list[RecoveryPlan]]


async def _node_assess_impact(s: PipelineState) -> PipelineState:
    s["impact"] = await impact_agent.assess(s["disruption"])
    return s


async def _node_generate_plans(s: PipelineState) -> PipelineState:
    s["plans"] = await recovery_agent.generate_plans(s["disruption"], s["impact"])
    return s


def _build_langgraph_pipeline():
    from langgraph.graph import StateGraph, END
    graph = StateGraph(PipelineState)
    graph.add_node("assess_impact", _node_assess_impact)
    graph.add_node("generate_plans", _node_generate_plans)
    graph.set_entry_point("assess_impact")
    graph.add_edge("assess_impact", "generate_plans")
    graph.add_edge("generate_plans", END)
    return graph.compile()


try:
    _compiled_graph = _build_langgraph_pipeline()
    _USING_LANGGRAPH = True
except Exception:
    _compiled_graph = None
    _USING_LANGGRAPH = False


async def run_recovery_pipeline(disruption: Disruption) -> tuple[ImpactAssessment, list[RecoveryPlan]]:
    started = time.perf_counter()
    if _compiled_graph is not None:
        result: PipelineState = await _compiled_graph.ainvoke({"disruption": disruption})
    else:
        result = await _node_generate_plans(await _node_assess_impact({"disruption": disruption}))
    pipeline_store.pipeline_durations[disruption.id] = round(time.perf_counter() - started, 2)

    impact = result["impact"]
    plans = result["plans"]

    await event_bus.publish(TOPIC_IMPACT_ASSESSED, impact.model_dump())
    await event_bus.publish(TOPIC_RECOVERY_PLANS, {
        "disruption_id": disruption.id,
        "plans": [p.model_dump() for p in plans],
    })
    return impact, plans


def orchestration_backend() -> str:
    return "langgraph" if _USING_LANGGRAPH else "sequential-fallback"
