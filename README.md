# Stockali — Phase 0 Starter

This is the Phase 0 scaffold for Stockali: repo structure, local dev environment,
initial database schema, and an ML workspace with dataset setup instructions.
Hand this whole folder to Antigravity (or open it in your editor of choice) as
the starting point — it's deliberately minimal so the agent has room to build
inside a structure that already matches the system design in the project report.

## Folder structure

```
stockali-starter/
├── docker-compose.yml        # Postgres+PostGIS, Redis, backend, spun up together
├── .env.example               # copy to .env and fill in
├── backend/                   # FastAPI backend (shared services + B2C/B2B APIs)
│   ├── app/
│   │   ├── main.py             # app entrypoint, health check, DB connection test
│   │   ├── database.py         # SQLAlchemy engine/session setup
│   │   ├── models/              # SQLAlchemy models go here (one file per entity group)
│   │   └── routers/             # API route modules (auth, catalogue, inventory, ...)
│   ├── requirements.txt
│   └── Dockerfile
├── database/
│   └── schema.sql              # Initial Core-release schema (PostgreSQL + PostGIS)
├── ml/
│   ├── README.md               # Dataset options + setup instructions
│   └── notebooks/               # EDA and baseline model notebooks go here
├── frontend-customer/          # React/Next.js customer app (scaffold with Antigravity)
└── frontend-retailer/          # React/Next.js retailer portal (scaffold with Antigravity)
```

## Getting started

1. **Install Docker Desktop** (if not already installed).
2. Copy `.env.example` to `.env` and fill in values (defaults work for local dev).
3. From this folder, run:
   ```
   docker compose up -d
   ```
   This starts Postgres (with PostGIS enabled) and Redis, and builds/runs the backend.
4. Load the initial schema:
   ```
   docker exec -i stockali-db psql -U stockali -d stockali < database/schema.sql
   ```
5. Check the backend is alive: open `http://localhost:8000/health` — should return `{"status": "ok"}`.
6. Backend interactive API docs: `http://localhost:8000/docs` (FastAPI auto-generates this).

## Using Supabase instead of local Postgres (recommended once you're past local dev)

Create a free Supabase project, enable the PostGIS extension in the SQL editor
(`create extension if not exists postgis;`), then run `database/schema.sql`
there instead. Point `DATABASE_URL` in `.env` at your Supabase connection string.
This is the path for anything you want a teammate or your mentor to access
without running Docker locally.

## Next steps (rest of Phase 0)

- [ ] Everyone clones the repo, gets `docker compose up` working locally
- [ ] Review `database/schema.sql` together — this is the Core-release schema from
      the project report; adjust field names now before code gets built on top of it
- [ ] Agree on the API contract for the first few endpoints (auth, product search,
      nearby-store search) before frontend and backend work start in parallel
- [ ] ML track: follow `ml/README.md` to get a dataset and start baseline EDA
- [ ] Set up the two frontend apps (`frontend-customer`, `frontend-retailer`) —
      point Antigravity at the API contract once it's agreed
