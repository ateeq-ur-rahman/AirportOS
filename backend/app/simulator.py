"""
Airport Operations Simulator.

Generates a configurable live airport (default 500 flights / 90 gates),
advances flight state on a tick loop, and randomly injects disruption
events (weather, gate conflicts, crew shortages, technical, ATC holds,
ground handling delays, late inbound aircraft) at a configurable rate.

This is intentionally NOT a physics-accurate simulator — it is a
believable, demo-grade state generator whose *shape* (schema, event
cadence, interdependencies between flights/gates/crew) mirrors what a
real AODB (Airport Operational Database) + weather feed + ATC feed would
produce, so the AI agents downstream operate on realistic structure.
"""
from __future__ import annotations

import asyncio
import random
import string
import uuid
from datetime import datetime, timedelta

from app.config import settings
from app.eventbus import event_bus, TOPIC_FLIGHT_UPDATES, TOPIC_DISRUPTION_DETECTED
from app.schemas import (
    Flight, FlightStatus, Gate, Crew, Disruption, DisruptionType, Severity,
)

AIRLINES = ["IndiGo", "Air India", "Vistara", "SpiceJet", "Emirates", "Qatar Airways",
            "Lufthansa", "British Airways", "Singapore Airlines", "AirAsia"]
AIRCRAFT = ["A320", "A321neo", "A350", "B737-800", "B777-300ER", "B787-9", "ATR72"]
AIRPORTS = ["DEL", "BLR", "BOM", "MAA", "CCU", "DXB", "DOH", "LHR", "FRA", "SIN", "HYD"]
TERMINALS = ["T1", "T2", "T3"]

DISRUPTION_TEMPLATES = {
    DisruptionType.WEATHER: ("Low visibility / crosswind advisory", "Reduced arrival rate issued by ATC due to fog/crosswind on runway {rwy}."),
    DisruptionType.GATE_CONFLICT: ("Gate double-booking", "Two aircraft assigned overlapping occupancy at gate {gate}."),
    DisruptionType.CREW_SHORTAGE: ("Crew duty-time breach risk", "Cockpit crew for {flight} approaching FDP (flight duty period) limit."),
    DisruptionType.TECHNICAL: ("Aircraft technical snag", "AOG (Aircraft On Ground) defect reported on {tail} prior to pushback."),
    DisruptionType.ATC_HOLD: ("ATC ground hold", "En-route ATC flow control hold issued affecting departures to {dest}."),
    DisruptionType.GROUND_HANDLING: ("Ground handling delay", "Baggage/ramp handling delay reported for {flight} at gate {gate}."),
    DisruptionType.LATE_INBOUND: ("Late inbound aircraft", "Inbound aircraft for {flight} running {mins} min late, threatens turnaround."),
}


def _rand_id(prefix: str, n: int = 4) -> str:
    return f"{prefix}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=n))}"


def _flight_number() -> str:
    airline_code = "".join(random.choices(string.ascii_uppercase, k=2))
    return f"{airline_code}{random.randint(100, 9999)}"


