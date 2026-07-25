"""
Pluggable LLM adapter.

If OPENAI_API_KEY is configured, reasoning steps in ImpactAgent /
RecoveryPlannerAgent / CopilotAgent call out to the configured chat model
(OPENAI_MODEL, default "gpt-5" per deployment config) for natural-language
narrative and free-form Q&A.

If no key is configured (the default for local/demo runs), every agent
falls back to a deterministic, fully-explainable heuristic engine defined
alongside it. This keeps the product 100% demoable offline, keeps outputs
reproducible for testing, and means the *decision logic* (what plans get
proposed, how confidence/cost/risk are scored) is never a black box —
the LLM, when enabled, is used to narrate and converse, not to invent the
underlying operational math.
"""
from __future__ import annotations
from app.config import settings

_client = None
if settings.OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception:
        _client = None


def llm_available() -> bool:
    return _client is not None


async def complete(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str | None:
    """Returns None if no LLM is configured — callers must have a
    heuristic fallback ready."""
    if _client is None:
        return None
    try:
        resp = await _client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.4,
        )
        return resp.choices[0].message.content
    except Exception:
        return None
