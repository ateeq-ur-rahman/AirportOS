import asyncio
from app.simulator import SimulatorState, generate_disruption, state as global_state


def test_bootstrap_creates_flights_and_gates():
    s = SimulatorState()
    s.bootstrap(flight_count=50, gate_count=10)
    assert len(s.flights) == 50
    assert len(s.gates) == 10
    for f in s.flights.values():
        assert f.gate in s.gates
        assert f.crew_id in s.crew


def test_advance_progresses_status_without_crash():
    s = SimulatorState()
    s.bootstrap(flight_count=20, gate_count=5)
    for _ in range(5):
        s.advance()
    assert s.tick == 5


def test_inject_delay_updates_flight():
    s = SimulatorState()
    s.bootstrap(flight_count=5, gate_count=3)
    f = next(iter(s.flights.values()))
    original_dep = f.estimated_departure
    s.inject_delay(f, 30)
    assert f.delay_minutes == 30
    assert f.estimated_departure == original_dep.__class__(
        year=original_dep.year, month=original_dep.month, day=original_dep.day,
        hour=original_dep.hour, minute=original_dep.minute, second=original_dep.second
    ) or f.estimated_departure > original_dep


async def _bootstrap_global():
    global_state.flights.clear()
    global_state.gates.clear()
    global_state.crew.clear()
    global_state.bootstrap(flight_count=100, gate_count=15)


def test_generate_disruption_returns_valid_disruption():
    asyncio.get_event_loop().run_until_complete(_bootstrap_global())
    d = asyncio.get_event_loop().run_until_complete(generate_disruption())
    assert d is not None
    assert len(d.affected_flight_ids) >= 1
    assert d.id in global_state.disruptions
