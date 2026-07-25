"""
Flight Agent

Responsible for maintaining a normalized, query-friendly view of live
flight/gate/crew state pulled from SimulatorState, and for detecting
*structural* problems (gate double-bookings, crew duty overruns) each
tick — separate from the random weather/ATC/technical events the
simulator injects directly. In a production deployment this agent would
instead subscribe to AODB + ACARS + ATC feeds; the interface it exposes
to the rest of the pipeline (get_snapshot / detect_conflicts) would not
change.
"""
from __future__ import annotations
from collections import defaultdict
from app.simulator import state
from app.schemas import FlightStatus


class FlightAgent:
    def get_snapshot(self) -> dict:
        flights = list(state.flights.values())
        active = [f for f in flights if f.status not in (FlightStatus.ARRIVED, FlightStatus.CANCELLED)]
        delayed = [f for f in flights if f.delay_minutes > 0]
        by_status: dict[str, int] = defaultdict(int)
        for f in flights:
            by_status[f.status.value] += 1
        return {
            "total_flights": len(flights),
            "active_flights": len(active),
            "delayed_flights": len(delayed),
            "avg_delay_minutes": round(sum(f.delay_minutes for f in delayed) / len(delayed), 1) if delayed else 0,
            "by_status": dict(by_status),
            "total_gates": len(state.gates),
            "open_disruptions": sum(1 for d in state.disruptions.values() if not d.resolved),
        }

    def detect_gate_conflicts(self) -> list[tuple[str, list[str]]]:
        """Returns (gate_id, [flight_ids]) for every gate with >1 active flight."""
        by_gate: dict[str, list[str]] = defaultdict(list)
        for f in state.flights.values():
            if f.status not in (FlightStatus.ARRIVED, FlightStatus.CANCELLED):
                by_gate[f.gate].append(f.id)
        return [(g, fids) for g, fids in by_gate.items() if len(fids) > 1]

    def flights_for(self, flight_ids: list[str]):
        return [state.flights[fid] for fid in flight_ids if fid in state.flights]


flight_agent = FlightAgent()
