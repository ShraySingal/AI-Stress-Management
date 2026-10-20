"""
Core tracker routes: mood, stress, sleep, activity.
Each tracker supports CRUD operations scoped to the authenticated user.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.config import MOOD_LABELS, risk_level
from backend.schemas.api import (
    MoodEntryCreate, MoodEntryResponse,
    StressAssessmentCreate, StressAssessmentResponse,
    SleepRecordCreate, SleepRecordResponse,
    ActivityRecordCreate,
)

router = APIRouter(tags=["trackers"])


# ══════════════════════════════════════════════════════════
# MOOD
# ══════════════════════════════════════════════════════════
@router.post("/mood", status_code=201)
def create_mood(req: MoodEntryCreate, user_id: str = Depends(get_current_user)):
    """Log a mood entry."""
    entry_id = str(uuid.uuid4())
    entry_date = req.entry_date or date.today().isoformat()
    mood_label = MOOD_LABELS.get(req.mood_score, "neutral")
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        db.execute(
            """INSERT INTO mood_entries (id, user_id, entry_date, mood_score, mood_label,
                                        emotions, activities, triggers, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (entry_id, user_id, entry_date, req.mood_score, mood_label,
             req.emotions, req.activities, req.triggers, req.note, now)
        )
    return {"id": entry_id, "mood_label": mood_label, "entry_date": entry_date}


@router.get("/mood")
def list_mood(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user)
):
    """Get mood entries for the last N days."""
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM mood_entries WHERE user_id = ?
               AND entry_date >= date('now', ?)
               ORDER BY entry_date DESC""",
            (user_id, f"-{days} days")
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/mood/{entry_id}")
def get_mood(entry_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific mood entry."""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM mood_entries WHERE id = ? AND user_id = ?",
            (entry_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Mood entry not found")
        return dict(row)


@router.delete("/mood/{entry_id}")
def delete_mood(entry_id: str, user_id: str = Depends(get_current_user)):
    """Delete a mood entry."""
    with get_db() as db:
        result = db.execute(
            "DELETE FROM mood_entries WHERE id = ? AND user_id = ?", (entry_id, user_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Mood entry not found")
    return {"message": "Deleted"}


# ══════════════════════════════════════════════════════════
# STRESS ASSESSMENT
# ══════════════════════════════════════════════════════════
@router.post("/stress", status_code=201)
def create_stress(req: StressAssessmentCreate, user_id: str = Depends(get_current_user)):
    """Submit a stress assessment."""
    entry_id = str(uuid.uuid4())
    assessment_date = req.assessment_date or date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # Compute composite stress score from questions (weighted average × 20)
    questions = [req.q_stress, req.q_sleep_quality, req.q_energy,
                 req.q_concentration_difficulty, req.q_workload,
                 req.q_social_connection, req.q_physical_activity,
                 req.q_anxious_overwhelmed]
    valid_q = [q for q in questions if q is not None]
    if not valid_q:
        raise HTTPException(status_code=400, detail="At least one question must be answered")

    # Higher q_stress, q_concentration_difficulty, q_workload, q_anxious_overwhelmed = more stress
    # Lower q_sleep_quality, q_energy, q_social_connection, q_physical_activity = more stress
    stress_increasing = [req.q_stress, req.q_concentration_difficulty, req.q_workload, req.q_anxious_overwhelmed]
    stress_decreasing = [req.q_sleep_quality, req.q_energy, req.q_social_connection, req.q_physical_activity]

    inc = [q for q in stress_increasing if q is not None]
    dec = [q for q in stress_decreasing if q is not None]

    inc_score = (sum(inc) / len(inc) / 5 * 100) if inc else 50
    dec_score = ((5 - sum(dec) / len(dec)) / 5 * 100) if dec else 50
    stress_score = int(min(100, max(0, (inc_score * 0.6 + dec_score * 0.4))))
    stress_lvl = risk_level(stress_score)

    with get_db() as db:
        db.execute(
            """INSERT INTO stress_assessments (id, user_id, assessment_date,
                q_stress, q_sleep_quality, q_energy, q_concentration_difficulty,
                q_workload, q_social_connection, q_physical_activity, q_anxious_overwhelmed,
                stress_score, stress_level, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (entry_id, user_id, assessment_date,
             req.q_stress, req.q_sleep_quality, req.q_energy, req.q_concentration_difficulty,
             req.q_workload, req.q_social_connection, req.q_physical_activity, req.q_anxious_overwhelmed,
             stress_score, stress_lvl, now)
        )
    return {"id": entry_id, "stress_score": stress_score, "stress_level": stress_lvl}


@router.get("/stress")
def list_stress(days: int = Query(30, ge=1, le=365), user_id: str = Depends(get_current_user)):
    """Get stress assessments for the last N days."""
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM stress_assessments WHERE user_id = ?
               AND assessment_date >= date('now', ?)
               ORDER BY assessment_date DESC""",
            (user_id, f"-{days} days")
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/stress/{entry_id}")
def get_stress(entry_id: str, user_id: str = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM stress_assessments WHERE id = ? AND user_id = ?",
            (entry_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return dict(row)


# ══════════════════════════════════════════════════════════
# SLEEP
# ══════════════════════════════════════════════════════════
@router.post("/sleep", status_code=201)
def create_sleep(req: SleepRecordCreate, user_id: str = Depends(get_current_user)):
    """Log a sleep record."""
    entry_id = str(uuid.uuid4())
    sleep_date = req.sleep_date or date.today().isoformat()

    with get_db() as db:
        db.execute(
            """INSERT INTO sleep_records (id, user_id, sleep_date, bedtime, wake_time,
                                          duration_hours, quality, awakenings, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')""",
            (entry_id, user_id, sleep_date, req.bedtime, req.wake_time,
             req.duration_hours, req.quality, req.awakenings)
        )
    return {"id": entry_id, "sleep_date": sleep_date}


@router.get("/sleep")
def list_sleep(days: int = Query(30, ge=1, le=365), user_id: str = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM sleep_records WHERE user_id = ?
               AND sleep_date >= date('now', ?)
               ORDER BY sleep_date DESC""",
            (user_id, f"-{days} days")
        ).fetchall()
        return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════
# ACTIVITY
# ══════════════════════════════════════════════════════════
@router.post("/activity", status_code=201)
def create_activity(req: ActivityRecordCreate, user_id: str = Depends(get_current_user)):
    """Log an activity record."""
    entry_id = str(uuid.uuid4())
    activity_date = req.activity_date or date.today().isoformat()

    with get_db() as db:
        db.execute(
            """INSERT INTO activity_records (id, user_id, activity_date, steps, active_minutes,
                                              calories_burned, distance_km, exercise_type, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'phone')""",
            (entry_id, user_id, activity_date, req.steps, req.active_minutes,
             req.calories_burned, req.distance_km, req.exercise_type)
        )
    return {"id": entry_id, "activity_date": activity_date}


@router.get("/activity")
def list_activity(days: int = Query(30, ge=1, le=365), user_id: str = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM activity_records WHERE user_id = ?
               AND activity_date >= date('now', ?)
               ORDER BY activity_date DESC""",
            (user_id, f"-{days} days")
        ).fetchall()
        return [dict(r) for r in rows]
