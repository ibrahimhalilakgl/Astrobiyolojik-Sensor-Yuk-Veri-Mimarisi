"""Canlı WS: sensor_reading, anomaly_alert, stats_update, rover_thinking, …"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Set
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["WebSocket"])

active_connections: Set[WebSocket] = set()


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _serialize(data: dict) -> str:
    return json.dumps(data, cls=UUIDEncoder)


async def broadcast(message: dict) -> None:
    payload = _serialize(message)
    disconnected: list[WebSocket] = []
    for ws in active_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        active_connections.discard(ws)


@router.websocket("/ws/live-feed")
async def live_feed(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.discard(websocket)
    except Exception:
        active_connections.discard(websocket)
