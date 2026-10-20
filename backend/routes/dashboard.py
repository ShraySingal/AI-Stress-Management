"""
Dashboard and analytics routes.
"""
from fastapi import APIRouter, Depends, Query

from backend.database import get_db
from backend.middleware.auth import get_current_user

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
@router.get("/dashboard/summary")
def get_dashboard(user_id: str = Depends(get_current_user)):
    """
    One-call dashboard: today's summary, risk, streaks, trends, recommendations.
    """
    with get_db() as db:
        # User name
        user = db.execute("SELECT full_name FROM users WHERE id = ?", (user_id,)).fetchone()
        name = user["full_name"] if user else "User"

        # Today's mood
        mood = db.execute(
            "SELECT mood_score FROM mood_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Today's stress
        stress = db.execute(
            "SELECT stress_score, stress_level FROM stress_assessments WHERE user_id = ? ORDER BY assessment_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Today's sleep
        sleep = db.execute(
            "SELECT duration_hours FROM sleep_records WHERE user_id = ? ORDER BY sleep_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Today's activity
        activity = db.execute(
            "SELECT steps FROM activity_records WHERE user_id = ? ORDER BY activity_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Latest prediction
        pred = db.execute(
            "SELECT risk_score, risk_level FROM predictions WHERE user_id = ? ORDER BY prediction_date DESC LIMIT 1",
            (user_id,)
        ).fetchone()

        # Mood trend (7 days)
        mood_trend = db.execute(
            """SELECT entry_date as date, AVG(mood_score) as value
               FROM mood_entries WHERE user_id = ? AND entry_date >= date('now', '-7 days')
               GROUP BY entry_date ORDER BY entry_date""",
            (user_id,)
        ).fetchall()

        # Stress trend (7 days)
        stress_trend = db.execute(
            """SELECT assessment_date as date, AVG(stress_score) as value
               FROM stress_assessments WHERE user_id = ? AND assessment_date >= date('now', '-7 days')
               GROUP BY assessment_date ORDER BY assessment_date""",
            (user_id,)
        ).fetchall()

        # Sleep trend (7 days)
        sleep_trend = db.execute(
            """SELECT sleep_date as date, AVG(duration_hours) as value
               FROM sleep_records WHERE user_id = ? AND sleep_date >= date('now', '-7 days')
               GROUP BY sleep_date ORDER BY sleep_date""",
            (user_id,)
        ).fetchall()

        # Check-in streak: consecutive days with at least one entry
        all_dates = db.execute(
            """SELECT DISTINCT entry_date as d FROM mood_entries WHERE user_id = ?
               UNION SELECT DISTINCT assessment_date FROM stress_assessments WHERE user_id = ?
               ORDER BY d DESC""",
            (user_id, user_id)
        ).fetchall()
        streak = 0
        if all_dates:
            from datetime import date as dt_date, timedelta
            prev = dt_date.today()
            for row in all_dates:
                try:
                    d = dt_date.fromisoformat(row["d"])
                    if (prev - d).days <= 1:
                        streak += 1
                        prev = d
                    else:
                        break
                except (ValueError, TypeError):
                    break

        # Habit completion rate
        habits = db.execute(
            """SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as done
               FROM habit_logs WHERE user_id = ? AND log_date >= date('now', '-7 days')""",
            (user_id,)
        ).fetchone()
        habit_rate = round(habits["done"] / habits["total"], 2) if habits and habits["total"] else None

        # Recent recommendations
        recs = db.execute(
            """SELECT category, title, body, priority, status
               FROM recommendations WHERE user_id = ? ORDER BY created_at DESC LIMIT 5""",
            (user_id,)
        ).fetchall()

    return {
        "user_name": name,
        "today_mood": mood["mood_score"] if mood else None,
        "today_stress": stress["stress_score"] if stress else None,
        "today_stress_level": stress["stress_level"] if stress else None,
        "today_sleep": round(sleep["duration_hours"], 1) if sleep else None,
        "today_steps": activity["steps"] if activity else None,
        "risk_score": pred["risk_score"] if pred else None,
        "risk_level": pred["risk_level"] if pred else None,
        "streak_days": streak,
        "habit_completion": habit_rate,
        "mood_trend": [dict(r) for r in mood_trend],
        "stress_trend": [dict(r) for r in stress_trend],
        "sleep_trend": [dict(r) for r in sleep_trend],
        "recommendations": [dict(r) for r in recs],
    }


@router.get("/analytics")
def get_analytics(
    period: str = Query("7d", regex="^(7d|30d|90d)$"),
    user_id: str = Depends(get_current_user)
):
    """
    Analytics for 7/30/90 days: time series, averages, correlations.
    """
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map[period]
    offset = f"-{days} days"

    with get_db() as db:
        # Mood series
        mood_series = db.execute(
            """SELECT entry_date as date, AVG(mood_score) as value
               FROM mood_entries WHERE user_id = ? AND entry_date >= date('now', ?)
               GROUP BY entry_date ORDER BY entry_date""",
            (user_id, offset)
        ).fetchall()

        # Stress series
        stress_series = db.execute(
            """SELECT assessment_date as date, AVG(stress_score) as value
               FROM stress_assessments WHERE user_id = ? AND assessment_date >= date('now', ?)
               GROUP BY assessment_date ORDER BY assessment_date""",
            (user_id, offset)
        ).fetchall()

        # Sleep series
        sleep_series = db.execute(
            """SELECT sleep_date as date, AVG(duration_hours) as value
               FROM sleep_records WHERE user_id = ? AND sleep_date >= date('now', ?)
               GROUP BY sleep_date ORDER BY sleep_date""",
            (user_id, offset)
        ).fetchall()

        # Activity series
        activity_series = db.execute(
            """SELECT activity_date as date, AVG(steps) as value
               FROM activity_records WHERE user_id = ? AND activity_date >= date('now', ?)
               GROUP BY activity_date ORDER BY activity_date""",
            (user_id, offset)
        ).fetchall()

        # Averages
        avg_mood = db.execute(
            "SELECT AVG(mood_score) as v FROM mood_entries WHERE user_id = ? AND entry_date >= date('now', ?)",
            (user_id, offset)
        ).fetchone()
        avg_stress = db.execute(
            "SELECT AVG(stress_score) as v FROM stress_assessments WHERE user_id = ? AND assessment_date >= date('now', ?)",
            (user_id, offset)
        ).fetchone()
        avg_sleep = db.execute(
            "SELECT AVG(duration_hours) as v FROM sleep_records WHERE user_id = ? AND sleep_date >= date('now', ?)",
            (user_id, offset)
        ).fetchone()
        avg_steps = db.execute(
            "SELECT AVG(steps) as v FROM activity_records WHERE user_id = ? AND activity_date >= date('now', ?)",
            (user_id, offset)
        ).fetchone()

    return {
        "period": period,
        "mood_series": [dict(r) for r in mood_series],
        "stress_series": [dict(r) for r in stress_series],
        "sleep_series": [dict(r) for r in sleep_series],
        "activity_series": [dict(r) for r in activity_series],
        "averages": {
            "mood": round(avg_mood["v"], 2) if avg_mood and avg_mood["v"] else None,
            "stress": round(avg_stress["v"], 1) if avg_stress and avg_stress["v"] else None,
            "sleep": round(avg_sleep["v"], 1) if avg_sleep and avg_sleep["v"] else None,
            "steps": int(avg_steps["v"]) if avg_steps and avg_steps["v"] else None,
        },
    }
