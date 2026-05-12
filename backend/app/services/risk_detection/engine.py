"""
Aggregates DB state for [range_start, range_end) and runs risk detectors.
Short-horizon signals use the last 7–14 UTC days ending at range_end.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import list_cleaning_zones
from app.models import DailySnapshot, Event, FinanceTransaction
from app.services.risk_detection.detectors import (
    detect_burnout_risk,
    detect_environment_decline_risk,
    detect_financial_drift_risk,
    detect_productivity_focus_drop_risk,
)


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


def _utc_date(ev: Event) -> date | None:
    if ev.created_at is None:
        return None
    return ev.created_at.astimezone(timezone.utc).date()


def _rollup_days_from_events(events: list[Event]) -> tuple[dict[date, int], dict[date, int]]:
    tasks: dict[date, int] = defaultdict(int)
    focus_min: dict[date, int] = defaultdict(int)
    focus_sec_by_day: dict[date, float] = defaultdict(float)

    for e in events:
        d = _utc_date(e)
        if d is None:
            continue
        if e.type == "task_completed":
            tasks[d] += 1
        if e.type in ("focus_ended", "focus_session_completed"):
            sec = _focus_seconds_from_event(e)
            if sec > 0:
                focus_sec_by_day[d] += sec

    for d, sec in focus_sec_by_day.items():
        focus_min[d] = max(0, int(round(sec / 60.0)))

    return dict(tasks), dict(focus_min)


def _last_n_utc_days_sequence(anchor: date, n: int) -> list[date]:
    return [anchor - timedelta(days=(n - 1 - i)) for i in range(n)]


def run_risk_detection_engine(
    db: Session, range_start: datetime, range_end: datetime
) -> list[dict[str, Any]]:
    if range_end <= range_start:
        return []

    detected_at = datetime.now(timezone.utc).isoformat()
    deep_start = max(range_start, range_end - timedelta(days=14))

    stmt = (
        select(Event)
        .where(Event.created_at >= deep_start, Event.created_at < range_end)
        .order_by(Event.created_at.asc())
        .limit(8000)
    )
    events = list(db.execute(stmt).scalars().all())
    task_by_day, focus_min_by_day = _rollup_days_from_events(events)

    anchor_day = (range_end - timedelta(seconds=1)).astimezone(timezone.utc).date()
    day_seq_7 = _last_n_utc_days_sequence(anchor_day, 7)

    pomos_7d = sum(
        1
        for e in events
        if e.type == "pomodoro_completed"
        and e.created_at is not None
        and e.created_at.astimezone(timezone.utc).date() in set(day_seq_7)
    )

    zones = list_cleaning_zones(db)
    overdue_n = sum(1 for z in zones if z.get("status") == "overdue")

    start_d = deep_start.astimezone(timezone.utc).date()
    end_d = range_end.astimezone(timezone.utc).date()
    snap_stmt = (
        select(DailySnapshot)
        .where(DailySnapshot.snapshot_date >= start_d, DailySnapshot.snapshot_date < end_d)
        .order_by(DailySnapshot.snapshot_date.asc())
    )
    snaps = list(db.execute(snap_stmt).scalars().all())
    snap_focus_series = [int(s.focus_minutes) for s in snaps]

    # Event-based focus minutes per day (fallback / supplement) for last 7d series if snapshots sparse
    event_focus_7 = [focus_min_by_day.get(d, 0) for d in day_seq_7]
    focus_series_for_trend = snap_focus_series if len(snap_focus_series) >= 5 else event_focus_7

    fin_stmt = select(FinanceTransaction).where(
        FinanceTransaction.kind == "expense",
        FinanceTransaction.created_at >= deep_start,
        FinanceTransaction.created_at < range_end,
    )
    fin_rows = list(db.execute(fin_stmt).scalars().all())
    exp_by_day: dict[date, float] = defaultdict(float)
    for r in fin_rows:
        if r.created_at is None:
            continue
        exp_by_day[r.created_at.astimezone(timezone.utc).date()] += float(r.amount)

    def sum_exp_days(days: list[date]) -> float:
        return sum(exp_by_day.get(d, 0.0) for d in days)

    last7_days = _last_n_utc_days_sequence(anchor_day, 7)
    prev7_days = _last_n_utc_days_sequence(anchor_day - timedelta(days=7), 7)
    expense_last7 = sum_exp_days(last7_days)
    expense_prev7 = sum_exp_days(prev7_days)

    out: list[dict[str, Any]] = []

    b = detect_burnout_risk(
        task_by_day=task_by_day,
        focus_minutes_by_day=focus_min_by_day,
        pomodoro_count_7d=pomos_7d,
        day_sequence=day_seq_7,
        detected_at=detected_at,
    )
    if b:
        out.append(b)

    e = detect_environment_decline_risk(overdue_zone_count=overdue_n, detected_at=detected_at)
    if e:
        out.append(e)

    p = detect_productivity_focus_drop_risk(
        focus_minutes_series=focus_series_for_trend,
        detected_at=detected_at,
    )
    if p:
        out.append(p)

    f = detect_financial_drift_risk(
        expense_last7=expense_last7,
        expense_prev7=expense_prev7,
        detected_at=detected_at,
    )
    if f:
        out.append(f)

    sev_rank = {"high": 3, "medium": 2, "low": 1}
    out.sort(key=lambda x: sev_rank.get(str(x.get("severity")), 0), reverse=True)
    return out
