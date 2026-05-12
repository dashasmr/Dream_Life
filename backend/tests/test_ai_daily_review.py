from datetime import date, datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app


def test_post_daily_review_returns_structured_payload(monkeypatch):
    ctx = {
        "date": "2026-05-12",
        "dailyStats": {
            "tasksCompleted": 1,
            "focusMinutes": 30,
            "cleaningActions": 0,
            "expensesTotal": 0.0,
        },
        "systemStatus": [],
        "timelineSummary": [],
        "topTasks": [],
        "overdueCleaningZones": [],
        "financeSummary": {"income_total": 0.0, "expense_total": 0.0, "balance_delta": 0.0},
        "financeMonth": {"income_total": 0.0, "expense_total": 0.0, "balance_delta": 0.0},
        "behaviorPatterns": [],
        "riskSignals": [],
        "ruleBasedHints": [],
    }

    def fake_context(_db, target_date: date):
        assert target_date == date(2026, 5, 12)
        return ctx

    def fake_review(_context):
        return (
            {
                "date": _context["date"],
                "title": "Test review",
                "summary": "Summary line.",
                "wins": ["Win one"],
                "concerns": ["Concern one"],
                "tomorrowPlan": ["Step A", "Step B"],
                "fallback": True,
            },
            True,
        )

    monkeypatch.setattr("app.routers.ai.build_daily_ai_context", fake_context)
    monkeypatch.setattr("app.routers.ai.build_daily_review", fake_review)
    monkeypatch.setattr("app.routers.ai.get_ai_review_by_date", lambda _db, _d: None)

    def fake_upsert(_db, **kwargs):
        return SimpleNamespace(
            id="rid-1",
            review_date=kwargs["review_date"],
            title=kwargs["title"],
            summary=kwargs["summary"],
            wins=kwargs["wins"],
            concerns=kwargs["concerns"],
            tomorrow_plan=kwargs["tomorrow_plan"],
            fallback=kwargs["fallback"],
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr("app.routers.ai.upsert_ai_review", fake_upsert)

    client = TestClient(app)
    res = client.post("/ai/daily-review", json={"date": "2026-05-12"})
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Test review"
    assert body["summary"] == "Summary line."
    assert body["wins"] == ["Win one"]
    assert body["concerns"] == ["Concern one"]
    assert body["tomorrowPlan"] == ["Step A", "Step B"]
    assert body["fallback"] is True
    assert body["from_storage"] is False
    assert body["id"] == "rid-1"


def test_post_daily_review_returns_cached_without_regenerate(monkeypatch):
    stored = SimpleNamespace(
        id="cached",
        review_date=date(2026, 5, 10),
        title="Old",
        summary="Cached body.",
        wins=["w"],
        concerns=["c"],
        tomorrow_plan=["t"],
        fallback=False,
        created_at=datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc),
    )
    monkeypatch.setattr("app.routers.ai.get_ai_review_by_date", lambda _db, d: stored if d == date(2026, 5, 10) else None)
    gen_called = {"n": 0}

    def nope_context(*_a, **_k):
        gen_called["n"] += 1
        raise AssertionError("should not generate when cached")

    monkeypatch.setattr("app.routers.ai.build_daily_ai_context", nope_context)

    client = TestClient(app)
    res = client.post("/ai/daily-review", json={"date": "2026-05-10"})
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Old"
    assert body["from_storage"] is True
    assert gen_called["n"] == 0
