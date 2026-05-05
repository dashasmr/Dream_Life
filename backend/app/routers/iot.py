from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import create_event
from app.database import get_db
from app.schemas import EventCreate, EventRead

router = APIRouter(prefix="/iot", tags=["iot"])


@router.post("/button/work", response_model=EventRead, status_code=201)
def iot_work_button_endpoint(db: Session = Depends(get_db)):
    payload = EventCreate(
        type="work_started",
        source="iot",
        payload={"device": "esp32", "button": "work"},
    )
    return create_event(db, payload)


@router.post("/button/cleaning", response_model=EventRead, status_code=201)
def iot_cleaning_button_endpoint(db: Session = Depends(get_db)):
    payload = EventCreate(
        type="cleaning_done",
        source="iot",
        payload={"device": "esp32", "button": "cleaning"},
    )
    return create_event(db, payload)
