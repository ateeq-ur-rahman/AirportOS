"""
WebSocket endpoint for the live dashboard. Clients connect to /ws/live and
receive a stream of JSON events: {"type": "...", "data": {...}}.

A background bridging task (started in main.py) subscribes to the internal
event bus and rebroadcasts every event to all connected WebSocket clients,
so REST, WebSocket, and (in production) Kafka consumers all observe the
exact same event stream.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Clients don't need to send anything; keep the connection alive
            # and drop any inbound pings/messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