class SimulatorState:
    """In-memory operational state — the 'live AODB' for this MVP.

    Read/write is O(1) dict access so the dashboard and agents can query
    hundreds of flights well within the <60s recovery SLA the product
    promises; Postgres holds the durable audit trail (decision + plan logs)
    rather than the fast-changing live state.
    """

    def __init__(self) -> None:
        self.flights: dict[str, Flight] = {}
        self.gates: dict[str, Gate] = {}
        self.crew: dict[str, Crew] = {}
        self.disruptions: dict[str, Disruption] = {}
        self.tick: int = 0
        self._running = False

    # ---------- generation ----------
    def bootstrap(self, flight_count: int, gate_count: int) -> None:
        now = datetime.utcnow()
        terminals = TERMINALS
        for i in range(gate_count):
            gid = f"G{i+1:02d}"
            self.gates[gid] = Gate(
                id=gid,
                terminal=random.choice(terminals),
                compatible_aircraft=random.sample(AIRCRAFT, k=random.randint(3, len(AIRCRAFT))),
            )

        gate_ids = list(self.gates.keys())
        for i in range(flight_count):
            fid = f"F{i+1:05d}"
            is_inbound = random.random() < 0.5
            origin, destination = random.sample(AIRPORTS, 2)
            if is_inbound:
                origin, destination = destination, "HYD"
            sched_dep = now + timedelta(minutes=random.randint(-120, 600))
            block_time = random.randint(60, 540)
            aircraft = random.choice(AIRCRAFT)
            capacity = {"A320": 180, "A321neo": 220, "A350": 320, "B737-800": 189,
                        "B777-300ER": 396, "B787-9": 290, "ATR72": 72}[aircraft]
            flight = Flight(
                id=fid,
                callsign=_flight_number(),
                airline=random.choice(AIRLINES),
                origin=origin,
                destination=destination,
                aircraft_type=aircraft,
                tail_number=_rand_id("VT"),
                status=FlightStatus.SCHEDULED,
                scheduled_departure=sched_dep,
                estimated_departure=sched_dep,
                scheduled_arrival=sched_dep + timedelta(minutes=block_time),
                estimated_arrival=sched_dep + timedelta(minutes=block_time),
                gate=random.choice(gate_ids),
                crew_id=_rand_id("CRW"),
                passenger_count=random.randint(int(capacity * 0.4), capacity),
                passenger_capacity=capacity,
                is_inbound=is_inbound,
            )
            self.flights[fid] = flight
            self.crew[flight.crew_id] = Crew(
                id=flight.crew_id,
                role=random.choice(["pilot", "cabin", "ground"]),
                assigned_flight=fid,
                duty_minutes_remaining=random.randint(30, 600),
            )

    # ---------- tick ----------
    def advance(self) -> list[Flight]:
        self.tick += 1
        updated: list[Flight] = []
        now = datetime.utcnow()
        for flight in self.flights.values():
            if flight.status in (FlightStatus.ARRIVED, FlightStatus.CANCELLED, FlightStatus.DIVERTED):
                continue
            if flight.status == FlightStatus.SCHEDULED and flight.scheduled_departure <= now + timedelta(minutes=30):
                flight.status = FlightStatus.BOARDING
                updated.append(flight)
            elif flight.status == FlightStatus.BOARDING and random.random() < 0.15:
                flight.status = FlightStatus.DEPARTED
                updated.append(flight)
            elif flight.status == FlightStatus.DEPARTED:
                flight.status = FlightStatus.IN_AIR
                updated.append(flight)
            elif flight.status == FlightStatus.IN_AIR and flight.estimated_arrival <= now:
                flight.status = FlightStatus.LANDED
                updated.append(flight)
            elif flight.status == FlightStatus.LANDED:
                flight.status = FlightStatus.ARRIVED
                updated.append(flight)
        return updated

    def inject_delay(self, flight: Flight, minutes: int) -> None:
        flight.delay_minutes += minutes
        flight.estimated_departure += timedelta(minutes=minutes)
        flight.estimated_arrival += timedelta(minutes=minutes)
        if flight.status in (FlightStatus.SCHEDULED, FlightStatus.BOARDING):
            flight.status = FlightStatus.DELAYED


state = SimulatorState()


