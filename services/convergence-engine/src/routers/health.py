from fastapi import APIRouter
from ..database import get_pool

router = APIRouter()


@router.get("/health/live")
async def live():
    return {"status": "ok"}


@router.get("/health/ready")
async def ready():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"status": "ok"}
