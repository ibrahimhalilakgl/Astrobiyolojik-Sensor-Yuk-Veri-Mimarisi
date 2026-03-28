import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, engine, Base
from simulator import generate_sensor_readings, get_rover_state
from edge_processor import EdgeProcessor
from routers import sensor_data, anomalies, websocket as ws_router
from routers.websocket import broadcast
import crud

processor = EdgeProcessor()


async def simulation_loop() -> None:
    while True:
        raw_readings = generate_sensor_readings()
        processed, anomaly_events, transmission_log = processor.process_batch(raw_readings)

        async with async_session() as db:
            await crud.bulk_create_readings(db, processed, anomaly_events, transmission_log)
            await db.commit()

        for reading in processed:
            await broadcast({"type": "sensor_reading", "data": reading})

        for event in anomaly_events:
            await broadcast({"type": "anomaly_alert", "data": event})

        await asyncio.sleep(2)


async def stats_broadcast_loop() -> None:
    while True:
        await asyncio.sleep(5)
        async with async_session() as db:
            overview = await crud.get_overview_stats(db)

        edge_stats = processor.get_stats()
        rover = get_rover_state()

        await broadcast(
            {
                "type": "stats_update",
                "data": {**overview, **edge_stats, "rover": rover},
            }
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sim_task = asyncio.create_task(simulation_loop())
    stats_task = asyncio.create_task(stats_broadcast_loop())
    yield
    sim_task.cancel()
    stats_task.cancel()


app = FastAPI(
    title="Nirvana — Astrobiyolojik Sensör Yükü Veri Mimarisi API",
    description="Mars rover simülasyonundan gelen edge-processed sensör verisi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_data.router)
app.include_router(anomalies.router)
app.include_router(ws_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nirvana-api"}