async def generate_disruption() -> Disruption | None:
    """Pick a random disruption type and materialize it against live state."""
    if not state.flights:
        return None
    dtype = random.choice(list(DisruptionType))
    title, desc_template = DISRUPTION_TEMPLATES[dtype]
    candidate_flights = [f for f in state.flights.values()
                          if f.status not in (FlightStatus.ARRIVED, FlightStatus.CANCELLED)]
    if not candidate_flights:
        return None

    affected: list[str] = []
    affected_gates: list[str] = []
    delay_minutes = random.randint(20, 150)

    if dtype == DisruptionType.WEATHER:
        affected = [f.id for f in random.sample(candidate_flights, k=min(random.randint(8, 25), len(candidate_flights)))]
        desc = desc_template.format(rwy=random.choice(["09L", "09R", "27L", "27R"]))
        severity = random.choice([Severity.HIGH, Severity.CRITICAL])
        for fid in affected:
            state.inject_delay(state.flights[fid], delay_minutes)

    elif dtype == DisruptionType.GATE_CONFLICT:
        gate = random.choice(list(state.gates.values()))
        conflicting = [f for f in candidate_flights if f.gate == gate.id]
        if len(conflicting) < 2:
            others = random.sample(candidate_flights, k=min(2, len(candidate_flights)))
            for f in others:
                f.gate = gate.id
            conflicting = others
        affected = [f.id for f in conflicting][:3]
        affected_gates = [gate.id]
        desc = desc_template.format(gate=gate.id)
        severity = random.choice([Severity.MEDIUM, Severity.HIGH])

    elif dtype == DisruptionType.CREW_SHORTAGE:
        f = random.choice(candidate_flights)
        affected = [f.id]
        desc = desc_template.format(flight=f.callsign)
        severity = random.choice([Severity.MEDIUM, Severity.HIGH])
        state.inject_delay(f, delay_minutes)

    elif dtype == DisruptionType.TECHNICAL:
        f = random.choice(candidate_flights)
        affected = [f.id]
        desc = desc_template.format(tail=f.tail_number)
        severity = random.choice([Severity.HIGH, Severity.CRITICAL])
        state.inject_delay(f, delay_minutes + 30)

    elif dtype == DisruptionType.ATC_HOLD:
        dest = random.choice(AIRPORTS)
        affected = [f.id for f in candidate_flights if f.destination == dest][:15] or \
                   [f.id for f in random.sample(candidate_flights, k=min(6, len(candidate_flights)))]
        desc = desc_template.format(dest=dest)
        severity = random.choice([Severity.MEDIUM, Severity.HIGH])
        for fid in affected:
            state.inject_delay(state.flights[fid], delay_minutes)

    elif dtype == DisruptionType.GROUND_HANDLING:
        f = random.choice(candidate_flights)
        affected = [f.id]
        affected_gates = [f.gate]
        desc = desc_template.format(flight=f.callsign, gate=f.gate)
        severity = random.choice([Severity.LOW, Severity.MEDIUM])
        state.inject_delay(f, random.randint(15, 45))

    else:  # LATE_INBOUND
        f = random.choice([x for x in candidate_flights if x.is_inbound] or candidate_flights)
        affected = [f.id]
        desc = desc_template.format(flight=f.callsign, mins=delay_minutes)
        severity = random.choice([Severity.MEDIUM, Severity.HIGH])
        state.inject_delay(f, delay_minutes)

    disruption = Disruption(
        id=str(uuid.uuid4())[:8],
        type=dtype,
        severity=severity,
        title=title,
        description=desc,
        affected_flight_ids=affected,
        affected_gate_ids=affected_gates,
        detected_at=datetime.utcnow(),
    )
    state.disruptions[disruption.id] = disruption
    return disruption


async def simulation_loop(min_interval_ticks: int = 3, max_interval_ticks: int = 7):
    """Background task: advances flight state every tick, and injects a new
    disruption at a random cadence, publishing both onto the event bus for
    the AI pipeline and WebSocket broadcaster to consume."""
    next_disruption_at = random.randint(min_interval_ticks, max_interval_ticks)
    while True:
        await asyncio.sleep(settings.SIMULATOR_TICK_SECONDS)
        updated = state.advance()
        if updated:
            await event_bus.publish(TOPIC_FLIGHT_UPDATES, {
                "tick": state.tick,
                "updated_flight_ids": [f.id for f in updated],
            })
        if state.tick >= next_disruption_at:
            disruption = await generate_disruption()
            if disruption:
                await event_bus.publish(TOPIC_DISRUPTION_DETECTED, disruption.model_dump())
            next_disruption_at = state.tick + random.randint(min_interval_ticks, max_interval_ticks)
