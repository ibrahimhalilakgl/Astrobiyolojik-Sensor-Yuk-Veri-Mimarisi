from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

import crud
from database import get_db
from schemas import AnomalyAcknowledge, AnomalyEventResponse, AnomalyStats

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])


@router.get("", response_model=list[AnomalyEventResponse])
async def list_anomalies(
    severity: Optional[str] = Query(None, description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_anomalies(db, severity=severity, skip=skip, limit=limit)


@router.get("/recent", response_model=list[AnomalyEventResponse])
async def recent_anomalies(db: AsyncSession = Depends(get_db)):
    return await crud.get_recent_anomalies(db, limit=10)


@router.get("/stats", response_model=list[AnomalyStats])
async def anomaly_stats(db: AsyncSession = Depends(get_db)):
    return await crud.get_anomaly_stats(db)


@router.patch("/{anomaly_id}/acknowledge", response_model=AnomalyEventResponse)
async def acknowledge_anomaly(
    anomaly_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    event = await crud.acknowledge_anomaly(db, anomaly_id)
    if not event:
        raise HTTPException(status_code=404, detail="Anomaly event not found")
    await db.commit()
    return event
