"""
Pydantic schemas for the ML prediction service.
Strict validation with ranges matching the training data.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class PredictionInput(BaseModel):
    """Feature vector for next-day stress risk prediction."""
    user_id: str
    mood_score: Optional[float] = Field(None, ge=1, le=5, description="1-5 mood score")
    stress_score: Optional[float] = Field(None, ge=0, le=100, description="0-100 stress score")
    sleep_duration: Optional[float] = Field(None, ge=0, le=24, description="Hours slept")
    sleep_quality: Optional[float] = Field(None, ge=1, le=5, description="1-5 sleep quality")
    steps: Optional[float] = Field(None, ge=0, le=50000, description="Daily step count")
    active_minutes: Optional[float] = Field(None, ge=0, le=1440, description="Active minutes")
    resting_hr: Optional[float] = Field(None, ge=30, le=120, description="Resting heart rate (bpm)")
    hrv: Optional[float] = Field(None, ge=5, le=200, description="Heart rate variability (ms)")
    habit_completion: Optional[float] = Field(None, ge=0, le=1, description="Habit completion rate 0-1")
    previous_stress: Optional[float] = Field(None, ge=0, le=100, description="Previous day stress")
    stress_3d_mean: Optional[float] = Field(None, ge=0, le=100, description="3-day stress average")
    stress_7d_mean: Optional[float] = Field(None, ge=0, le=100, description="7-day stress average")
    mood_3d_mean: Optional[float] = Field(None, ge=1, le=5, description="3-day mood average")
    sleep_3d_mean: Optional[float] = Field(None, ge=0, le=24, description="3-day sleep average")
    sleep_7d_std: Optional[float] = Field(None, ge=0, le=10, description="7-day sleep std dev")
    steps_7d_mean: Optional[float] = Field(None, ge=0, le=50000, description="7-day step average")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="0=Mon, 6=Sun")
    is_weekend: Optional[int] = Field(None, ge=0, le=1, description="Weekend flag")
    has_wearable: Optional[int] = Field(None, ge=0, le=1, description="Has wearable device")


class FactorImpact(BaseModel):
    """One contributing factor to the risk prediction."""
    factor_name: str
    impact_pct: float
    direction: str  # "increases_risk" or "reduces_risk"


class PredictionOutput(BaseModel):
    """Prediction response with risk score and explanations."""
    user_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    confidence: float
    prediction_window: str = "next_day"
    factors: List[FactorImpact]
    model_name: str
    model_version: str
    warning: str = "This is an estimate based on recent patterns, not a diagnosis."


class ModelInfo(BaseModel):
    """Metadata about the loaded model."""
    model_name: str
    model_version: str
    features: List[str]
    target: str
    risk_thresholds: dict
    status: str


class HealthCheck(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    version: str
