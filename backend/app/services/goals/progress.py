"""
Goal progress and status — pure analytics over DB aggregates for a half-open window [range_start, range_end).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud import finance_totals_in_range, list_cleaning_zones
from app.models import DailySnapshot, Event, Goal

GoalStatus = Literal["on_track", "at_risk", "completed"]


def _focus_seconds_from_event(ev: Event) -> float:
    p = ev.payload or {}
    if ev.type == "focus_session_completed":
        sec = float(p.get("duration_seconds") or 0)
        if sec > 0:
            return sec
        return float(p.get("duration_minutes") or 0) * 60.0
    if ev.type == "focus_ended":
        return float(p.get("duration_seconds") or 0)
    return 0.0


def elapsed_ratio(range_start: datetime, range_end: datetime, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    if range_end <= range_start:
        return 1.0
    total_sec = (range_end - range_start).total_seconds()
    if total_sec <= 0:
        return 1.0
    cap = min(now, range_end)
    elapsed_sec = (cap - range_start).total_seconds()
    return max(0.0, min(1.0, elapsed_sec / total_sec))


def derive_goal_status(
    *,
    current: float,
    target: float,
    unit: str,
    category: str,
    elapsed_ratio_val: float,
) -> GoalStatus:
    if target <= 0:
        return "on_track"
    if current >= target:
        return "completed"

    if category == "home" and unit == "percent":
        if elapsed_ratio_val > 0.3 and current < target - 10.0:
            return "at_risk"
        if elapsed_ratio_val > 0.55 and current < target - 5.0:
            return "at_risk"
        return "on_track"

    expected = target * elapsed_ratio_val
    if elapsed_ratio_val > 0.1 and expected > 1e-6 and current < expected * 0.82:
        return "at_risk"
    return "on_track"


def compute_current_value(db: Session, goal: Goal, range_start: datetime, range_end: datetime) -> float:
    if goal.category == "productivity":
        if goal.unit == "tasks":
            stmt = select(func.count(Event.id)).where(
                Event.type == "task_completed",
                Event.created_at >= range_start,
                Event.created_at < range_end,
            )
            return float(db.execute(stmt).scalar_one() or 0)
        if goal.unit == "minutes":
            stmt = select(Event).where(
                Event.created_at >= range_start,
                Event.created_at < range_end,
                Event.type.in_(("focus_ended", "focus_session_completed")),
            )
            evs = list(db.execute(stmt).scalars().all())
            sec = sum(_focus_seconds_from_event(e) for e in evs)
            return round(sec / 60.0, 2)

    if goal.category == "finance" and goal.unit == "eur":
        fin = finance_totals_in_range(db, range_start, range_end)
        delta = float(fin["balance_delta"])
        return max(0.0, round(delta, 2))

    if goal.category == "home" and goal.unit == "percent":
        start_d = range_start.astimezone(timezone.utc).date()
        end_d = range_end.astimezone(timezone.utc).date()
        stmt = select(DailySnapshot.home_health_score).where(
            DailySnapshot.snapshot_date >= start_d,
            DailySnapshot.snapshot_date < end_d,
            DailySnapshot.home_health_score.is_not(None),
        )
        scores = [int(x) for x in db.execute(stmt).scalars().all() if x is not None]
        if scores:
            return round(sum(scores) / len(scores), 2)
        zones = list_cleaning_zones(db)
        if not zones:
            return 0.0
        pts = {"ok": 100, "soon": 60, "overdue": 20}
        avg = sum(pts.get(z.get("status", "overdue"), 20) for z in zones) / len(zones)
        return round(float(avg), 2)

    return 0.0


def goal_to_read(
    db: Session, goal: Goal, range_start: datetime, range_end: datetime
) -> dict[str, Any]:
    current = compute_current_value(db, goal, range_start, range_end)
    target = float(goal.target_value)
    er = elapsed_ratio(range_start, range_end)
    status = derive_goal_status(
        current=current,
        target=target,
        unit=goal.unit,
        category=goal.category,
        elapsed_ratio_val=er,
    )
    return {
        "id": goal.id,
        "title": goal.title,
        "category": goal.category,
        "targetValue": target,
        "currentValue": current,
        "unit": goal.unit,
        "period": goal.period,
        "status": status,
    }
