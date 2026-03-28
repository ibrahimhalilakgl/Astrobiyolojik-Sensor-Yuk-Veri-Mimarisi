"""Groq (Llama) ile rover anomali düşünce metni — GROQ_API_KEY yoksa sessizce fallback."""

from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, List

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_ID = "llama-3.3-70b-versatile"

_SYSTEM_PROMPT = (
    "Sen SENTİNEL'sin — Mars yüzeyinde çalışan otonom bir rover yapay zekasısın. "
    "Görevin: sensör verilerini analiz edip bilimsel karar vermek. Düşünce sürecini "
    "adım adım, kısa ve teknik olarak Türkçe açıkla. Sonunda net bir karar ver: "
    "TX (ilet) veya DROP (atla)."
)


def _fallback_decision(context: Dict[str, Any]) -> str:
    if context.get("uplink_eligible"):
        return "TX"
    return "DROP"


def _parse_decision_from_text(text: str, context: Dict[str, Any]) -> str:
    lines = [ln.strip() for ln in text.strip().split("\n") if ln.strip()]
    if not lines:
        return _fallback_decision(context)
    last = lines[-1].upper()
    if re.search(r"\bDROP\b", last) or "ATLA" in last:
        return "DROP"
    if re.search(r"\bTX\b", last) or "İLET" in last or "ILET" in last:
        return "TX"
    return _fallback_decision(context)


def _build_user_prompt(ctx: Dict[str, Any]) -> str:
    is_novel = bool(ctx.get("is_novel"))
    novel_line = "EVET — yeni imza!" if is_novel else "HAYIR"
    return (
        f"Kanal: {ctx.get('channel_id', '?')} ({ctx.get('sensor_type', '?')})\n"
        f"Ham değer: {float(ctx.get('raw_value', 0)):.4f}\n"
        f"Anomali skoru: {float(ctx.get('anomaly_score', 0)):.1f}/100\n"
        f"River skoru: {float(ctx.get('river_score', 0)):.1f}/100\n"
        f"LSTM skoru: {float(ctx.get('lstm_score', 0)):.1f}/100\n"
        f"Yenilik tespiti: {novel_line}\n"
        f"Yenilik benzerliği: {float(ctx.get('novelty_similarity', 0)):.2f}\n"
        f"Enerji seviyesi: %{int(ctx.get('energy_level', 0))}\n"
        f"RL önerisi: {ctx.get('rl_suggestion', '—')}\n"
        f"Bilimsel öncelik: {int(ctx.get('scientific_priority', 0))}/10\n"
        f"Anomali tipi: {ctx.get('anomaly_type', '—')}\n\n"
        "Adım adım düşün ve kararını gerekçeli ver."
    )


async def think(context: dict) -> dict:
    """
    anomaly_score >= 50 için çağrılmalı; API anahtarı yoksa veya hata olursa fallback döner.
    """
    ctx = dict(context)
    if float(ctx.get("anomaly_score") or 0) < 50:
        return {
            "thinking": "",
            "steps": [],
            "decision": _fallback_decision(ctx),
            "duration_ms": 0,
            "model": "skipped",
        }

    api_key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not api_key:
        return {
            "thinking": "AI thinking devre dışı",
            "steps": [],
            "decision": _fallback_decision(ctx),
            "duration_ms": 0,
            "model": "fallback",
        }

    user_prompt = _build_user_prompt(ctx)
    body = {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 500,
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0)) as client:
            resp = await client.post(GROQ_CHAT_URL, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("empty choices")
        content = (choices[0].get("message") or {}).get("content") or ""
        content = str(content).strip()
        steps: List[str] = [ln for ln in content.split("\n")]
        decision = _parse_decision_from_text(content, ctx)
        return {
            "thinking": content,
            "steps": steps,
            "decision": decision,
            "duration_ms": elapsed_ms,
            "model": MODEL_ID,
        }
    except Exception:
        return {
            "thinking": "AI thinking devre dışı",
            "steps": [],
            "decision": _fallback_decision(ctx),
            "duration_ms": 0,
            "model": "fallback",
        }
