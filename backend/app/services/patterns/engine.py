"""
Loads historical rows for [range_start, range_end) and runs all pattern detectors.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailySnapshot, Event, FinanceTransaction
from app.services.patterns.detectors import (
    detect_cleaning_productivity_pattern,
    detect_focus_productivity_pattern,
    detect_spending_top_category_pattern,
)


def _utc_date(ev: Event) -> date | None:
    if ev.created_at is None:
        return None
    return ev.created_at.astimezone(timezone.utc).date()


def _aggregate_events(events: list[Event]) -> tuple[dict[date, int], set[date]]:
    task_by_day: dict[date, int] = defaultdict(int)
    focus_days: set[date] = set()
    for e in events:
        d = _utc_date(e)
        if d is None:
            continue
        if e.type == "task_completed":
            task_by_day[d] += 1
        if e.type in ("focus_started", "focus_ended", "focus_session_completed"):
            focus_days.add(d)
    return dict(task_by_day), focus_days


def _load_snapshots_health_by_day(
    db: Session, range_start: datetime, range_end: datetime
) -> dict[date, int]:
    start_d = range_start.astimezone(timezone.utc).date()
    end_d = range_end.astimezone(timezone.utc).date()
    stmt = select(DailySnapshot).where(
        DailySnapshot.snapshot_date >= start_d,
        DailySnapshot.snapshot_date < end_d,
    )
    rows = list(db.execute(stmt).scalars().all())
    out: dict[date, int] = {}
    for r in rows:
        if r.home_health_score is not None:
            out[r.snapshot_date] = int(r.home_health_score)
    return out


def _load_expense_totals_by_category(
    db: Session, range_start: datetime, range_end: datetime
) -> dict[str, float]:
    stmt = select(FinanceTransaction).where(
        FinanceTransaction.kind == "expense",
        FinanceTransaction.created_at >= range_start,
        FinanceTransaction.created_at < range_end,
    )
    rows = list(db.execute(stmt).scalars().all())
    sums: dict[str, float] = defaultdict(float)
    for r in rows:
        cat = (r.category or "").strip() or "Uncategorized"
        sums[cat] += float(r.amount)
    return dict(sums)


def run_behavior_pattern_engine(
    db: Session, range_start: datetime, range_end: datetime
) -> list[dict[str, Any]]:
    if range_end <= range_start:
        return []

    span_days = (range_end - range_start).total_seconds() / 86_400.0

    stmt = (
        select(Event)
        .where(Event.created_at >= range_start, Event.created_at < range_end)
        .order_by(Event.created_at.asc())
        .limit(8000)
    )
    events = list(db.execute(stmt).scalars().all())
    task_by_day, focus_days = _aggregate_events(events)

    health_by_day = _load_snapshots_health_by_day(db, range_start, range_end)
    expense_totals = _load_expense_totals_by_category(db, range_start, range_end)

    patterns: list[dict[str, Any]] = []
    p1 = detect_focus_productivity_pattern(task_by_day, focus_days)
    if p1:
        patterns.append(p1)

    task_for_cleaning = {d: task_by_day.get(d, 0) for d in health_by_day}
    p2 = detect_cleaning_productivity_pattern(task_for_cleaning, health_by_day)
    if p2:
        patterns.append(p2)

    p3 = detect_spending_top_category_pattern(expense_totals, span_days)
    if p3:
        patterns.append(p3)

    patterns.sort(key=lambda x: float(x.get("confidence", 0)), reverse=True)
    return patterns
