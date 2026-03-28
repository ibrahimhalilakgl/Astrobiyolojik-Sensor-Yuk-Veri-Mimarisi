from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models import AnomalyEvent, SensorReading, TransmissionLog


async def create_sensor_reading(db: AsyncSession, data: dict) -> SensorReading:
    reading = SensorReading(**data)
    db.add(reading)
    await db.flush()
    return reading


async def create_anomaly_event(db: AsyncSession, data: dict) -> AnomalyEvent:
    event = AnomalyEvent(**data)
    db.add(event)
    await db.flush()
    return event


async def create_transmission_log(db: AsyncSession, data: dict) -> TransmissionLog:
    log = TransmissionLog(**data)
    db.add(log)
    await db.flush()
    return log


async def bulk_create_readings(
    db: AsyncSession,
    readings: List[dict],
    anomalies: List[dict],
    transmission: Optional[dict],
) -> None:
    for r in readings:
        db.add(SensorReading(**r))
    for a in anomalies:
        db.add(AnomalyEvent(**a))
    if transmission:
        db.add(TransmissionLog(**transmission))
    await db.flush()


async def get_sensor_readings(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> List[SensorReading]:
    result = await db.execute(
        select(SensorReading)
        .order_by(desc(SensorReading.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_sensor_reading_by_id(
    db: AsyncSession, reading_id: UUID
) -> Optional[SensorReading]:
    result = await db.execute(
        select(SensorReading).where(SensorReading.id == reading_id)
    )
    return result.scalar_one_or_none()


async def get_sensor_stats(db: AsyncSession) -> List[dict]:
    result = await db.execute(
        select(
            SensorReading.sensor_type,
            func.count(SensorReading.id).label("count"),
            func.avg(SensorReading.raw_value).label("mean"),
            func.stddev(SensorReading.raw_value).label("std"),
            func.avg(
                func.cast(SensorReading.is_anomaly, func.INTEGER if False else None)
            ).label("anomaly_rate"),
        ).group_by(SensorReading.sensor_type)
    )
    rows = result.all()
    stats = []
    for row in rows:
        total = row.count or 1
        anomaly_q = await db.execute(
            select(func.count(SensorReading.id)).where(
                SensorReading.sensor_type == row.sensor_type,
                SensorReading.is_anomaly == True,  # noqa: E712
            )
        )
        anomaly_count = anomaly_q.scalar() or 0
        stats.append(
            {
                "sensor_type": row.sensor_type,
                "count": row.count,
                "mean": round(float(row.mean or 0), 4),
                "std": round(float(row.std or 0), 4),
                "anomaly_rate": round(anomaly_count / total, 4),
            }
        )
    return stats


async def get_anomalies(
    db: AsyncSession,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[AnomalyEvent]:
    stmt = select(AnomalyEvent).order_by(desc(AnomalyEvent.created_at))
    if severity:
        stmt = stmt.where(AnomalyEvent.severity == severity.upper())
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_recent_anomalies(db: AsyncSession, limit: int = 10) -> List[AnomalyEvent]:
    result = await db.execute(
        select(AnomalyEvent).order_by(desc(AnomalyEvent.created_at)).limit(limit)
    )
    return list(result.scalars().all())


async def acknowledge_anomaly(
    db: AsyncSession, anomaly_id: UUID
) -> Optional[AnomalyEvent]:
    result = await db.execute(
        select(AnomalyEvent).where(AnomalyEvent.id == anomaly_id)
    )
    event = result.scalar_one_or_none()
    if event:
        event.acknowledged = True
        await db.flush()
    return event


async def get_anomaly_stats(db: AsyncSession) -> List[dict]:
    result = await db.execute(
        select(
            AnomalyEvent.anomaly_type,
            func.count(AnomalyEvent.id).label("count"),
            func.avg(AnomalyEvent.scientific_priority).label("avg_priority"),
        ).group_by(AnomalyEvent.anomaly_type)
    )
    return [
        {
            "anomaly_type": row.anomaly_type,
            "count": row.count,
            "avg_priority": round(float(row.avg_priority or 0), 2),
        }
        for row in result.all()
    ]


async def get_overview_stats(db: AsyncSession) -> dict:
    total_q = await db.execute(select(func.count(SensorReading.id)))
    total_readings = total_q.scalar() or 0

    anomaly_q = await db.execute(select(func.count(AnomalyEvent.id)))
    total_anomalies = anomaly_q.scalar() or 0

    transmitted_q = await db.execute(
        select(func.count(SensorReading.id)).where(
            SensorReading.is_transmitted == True  # noqa: E712
        )
    )
    transmitted = transmitted_q.scalar() or 0

    saved_pct = round((1 - transmitted / total_readings) * 100, 2) if total_readings > 0 else 0.0

    severity_q = await db.execute(
        select(AnomalyEvent.severity)
        .order_by(desc(AnomalyEvent.created_at))
        .limit(1)
    )
    highest = severity_q.scalar_one_or_none()

    bytes_q = await db.execute(
        select(func.coalesce(func.sum(TransmissionLog.bytes_saved), 0))
    )
    total_bytes_saved = bytes_q.scalar() or 0

    return {
        "total_readings": total_readings,
        "total_anomalies": total_anomalies,
        "bandwidth_saved_percent": saved_pct,
        "highest_severity": highest,
        "total_bytes_saved": int(total_bytes_saved),
    }
