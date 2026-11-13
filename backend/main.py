"""
Main FastAPI Application Entrypoint for Stress & Mental Health Tracker.
"""

from contextlib import asynccontextmanager
import logging

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import init_db
from backend.routes import auth, users, trackers, dashboard, predictions, habits

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization on startup."""
    logger.info("Initializing database tables...")
    init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Shutting down application...")


app = FastAPI(
    title="MindPulse - Mental Health & Stress Analytics Platform",
    description="Backend API for multi-dimensional health tracking, stress prediction, and analytics.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(trackers.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(habits.router, prefix="/api")

# Mount Static Frontend Assets
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(FRONTEND_DIR):
    css_dir = os.path.join(FRONTEND_DIR, "css")
    js_dir = os.path.join(FRONTEND_DIR, "js")
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/")
def read_root():
    """Serve the frontend SPA with no-cache headers to prevent stale service worker caching."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {"message": "MindPulse API Service Running. Frontend index.html not found."}


@app.get("/favicon.ico")
def get_favicon():
    """Serve icon for browser tab."""
    icon_path = os.path.join(FRONTEND_DIR, "assets", "icon.svg")
    if os.path.exists(icon_path):
        return FileResponse(icon_path, media_type="image/svg+xml")
    return {"status": "no icon"}


@app.get("/manifest.webmanifest")
def get_manifest():
    """Serve PWA manifest."""
    manifest_path = os.path.join(FRONTEND_DIR, "manifest.webmanifest")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/manifest+json")
    return {}


@app.get("/sw.js")
def get_service_worker():
    """Serve service worker with no-cache headers."""
    sw_path = os.path.join(FRONTEND_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(
            sw_path,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {}


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "MindPulse API", "version": "1.0.0"}
