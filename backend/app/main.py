from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

app = FastAPI(
    title="Stockali API",
    description="Shared services + B2C/B2B APIs for the Stockali platform",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    """Basic liveness check — does not touch the database."""
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    """Confirms the backend can actually reach Postgres (and PostGIS is enabled)."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        postgis_version = conn.execute(text("SELECT PostGIS_Version()")).scalar()
    return {"status": "ok", "postgis_version": postgis_version}


from app.routers import catalogue

app.include_router(catalogue.router, prefix="/catalogue", tags=["catalogue"])
