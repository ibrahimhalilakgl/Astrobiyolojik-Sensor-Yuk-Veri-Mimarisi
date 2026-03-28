from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

import crud
from database import get_db
from schemas import SensorReadingResponse, SensorStats

router = APIRouter(prefix="/api/sensor-data", tags=["Sensör verisi"])


@router.get("", response_model=list[SensorReadingResponse])
async def list_sensor_readings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=5000),
    sensor_type: Optional[str] = Query(
        None,
        max_length=10,
        description="Örn. TEMP, CH4 — verilirse yalnızca bu tip için son kayıtlar",
    ),
    db: AsyncSession = Depends(get_db),
):
    readings = await crud.get_sensor_readings(
        db, skip=skip, limit=limit, sensor_type=sensor_type
    )
    return readings


@router.get("/stats", response_model=list[SensorStats])
async def sensor_stats(db: AsyncSession = Depends(get_db)):
    return await crud.get_sensor_stats(db)


@router.get("/{reading_id}", response_model=SensorReadingResponse)
async def get_sensor_reading(
    reading_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    reading = await crud.get_sensor_reading_by_id(db, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Sensör okuması bulunamadı")
    return reading


@router.post("/simulate", response_model=list[SensorReadingResponse])
async def simulate_reading(db: AsyncSession = Depends(get_db)):
    from simulator import generate_sensor_readings
    from edge_processor import EdgeProcessor

    processor = EdgeProcessor()
    raw = generate_sensor_readings()
    processed, anomalies, transmission = await processor.process_batch(raw)
    await crud.bulk_create_readings(db, processed, anomalies, transmission)
    await db.commit()

    readings = await crud.get_sensor_readings(db, skip=0, limit=8)
    return readings
