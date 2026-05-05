from fastapi import FastAPI

from app.routers.events import router as events_router
from app.routers.iot import router as iot_router

app = FastAPI(title="Life OS API", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(events_router)
app.include_router(iot_router)
