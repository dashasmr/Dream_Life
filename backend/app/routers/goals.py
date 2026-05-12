from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.crud import create_goal, delete_goal, list_goals
from app.database import get_db
from app.schemas import GoalCreate, GoalRead
from app.services.goals import goal_to_read

router = APIRouter(prefix="/goals", tags=["goals"])

_ALLOWED_UNITS: dict[str, frozenset[str]] = {
    "productivity": frozenset({"tasks", "minutes"}),
    "finance": frozenset({"eur"}),
    "home": frozenset({"percent"}),
}


def _validate_unit_category(category: str, unit: str) -> None:
    allowed = _ALLOWED_UNITS.get(category)
    if allowed is None or unit not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"unit '{unit}' is not valid for category '{category}'.",
        )


@router.get("", response_model=list[GoalRead])
def list_goals_with_progress(
    db: Session = Depends(get_db),
    range_start: datetime = Query(..., alias="from"),
    range_end: datetime = Query(..., alias="to"),
    period: str | None = Query(None, description="If set, only goals with this period (weekly|monthly)."),
):
    """
    Returns goals with `currentValue` and `status` computed for the half-open window [from, to).
    Pass a window aligned with each goal's `period` (e.g. local month for monthly goals).
    """
    if range_start >= range_end:
        raise HTTPException(status_code=422, detail="from must be before to")
    if period is not None and period not in ("weekly", "monthly"):
        raise HTTPException(status_code=422, detail="period must be weekly or monthly")

    try:
        rows = list_goals(db)
    except (ProgrammingError, OperationalError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable or schema out of date. Run: alembic upgrade head",
        ) from exc

    if period:
        rows = [r for r in rows if r.period == period]

    return [GoalRead.model_validate(goal_to_read(db, r, range_start, range_end)) for r in rows]


@router.post("", response_model=GoalRead, status_code=201)
def create_goal_endpoint(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    range_start: datetime = Query(..., alias="from"),
    range_end: datetime = Query(..., alias="to"),
):
    _validate_unit_category(payload.category, payload.unit)
    if range_start >= range_end:
        raise HTTPException(status_code=422, detail="from must be before to")
    try:
        row = create_goal(
            db,
            title=payload.title,
            category=payload.category,
            target_value=float(payload.targetValue),
            unit=payload.unit,
            period=payload.period,
        )
        data = goal_to_read(db, row, range_start, range_end)
        return GoalRead.model_validate(data)
    except (ProgrammingError, OperationalError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable or schema out of date. Run: alembic upgrade head",
        ) from exc


@router.delete("/{goal_id}", status_code=204)
def delete_goal_endpoint(goal_id: str, db: Session = Depends(get_db)):
    try:
        ok = delete_goal(db, goal_id)
    except (ProgrammingError, OperationalError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable or schema out of date. Run: alembic upgrade head",
        ) from exc
    if not ok:
        raise HTTPException(status_code=404, detail="Goal not found")
    return Response(status_code=204)
