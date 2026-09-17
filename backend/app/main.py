from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine

app = FastAPI(
    title="Stockali API",
    description="Shared services + B2C/B2B APIs for the Stockali platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


from app.routers import catalogue, users, retailers, inventory, search, auth, shopping, notifications, insights

app.include_router(auth.router)
app.include_router(catalogue.router, prefix="/catalogue", tags=["catalogue"])
app.include_router(users.router)
app.include_router(search.router)
app.include_router(shopping.router)
app.include_router(notifications.router)
app.include_router(insights.router)
app.include_router(retailers.router)
app.include_router(inventory.router)



