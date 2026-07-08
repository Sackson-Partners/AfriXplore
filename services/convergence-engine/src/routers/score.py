import asyncpg
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, HTTPException
from ..database import get_pool
from ..models import ConvergenceScore, ScoreBreakdown

router = APIRouter()


def _geology_score(dpi: float) -> float:
    if dpi >= 80:
        return 10.0
    elif dpi >= 60:
        return 7.0
    elif dpi >= 40:
        return 4.0
    else:
        return 2.0


async def compute_score(mine_id: str, triggered_by: str = "manual") -> ConvergenceScore:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # 1. Get mine
        mine = await conn.fetchrow(
            "SELECT id, name, dpi_score FROM historical_mines WHERE id = $1",
            UUID(mine_id),
        )
        if not mine:
            raise HTTPException(status_code=404, detail="Mine not found")

        # 2. geology_score from dpi_score (Digital Prospectivity Index)
        dpi = float(mine["dpi_score"] or 0)
        geology_score = _geology_score(dpi)

        # 3. archive_score (historical documents indexed)
        doc_count = await conn.fetchval(
            "SELECT COUNT(*) FROM archive_documents WHERE mine_id = $1 AND status = 'indexed'",
            UUID(mine_id),
        )
        # Each document adds 5 points, capped at 30
        archive_score = float(min((doc_count or 0) * 5, 30))

        # 4. drone_score (geophysical anomalies from GeoSwarm surveys)
        drone_score = 0.0
        try:
            # Get the most recent high-confidence anomaly
            anomaly = await conn.fetchrow(
                """SELECT confidence_pct, severity
                   FROM geoswarm_anomalies
                   WHERE mine_id = $1
                   ORDER BY confidence_pct DESC, created_at DESC
                   LIMIT 1""",
                UUID(mine_id),
            )
            if anomaly:
                # Base score 20 + confidence bonus (0-20 points based on 0-100% confidence)
                confidence_bonus = float(anomaly["confidence_pct"] or 0) * 0.2
                drone_score = 20.0 + confidence_bonus
        except asyncpg.UndefinedTableError:
            pass

        # 5. scout_score (ground intelligence from scout network)
        scout_score = 0.0
        try:
            # Count validated scout reports
            report_stats = await conn.fetchrow(
                """SELECT
                     COUNT(*) FILTER (WHERE status = 'validated') AS validated_count,
                     AVG(confidence_score) FILTER (WHERE status = 'validated') AS avg_confidence
                   FROM scout_reports
                   WHERE mine_id = $1""",
                UUID(mine_id),
            )
            if report_stats and report_stats["validated_count"]:
                # Base: 4 points per validated report (capped at 16)
                base_scout_score = min(float(report_stats["validated_count"]) * 4, 16)
                # Bonus: up to 4 points based on average confidence
                confidence_bonus = float(report_stats["avg_confidence"] or 0) * 0.04
                scout_score = base_scout_score + confidence_bonus
        except asyncpg.UndefinedTableError:
            pass

        # 6. Calculate total convergence score
        total = drone_score + archive_score + scout_score + geology_score

        # Max possible: 40 (drone) + 30 (archive) + 20 (scout) + 10 (geology) = 100

        # 7. Get previous score for comparison
        previous_score = None
        try:
            prev = await conn.fetchrow(
                """SELECT new_score FROM convergence_events
                   WHERE mine_id = $1
                   ORDER BY created_at DESC
                   LIMIT 1""",
                UUID(mine_id),
            )
            if prev:
                previous_score = float(prev["new_score"])
        except Exception:
            pass

        # 8. Record convergence event
        try:
            await conn.execute(
                """INSERT INTO convergence_events(mine_id, event_type, previous_score, new_score, triggered_by)
                   VALUES($1, 'score_computed', $2, $3, $4)""",
                UUID(mine_id),
                previous_score,
                total,
                triggered_by,
            )
        except Exception:
            pass

        return ConvergenceScore(
            mine_id=mine["id"],
            mine_name=mine["name"],
            convergence_score=round(total, 2),
            breakdown=ScoreBreakdown(
                drone_score=round(drone_score, 2),
                archive_score=archive_score,
                scout_score=scout_score,
                geology_score=geology_score,
            ),
            certified_target=total >= 70,
            scored_at=datetime.now(timezone.utc),
        )


@router.post("/score/{mine_id}", response_model=ConvergenceScore)
async def score_mine(mine_id: str):
    return await compute_score(mine_id)


@router.get("/scores")
async def list_scores(page: int = 1, page_size: int = 20):
    pool = await get_pool()
    async with pool.acquire() as conn:
        offset = (page - 1) * page_size
        rows = await conn.fetch(
            """SELECT id, name, dpi_score FROM historical_mines
               ORDER BY dpi_score DESC NULLS LAST LIMIT $1 OFFSET $2""",
            page_size,
            offset,
        )
        total = await conn.fetchval("SELECT COUNT(*) FROM historical_mines")

    scores = []
    for row in rows:
        dpi = float(row["dpi_score"] or 0)
        g = _geology_score(dpi)
        scores.append(
            {
                "mine_id": str(row["id"]),
                "mine_name": row["name"],
                "geology_score": g,
                "estimated_convergence_score": g,  # fast path without full compute
                "certified_target": g >= 70,
            }
        )

    return {
        "data": scores,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }
