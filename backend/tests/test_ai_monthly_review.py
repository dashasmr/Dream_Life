from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app


def test_post_monthly_review_returns_structured_payload(monkeypatch):
    ctx = {
        "monthLabel": "May 2026",
        "monthRange": {"from": "", "to": ""},
        "monthStats": {
            "tasksCompleted": 5,
            "focusMinutes": 200,
            "cleaningActions": 2,
            "expensesTotal": 10.0,
        },
        "financeMonth": {"income_total": 100.0, "expense_total": 40.0, "balance_delta": 60.0},
        "topExpenseCategory": "Food",
        "topExpenseAmount": 25.0,
        "mostProductiveDayLabel": "2026-05-07",
        "overdueCleaningZones": [],
        "cleaningZonesOverdueCount": 0,
        "currentHomeHealthPercent": 80,
        "behaviorPatterns": [],
        "riskSignals": [],
        "ruleBasedHints": [],
    }

    def fake_context(_db, month_start: datetime, month_end: datetime):
        assert month_start.tzinfo is not None
        assert month_end > month_start
        return ctx

    def fake_review(_context):
        return (
            {
                "monthLabel": "May 2026",
                "title": "Month test",
                "summary": "Summary.",
                "wins": ["W1"],
                "risks": ["R1"],
                "patterns": ["P1"],
                "nextMonthFocus": ["N1"],
                "fallback": True,
            },
            True,
        )

    monkeypatch.setattr("app.routers.ai.build_monthly_ai_context", fake_context)
    monkeypatch.setattr("app.routers.ai.build_monthly_review", fake_review)

    client = TestClient(app)
    start = datetime(2026, 5, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    end = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    res = client.post("/ai/monthly-review", json={"monthFrom": start, "monthTo": end})
    assert res.status_code == 200
    body = res.json()
    assert body["monthLabel"] == "May 2026"
    assert body["title"] == "Month test"
    assert body["summary"] == "Summary."
    assert body["wins"] == ["W1"]
    assert body["risks"] == ["R1"]
    assert body["patterns"] == ["P1"]
    assert body["nextMonthFocus"] == ["N1"]
    assert body["fallback"] is True


def test_post_monthly_review_rejects_inverted_range(monkeypatch):
    monkeypatch.setattr(
        "app.routers.ai.build_monthly_ai_context",
        lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no")),
    )

    client = TestClient(app)
    start = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    end = datetime(2026, 5, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    res = client.post("/ai/monthly-review", json={"monthFrom": start, "monthTo": end})
    assert res.status_code == 400
