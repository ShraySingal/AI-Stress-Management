"""
Prediction and recommendation routes.
Triggers ML prediction, stores results, returns explanations.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.config import risk_level

router = APIRouter(tags=["predictions"])

# Recommendations keyed by factor name
RECS = {
    "Sleep": ("sleep", "Protect your sleep",
              "Try to keep your usual bedtime tonight and wind down 30 minutes earlier."),
    "Mood": ("mood", "Reflect on your mood",
             "Consider noting what may be contributing to your current mood."),
    "Activity": ("activity", "Take a short walk",
                 "A 10-15 minute walk can help. Light movement is enough."),
    "Stress Assessment": ("breathing", "Try a 5-minute breathing exercise",
                          "A short guided breathing session may help you reset."),
    "Heart Rate": ("break", "Take a short break",
                   "Your heart-rate pattern is a little elevated. Consider a relaxation break."),
    "Habits": ("habit", "Pick one small habit",
               "Choose one easy habit to complete today to rebuild your routine."),
}


@router.get("/predictions/latest")
def get_latest_prediction(user_id: str = Depends(get_current_user)):
    """Get the latest prediction with its factors and recommendations."""
    with get_db() as db:
        pred = db.execute(
            """SELECT * FROM predictions WHERE user_id = ?
               ORDER BY prediction_date DESC LIMIT 1""",
            (user_id,)
        ).fetchone()
        if not pred:
            return {"message": "No predictions yet. Complete a few check-ins first."}

        factors = db.execute(
            "SELECT * FROM prediction_factors WHERE prediction_id = ?",
            (pred["id"],)
        ).fetchall()

        recs = db.execute(
            """SELECT * FROM recommendations WHERE prediction_id = ?
               ORDER BY priority""",
            (pred["id"],)
        ).fetchall()

    return {
        "prediction": dict(pred),
        "factors": [dict(f) for f in factors],
        "recommendations": [dict(r) for r in recs],
        "warning": "This is an estimate based on recent patterns, not a diagnosis.",
    }


@router.get("/predictions/history")
def get_prediction_history(user_id: str = Depends(get_current_user)):
    """Get all predictions for the user."""
    with get_db() as db:
        rows = db.execute(
            """SELECT id, prediction_date, target_date, risk_score, risk_level, confidence, model_name
               FROM predictions WHERE user_id = ? ORDER BY prediction_date DESC LIMIT 90""",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/predictions/trigger")
@router.post("/predictions/evaluate")
def trigger_prediction(user_id: str = Depends(get_current_user)):
    """
    Trigger a new prediction based on the user's recent data.
    Gathers last 7 days of data, calls the ML service (or built-in predictor),
    and stores the result.
    """
    with get_db() as db:
        # Gather recent data
        today = date.today().isoformat()
        week_ago = (date.today() - timedelta(days=7)).isoformat()

        # Latest stress
        stress_row = db.execute(
            "SELECT stress_score FROM stress_assessments WHERE user_id = ? ORDER BY assessment_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Latest mood
        mood_row = db.execute(
            "SELECT mood_score FROM mood_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Latest sleep
        sleep_row = db.execute(
            "SELECT duration_hours, quality FROM sleep_records WHERE user_id = ? ORDER BY sleep_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Latest activity
        act_row = db.execute(
            "SELECT steps, active_minutes FROM activity_records WHERE user_id = ? ORDER BY activity_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Rolling averages
        stress_avg = db.execute(
            "SELECT AVG(stress_score) as v FROM stress_assessments WHERE user_id = ? AND assessment_date >= ?",
            (user_id, week_ago)
        ).fetchone()
        mood_avg = db.execute(
            "SELECT AVG(mood_score) as v FROM mood_entries WHERE user_id = ? AND entry_date >= ?",
            (user_id, week_ago)
        ).fetchone()
        sleep_avg = db.execute(
            "SELECT AVG(duration_hours) as v FROM sleep_records WHERE user_id = ? AND sleep_date >= ?",
            (user_id, week_ago)
        ).fetchone()
        steps_avg = db.execute(
            "SELECT AVG(steps) as v FROM activity_records WHERE user_id = ? AND activity_date >= ?",
            (user_id, week_ago)
        ).fetchone()

        # Habit completion
        habits = db.execute(
            """SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as done
               FROM habit_logs WHERE user_id = ? AND log_date >= ?""",
            (user_id, week_ago)
        ).fetchone()

        # Wearable data
        wearable = db.execute(
            "SELECT resting_hr, hrv_ms FROM wearable_data WHERE user_id = ? ORDER BY data_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        has_wearable = db.execute(
            "SELECT COUNT(*) as c FROM wearable_devices WHERE user_id = ? AND status = 'connected'",
            (user_id,)
        ).fetchone()

    if not stress_row and not mood_row:
        raise HTTPException(
            status_code=422,
            detail="Not enough data. Complete at least one mood check-in or stress assessment."
        )

    # Build feature dict for prediction
    features = {
        "mood_score": mood_row["mood_score"] if mood_row else None,
        "stress_score": stress_row["stress_score"] if stress_row else None,
        "sleep_duration": sleep_row["duration_hours"] if sleep_row else None,
        "sleep_quality": sleep_row["quality"] if sleep_row else None,
        "steps": act_row["steps"] if act_row else None,
        "active_minutes": act_row["active_minutes"] if act_row else None,
        "resting_hr": wearable["resting_hr"] if wearable else None,
        "hrv": wearable["hrv_ms"] if wearable else None,
        "habit_completion": (habits["done"] / habits["total"]) if habits and habits["total"] else None,
        "previous_stress": stress_row["stress_score"] if stress_row else None,
        "stress_3d_mean": stress_avg["v"] if stress_avg and stress_avg["v"] else None,
        "stress_7d_mean": stress_avg["v"] if stress_avg and stress_avg["v"] else None,
        "mood_3d_mean": mood_avg["v"] if mood_avg and mood_avg["v"] else None,
        "sleep_3d_mean": sleep_avg["v"] if sleep_avg and sleep_avg["v"] else None,
        "sleep_7d_std": None,  # Would need to compute from individual records
        "steps_7d_mean": steps_avg["v"] if steps_avg and steps_avg["v"] else None,
        "day_of_week": date.today().weekday(),
        "is_weekend": 1 if date.today().weekday() >= 5 else 0,
        "has_wearable": 1 if has_wearable and has_wearable["c"] > 0 else 0,
    }

    # Try to use the ML model
    try:
        from ml_service.predictor import StressPredictor
        import os
        model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                   "dataset", "best_model.joblib")
        predictor = StressPredictor(model_path)
        if predictor.is_loaded:
            result = predictor.predict(features)
        else:
            # Fallback: rule-based estimate
            result = _rule_based_estimate(features)
    except Exception:
        result = _rule_based_estimate(features)

    # Store prediction
    pred_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    target = (date.today() + timedelta(days=1)).isoformat()

    with get_db() as db:
        db.execute(
            """INSERT INTO predictions (id, user_id, prediction_date, target_date,
                prediction_window, risk_score, risk_level, confidence, model_name, model_version)
               VALUES (?, ?, ?, ?, 'next_day', ?, ?, ?, ?, ?)""",
            (pred_id, user_id, today, target, result["risk_score"], result["risk_level"],
             result["confidence"], result.get("model_name", "rule_based"),
             result.get("model_version", "1.0.0"))
        )

        # Store factors
        for f in result.get("factors", []):
            db.execute(
                "INSERT INTO prediction_factors (prediction_id, factor_name, impact_pct, direction) VALUES (?, ?, ?, ?)",
                (pred_id, f["factor_name"], f["impact_pct"], f["direction"])
            )

        # Generate recommendations based on top risk-increasing factors
        risk_factors = [f for f in result.get("factors", []) if f["direction"] == "increases_risk"][:2]
        for priority, factor in enumerate(risk_factors, 1):
            fname = factor["factor_name"]
            if fname in RECS:
                cat, title, body = RECS[fname]
                db.execute(
                    """INSERT INTO recommendations (prediction_id, user_id, category, title, body, priority, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
                    (pred_id, user_id, cat, title, body, priority, now)
                )

    return {
        "prediction_id": pred_id,
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "confidence": result["confidence"],
        "factors": result.get("factors", []),
        "target_date": target,
        "warning": "This is an estimate based on recent patterns, not a diagnosis.",
    }


