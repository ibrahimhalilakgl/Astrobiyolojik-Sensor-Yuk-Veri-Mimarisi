"""Çalışma anı ayarları (Groq düşünce modu vb.)."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["Ayarlar"])


def _processor():
    import main as main_mod

    return main_mod.processor


class RoverThinkingBody(BaseModel):
    enabled: bool


@router.get("/rover-thinking")
async def get_rover_thinking():
    p = _processor()
    return {"enabled": p.rover_thinking_enabled}


@router.patch("/rover-thinking")
async def patch_rover_thinking(body: RoverThinkingBody):
    p = _processor()
    p.rover_thinking_enabled = bool(body.enabled)
    return {"enabled": p.rover_thinking_enabled}
