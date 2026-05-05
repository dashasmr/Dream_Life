from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


EventType = Literal["work_started", "task_completed", "expense_added", "cleaning_done"]
EventSource = Literal["web", "iot", "system"]


class EventCreate(BaseModel):
    type: EventType
    source: EventSource = "web"
    payload: dict[str, Any] = Field(default_factory=dict)


class EventRead(BaseModel):
    id: str
    type: str
    source: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