def _rule_based_estimate(features: dict) -> dict:
    """
    Rule-based fallback when the ML model is unavailable.
    Used for cold-start / early estimates.
    """
    score = 40  # start neutral

    stress = features.get("stress_score")
    if stress is not None:
        score = score * 0.5 + stress * 0.5

    sleep = features.get("sleep_duration")
    if sleep is not None:
        if sleep < 5:
            score += 15
        elif sleep < 6:
            score += 8
        elif sleep > 8:
            score -= 5

    mood = features.get("mood_score")
    if mood is not None:
        score -= (mood - 3) * 8

    steps = features.get("steps")
    if steps is not None:
        if steps < 3000:
            score += 5
        elif steps > 8000:
            score -= 5

    score = max(0, min(100, int(score)))

    factors = []
    if stress is not None and stress > 60:
        factors.append({"factor_name": "Stress Assessment", "impact_pct": 40, "direction": "increases_risk"})
    if sleep is not None and sleep < 6:
        factors.append({"factor_name": "Sleep", "impact_pct": 30, "direction": "increases_risk"})
    if mood is not None and mood <= 2:
        factors.append({"factor_name": "Mood", "impact_pct": 20, "direction": "increases_risk"})
    if not factors:
        factors.append({"factor_name": "Stress Assessment", "impact_pct": 50, "direction": "reduces_risk"})

    return {
        "risk_score": score,
        "risk_level": risk_level(score),
        "confidence": 0.55,
        "factors": factors,
        "model_name": "rule_based",
        "model_version": "1.0.0-fallback",
    }


@router.put("/recommendations/{rec_id}")
def update_recommendation(rec_id: int, status: str, user_id: str = Depends(get_current_user)):
    """Update a recommendation's status (saved, completed, dismissed)."""
    valid = {"pending", "saved", "completed", "dismissed"}
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")
    with get_db() as db:
        result = db.execute(
            "UPDATE recommendations SET status = ? WHERE id = ? AND user_id = ?",
            (status, rec_id, user_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"message": "Updated"}
