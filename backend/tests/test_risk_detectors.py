from datetime import date

from app.services.risk_detection.detectors import (
    detect_burnout_risk,
    detect_environment_decline_risk,
    detect_financial_drift_risk,
    detect_productivity_focus_drop_risk,
)


def test_environment_medium_when_two_overdue():
    out = detect_environment_decline_risk(overdue_zone_count=2, detected_at="2026-05-12T12:00:00+00:00")
    assert out is not None
    assert out["severity"] == "medium"
    assert out["category"] == "environment"


def test_financial_drift_when_spend_spike():
    out = detect_financial_drift_risk(
        expense_last7=200.0, expense_prev7=80.0, detected_at="2026-05-12T12:00:00+00:00"
    )
    assert out is not None
    assert out["category"] == "finance"
    assert out["severity"] in ("medium", "high")


def test_focus_drop_strict_decline():
    series = [60, 55, 40, 28, 18, 12, 8]
    out = detect_productivity_focus_drop_risk(
        focus_minutes_series=series, detected_at="2026-05-12T12:00:00+00:00"
    )
    assert out is not None
    assert out["severity"] == "high"


def test_burnout_when_overloaded():
    ds = [date(2026, 5, d) for d in range(6, 13)]
    task_by_day = {ds[0]: 6, ds[1]: 6, ds[2]: 6, ds[3]: 6, ds[4]: 3, ds[5]: 3, ds[6]: 3}
    focus_min = {d: 4 for d in ds}
    out = detect_burnout_risk(
        task_by_day=task_by_day,
        focus_minutes_by_day=focus_min,
        pomodoro_count_7d=0,
        day_sequence=ds,
        detected_at="2026-05-12T12:00:00+00:00",
    )
    assert out is not None
    assert out["id"] == "burnout_load_v1"
