"""In-memory store of the latest impact assessment + recovery plans per
disruption, keyed for fast API/WebSocket retrieval (mirrored to Postgres
for durability via routers/recovery.py)."""
from __future__ import annotations
from app.schemas import ImpactAssessment, RecoveryPlan

impacts: dict[str, ImpactAssessment] = {}
plans: dict[str, list[RecoveryPlan]] = {}
decisions: dict[str, dict] = {}  # disruption_id -> {plan_id, decision, ...}
# Measured wall-clock seconds for the Impact -> Recovery pipeline run, keyed
# by disruption_id. This is a REAL measurement (time.perf_counter), used as
# the "AirportOS recovery" side of the Recovery Value comparison — never a
# hardcoded number.
pipeline_durations: dict[str, float] = {}
