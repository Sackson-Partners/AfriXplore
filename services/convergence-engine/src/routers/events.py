from uuid import UUID
from fastapi import APIRouter, HTTPException
from ..database import get_pool
from ..models import ConvergenceEvent

router = APIRouter()


@router.get("/events")
async def list_events(page: int = 1, page_size: int = 20):
    pool = await get_pool()
    offset = (page - 1) * page_size

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT ce.id, ce.mine_id, hm.name AS mine_name,
                          ce.event_type, ce.previous_score, ce.new_score,
                          ce.triggered_by, ce.created_at
                   FROM convergence_events ce
                   LEFT JOIN historical_mines hm ON hm.id = ce.mine_id
                   ORDER BY ce.created_at DESC
                   LIMIT $1 OFFSET $2""",
                page_size,
                offset,
            )
            total = await conn.fetchval("SELECT COUNT(*) FROM convergence_events")
    except Exception as exc:
        # convergence_events may not exist yet (first boot before lifespan ran)
        if "does not exist" in str(exc):
            return {"data": [], "total": 0, "page": page, "page_size": page_size, "has_next": False}
        raise

    data = [
        {
            "id": str(row["id"]),
            "mine_id": str(row["mine_id"]),
            "mine_name": row["mine_name"],
            "event_type": row["event_type"],
            "previous_score": row["previous_score"],
            "new_score": row["new_score"],
            "triggered_by": row["triggered_by"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]

    return {
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT ce.id, ce.mine_id, hm.name AS mine_name,
                          ce.event_type, ce.previous_score, ce.new_score,
                          ce.triggered_by, ce.created_at
                   FROM convergence_events ce
                   LEFT JOIN historical_mines hm ON hm.id = ce.mine_id
                   WHERE ce.id = $1""",
                UUID(event_id),
            )
    except Exception as exc:
        if "does not exist" in str(exc):
            raise HTTPException(status_code=404, detail="Event not found")
        raise

    if not row:
        raise HTTPException(status_code=404, detail="Event not found")

    return {
        "id": str(row["id"]),
        "mine_id": str(row["mine_id"]),
        "mine_name": row["mine_name"],
        "event_type": row["event_type"],
        "previous_score": row["previous_score"],
        "new_score": row["new_score"],
        "triggered_by": row["triggered_by"],
        "created_at": row["created_at"].isoformat(),
    }
