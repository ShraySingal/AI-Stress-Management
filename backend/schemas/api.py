"""
Pydantic schemas for API request/response validation.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import date, datetime


# ══════════════════════════════════════════════════════════
# Auth
# ══════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1)
    age: Optional[int] = Field(None, ge=13, le=120)
    gender: Optional[str] = None
    occupation: Optional[str] = None
    country_code: Optional[str] = "IN"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str

class RefreshRequest(BaseModel):
    refresh_token: str

class PasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5)

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


# ══════════════════════════════════════════════════════════
# User / Preferences
# ══════════════════════════════════════════════════════════
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    country_code: Optional[str] = None
    created_at: Optional[str] = None

class UserPreferencesUpdate(BaseModel):
    wellness_goal: Optional[str] = None
    stress_sources: Optional[str] = None
    typical_bedtime: Optional[str] = None
    typical_wake_time: Optional[str] = None
    activity_level: Optional[str] = None
    theme: Optional[str] = None
    mood_reminder_time: Optional[str] = None
    notifications_enabled: Optional[bool] = None

class PrivacySettingsUpdate(BaseModel):
    wearable_access: Optional[bool] = None
    ai_personalization: Optional[bool] = None
    chat_data_retention_days: Optional[int] = None
    allow_anonymous_analytics: Optional[bool] = None


# ══════════════════════════════════════════════════════════
# Mood
# ══════════════════════════════════════════════════════════
class MoodEntryCreate(BaseModel):
    mood_score: int = Field(..., ge=1, le=10)
    emotions: Optional[str] = None
    activities: Optional[str] = None
    triggers: Optional[str] = None
    note: Optional[str] = None
    entry_date: Optional[str] = None  # ISO date string

class MoodEntryResponse(BaseModel):
    id: str
    user_id: str
    entry_date: str
    mood_score: int
    mood_label: str
    emotions: Optional[str] = None
    activities: Optional[str] = None
    triggers: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[str] = None


# ══════════════════════════════════════════════════════════
# Stress Assessment
# ══════════════════════════════════════════════════════════
class StressAssessmentCreate(BaseModel):
    q_stress: int = Field(..., ge=1, le=5)
    q_sleep_quality: Optional[int] = Field(None, ge=1, le=5)
    q_energy: Optional[int] = Field(None, ge=1, le=5)
    q_concentration_difficulty: Optional[int] = Field(None, ge=1, le=5)
    q_workload: Optional[int] = Field(None, ge=1, le=5)
    q_social_connection: Optional[int] = Field(None, ge=1, le=5)
    q_physical_activity: Optional[int] = Field(None, ge=1, le=5)
    q_anxious_overwhelmed: Optional[int] = Field(None, ge=1, le=5)
    assessment_date: Optional[str] = None

class StressAssessmentResponse(BaseModel):
    id: str
    user_id: str
    assessment_date: str
    stress_score: int
    stress_level: str
    q_stress: Optional[int] = None
    q_sleep_quality: Optional[int] = None
    q_energy: Optional[int] = None
    created_at: Optional[str] = None


# ══════════════════════════════════════════════════════════
# Sleep
# ══════════════════════════════════════════════════════════
class SleepRecordCreate(BaseModel):
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    duration_hours: Optional[float] = Field(None, ge=0, le=24)
    quality: Optional[int] = Field(None, ge=1, le=5)
    awakenings: Optional[int] = Field(0, ge=0)
    sleep_date: Optional[str] = None

class SleepRecordResponse(BaseModel):
    id: str
    user_id: str
    sleep_date: str
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    duration_hours: Optional[float] = None
    quality: Optional[int] = None
    consistency_score: Optional[float] = None
    source: str = "manual"


# ══════════════════════════════════════════════════════════
# Activity
# ══════════════════════════════════════════════════════════
class ActivityRecordCreate(BaseModel):
    steps: Optional[int] = Field(0, ge=0)
    active_minutes: Optional[int] = Field(0, ge=0)
    calories_burned: Optional[int] = Field(0, ge=0)
    distance_km: Optional[float] = Field(0, ge=0)
    exercise_type: Optional[str] = None
    activity_date: Optional[str] = None


# ══════════════════════════════════════════════════════════
# Habits
# ══════════════════════════════════════════════════════════
class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1)
    category: Optional[str] = None
    target_days_per_week: int = Field(7, ge=1, le=7)
    reminder_time: Optional[str] = None

class HabitLogCreate(BaseModel):
    habit_id: str
    completed: bool = True
    log_date: Optional[str] = None


# ══════════════════════════════════════════════════════════
# Dashboard
# ══════════════════════════════════════════════════════════
class DashboardResponse(BaseModel):
    user_name: str
    today_mood: Optional[int] = None
    today_stress: Optional[int] = None
    today_sleep: Optional[float] = None
    today_steps: Optional[int] = None
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    streak_days: int = 0
    habit_completion: Optional[float] = None
    mood_trend: List[dict] = []
    stress_trend: List[dict] = []
    sleep_trend: List[dict] = []
    recommendations: List[dict] = []


# ══════════════════════════════════════════════════════════
# Predictions
# ══════════════════════════════════════════════════════════
class PredictionResponse(BaseModel):
    id: str
    risk_score: int
    risk_level: str
    confidence: Optional[float] = None
    prediction_date: str
    target_date: str
    factors: List[dict] = []
    model_name: Optional[str] = None
    warning: str = "This is an estimate based on recent patterns, not a diagnosis."


# ══════════════════════════════════════════════════════════
# Analytics
# ══════════════════════════════════════════════════════════
class AnalyticsResponse(BaseModel):
    period: str  # "7d", "30d", "90d"
    mood_series: List[dict] = []
    stress_series: List[dict] = []
    sleep_series: List[dict] = []
    activity_series: List[dict] = []
    averages: dict = {}
    correlations: dict = {}
