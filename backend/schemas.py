from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SensorReadingCreate(BaseModel):
    sensor_type: str
    raw_value: float
    unit: str
    anomaly_score: float = 0.0
    is_anomaly: bool = False
    is_transmitted: bool = False
    location_lat: float
    location_lon: float
    sol: int = 1


class SensorReadingResponse(BaseModel):
    id: UUID
    sensor_type: str
    raw_value: float
    unit: str
    anomaly_score: float
    is_anomaly: bool
    is_transmitted: bool
    location_lat: float
    location_lon: float
    sol: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SensorStats(BaseModel):
    sensor_type: str
    count: int
    mean: float
    std: float
    anomaly_rate: float


class AnomalyEventCreate(BaseModel):
    reading_id: UUID
    anomaly_type: str
    severity: str
    description: str
    scientific_priority: int = Field(ge=1, le=10)


class AnomalyEventResponse(BaseModel):
    id: UUID
    reading_id: UUID
    anomaly_type: str
    severity: str
    description: str
    scientific_priority: int
    acknowledged: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AnomalyAcknowledge(BaseModel):
    acknowledged: bool = True


class AnomalyStats(BaseModel):
    anomaly_type: str
    count: int
    avg_priority: float


class TransmissionLogResponse(BaseModel):
    id: UUID
    batch_id: UUID
    total_packets: int
    transmitted_packets: int
    bytes_saved: int
    compression_ratio: float
    transmission_window: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginationParams(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=500)


class OverviewStats(BaseModel):
    total_readings: int
    total_anomalies: int
    bandwidth_saved_percent: float
    highest_severity: Optional[str] = None
    total_bytes_saved: int = 0
