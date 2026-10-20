"""
Application configuration and constants.
"""
import os
from datetime import timedelta

# ── Server ──────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")

# ── Auth ────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "capstone-dev-secret-change-in-prod-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)

# ── Risk Thresholds ─────────────────────────────────────
RISK_THRESHOLDS = {
    "low": (0, 30),
    "moderate": (31, 60),
    "elevated": (61, 80),
    "high": (81, 100),
}

def risk_level(score: int) -> str:
    """Map a 0-100 score to a risk level string."""
    if score <= 30:
        return "low"
    elif score <= 60:
        return "moderate"
    elif score <= 80:
        return "elevated"
    return "high"

# ── Mood ────────────────────────────────────────────────
MOOD_LABELS = {1: "very_low", 2: "low", 3: "neutral", 4: "good", 5: "excellent"}

# ── CORS ────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500").split(",")

# ── Dataset ─────────────────────────────────────────────
DATASET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset")
MODEL_PATH = os.path.join(DATASET_DIR, "best_model.joblib")
