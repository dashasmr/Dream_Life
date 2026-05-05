from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models import Event
from app.schemas import EventCreate


def create_event(db: Session, data: EventCreate) -> Event:
    event = Event(type=data.type, source=data.source, payload=data.payload)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(db: Session, limit: int = 50, offset: int = 0, event_type: str | None = None) -> list[Event]:
    stmt = select(Event).order_by(desc(Event.created_at)).offset(offset).limit(limit)
    if event_type:
        stmt = stmt.where(Event.type == event_type)
    return list(db.execute(stmt).scalars().all())
