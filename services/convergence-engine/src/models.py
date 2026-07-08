from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ScoreBreakdown(BaseModel):
    drone_score: float
    archive_score: float
    scout_score: float
    geology_score: float


class ConvergenceScore(BaseModel):
    mine_id: UUID
    mine_name: str
    convergence_score: float
    breakdown: ScoreBreakdown
    certified_target: bool  # True if convergence_score >= 70
    scored_at: datetime


class ConvergenceEvent(BaseModel):
    id: UUID
    mine_id: UUID
    mine_name: str
    event_type: str  # "score_computed", "threshold_crossed", "recalibrated"
    previous_score: float | None
    new_score: float
    triggered_by: str  # "drone_upload", "archive_index", "scout_report", "manual"
    created_at: datetime


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    page_size: int
    has_next: bool
