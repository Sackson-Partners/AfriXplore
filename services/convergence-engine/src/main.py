import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import get_pool, close_pool
from .routers import health, score, events
from .consumer import start_consumers

logging.basicConfig(level=settings.log_level.upper())

INIT_SQL = """
CREATE TABLE IF NOT EXISTS convergence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mine_id UUID NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'score_computed',
    previous_score FLOAT,
    new_score FLOAT NOT NULL,
    triggered_by TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(INIT_SQL)
    consumer_tasks = start_consumers()
    yield
    for task in consumer_tasks:
        task.cancel()
    if consumer_tasks:
        await asyncio.gather(*consumer_tasks, return_exceptions=True)
    await close_pool()


app = FastAPI(title="Convergence Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(score.router, prefix="/v1")
app.include_router(events.router, prefix="/v1")
