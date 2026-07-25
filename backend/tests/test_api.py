import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app, on_startup


@pytest.fixture(scope="module", autouse=True)
async def _startup():
    """httpx's ASGITransport does not trigger FastAPI lifespan events, so
    we invoke the same startup routine the real server runs (DB init, demo
    user seed, simulator bootstrap) once before this module's tests."""
    await on_startup()
    yield


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_login_flow_and_protected_route():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post("/api/auth/login", json={"username": "operator", "password": "operator123"})
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["username"] == "operator"


@pytest.mark.asyncio
async def test_full_disruption_recovery_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post("/api/auth/login", json={"username": "operator", "password": "operator123"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        sim_resp = await client.post("/api/disruptions/simulate", headers=headers)
        assert sim_resp.status_code == 200
        body = sim_resp.json()
        assert len(body["plans"]) == 3

        disruption_id = body["disruption"]["id"]
        plan_id = body["plans"][0]["id"]
        decide_resp = await client.post("/api/recovery/decide", headers=headers, json={
            "disruption_id": disruption_id, "plan_id": plan_id,
            "decision": "approved", "time_to_decision_seconds": 9.4,
        })
        assert decide_resp.status_code == 200
        assert decide_resp.json()["decision"] == "approved"
