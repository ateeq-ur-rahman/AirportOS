from fastapi import APIRouter, Depends
from app.schemas import ChatRequest
from app.auth import get_current_user
from app.agents.copilot_agent import copilot_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    reply = await copilot_agent.answer(body.message, body.disruption_id)
    return {"role": "assistant", "content": reply}
