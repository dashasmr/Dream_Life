from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app


def test_create_event_endpoint(monkeypatch):
    def fake_create_event(_db, payload):
        return SimpleNamespace(
            id="evt-1",
            type=payload.type,
            source=payload.source,
            payload=payload.payload,
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr("app.routers.events.create_event", fake_create_event)

    client = TestClient(app)
    response = client.post(
        "/events",
        json={"type": "work_started", "source": "web", "payload": {"note": "test"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "work_started"
    assert body["source"] == "web"
    assert body["payload"]["note"] == "test"


def test_list_events_endpoint(monkeypatch):
    fake_events = [
        SimpleNamespace(
            id="evt-2",
            type="cleaning_done",
            source="iot",
            payload={"room": "kitchen"},
            created_at=datetime.now(timezone.utc),
        )
    ]

    monkeypatch.setattr("app.routers.events.list_events", lambda *_args, **_kwargs: fake_events)

    client = TestClient(app)
    response = client.get("/events?limit=10&offset=0")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["type"] == "cleaning_done"
