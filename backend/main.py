"""
STYLEintel — FastAPI Backend
Run:  uvicorn main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from models import init_db
from routers import garments_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="STYLEintel API",
    description="Fashion Garment Classification & Inspiration Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────
# Allow the frontend (served from file:// or a dev server) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API routes ──────────────────────────────────
app.include_router(garments_router, prefix="/api")

# ─── Serve frontend static files ─────────────────
# The HTML/CSS/JS lives one directory up from backend/.
# Mounting at "/" with html=True serves index.html for "/"
# and resolves bare relative paths (styles.css, app.js) correctly.
# API routes registered above take priority over this catch-all mount.
FRONTEND_DIR = Path(__file__).parent.parent
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# ─── Health check ────────────────────────────────
@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "STYLEintel API"}
