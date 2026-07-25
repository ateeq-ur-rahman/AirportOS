import pytest
from app.simulator import SimulatorState, generate_disruption
from app.agents.impact_agent import impact_agent
from app.agents.recovery_agent import recovery_agent
import app.simulator as sim_module
import app.agents.flight_agent as fa_module
import app.agents.impact_agent as ia_module


@pytest.fixture
def seeded_state(monkeypatch):
    """Builds an isolated SimulatorState and patches it into every module
    that references the singleton, using pytest's monkeypatch so the
    original module globals are restored automatically after the test —
    preventing cross-test pollution of the process-wide simulator state."""
    s = SimulatorState()
    s.bootstrap(flight_count=80, gate_count=12)
    monkeypatch.setattr(sim_module, "state", s)
    monkeypatch.setattr(fa_module, "state", s)
    monkeypatch.setattr(ia_module, "state", s)
    return s


@pytest.mark.asyncio
async def test_impact_assessment_produces_bounded_severity(seeded_state):
    d = await generate_disruption()
    assert d is not None
    impact = await impact_agent.assess(d)
    assert 0 <= impact.severity_score <= 100
    assert impact.passengers_affected >= 0
    assert impact.narrative


@pytest.mark.asyncio
async def test_recovery_agent_returns_three_ranked_plans(seeded_state):
    d = await generate_disruption()
    impact = await impact_agent.assess(d)
    plans = await recovery_agent.generate_plans(d, impact)
    assert len(plans) == 3
    ranks = sorted(p.rank for p in plans)
    assert ranks == [1, 2, 3]
    for p in plans:
        assert 0 <= p.confidence_score <= 100
        assert p.estimated_time_saved_minutes >= 0
        assert len(p.actions) >= 1
        assert len(p.reasoning) >= 1
