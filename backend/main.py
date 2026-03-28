import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, engine, Base
from simulator import generate_sensor_readings, get_rover_state
from edge_processor import EdgeProcessor
from routers import sensor_data, anomalies, websocket as ws_router, uplink_queue
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
            pub = {k: v for k, v in reading.items() if k != "_uplink_eligible"}
            await broadcast({"type": "sensor_reading", "data": pub})

        for event in anomaly_events:
            await broadcast({"type": "anomaly_alert", "data": event})

        await asyncio.sleep(2)


async def stats_broadcast_loop() -> None:
    while True:
        await asyncio.sleep(5)
        async with async_session() as db:
            overview = await crud.get_overview_stats(db)
            qsnap = await crud.get_uplink_queue_snapshot(db)

        edge_stats = processor.get_stats()
        rover = get_rover_state()
        tr = overview["total_readings"]
        tx = overview.get("transmitted_readings", 0)
        # Paket / iletim sayıları: yalnızca DB (edge belleği süreç ömrüyle sınırlı; yenilemede düşmez)
        await broadcast(
            {
                "type": "stats_update",
                "data": {
                    **overview,
                    **edge_stats,
                    "total_packets": tr,
                    "transmitted_packets": tx,
                    "compression_ratio": round(tx / tr, 4) if tr > 0 else 0.0,
                    "bandwidth_saved_percent": overview["bandwidth_saved_percent"],
                    "total_bytes_saved": overview["total_bytes_saved"],
                    "rover": rover,
                    "uplink_queue": qsnap,
                },
            }
        )


async def uplink_drain_loop() -> None:
    while True:
        await asyncio.sleep(1.5)
        async with async_session() as db:
            sent_payloads = await crud.drain_uplink_queue(db, processor, max_items=6)
            await db.commit()
        for row in sent_payloads:
            await broadcast({"type": "sensor_reading", "data": row})
        if sent_payloads:
            async with async_session() as db:
                snap = await crud.get_uplink_queue_snapshot(db)
            await broadcast({"type": "uplink_queue_update", "data": snap})


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sim_task = asyncio.create_task(simulation_loop())
    stats_task = asyncio.create_task(stats_broadcast_loop())
    uplink_task = asyncio.create_task(uplink_drain_loop())
    yield
    sim_task.cancel()
    stats_task.cancel()
    uplink_task.cancel()


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
app.include_router(uplink_queue.router)
app.include_router(ws_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nirvana-api"}
