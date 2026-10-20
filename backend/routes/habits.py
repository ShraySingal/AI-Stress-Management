"""
Habit management routes: definitions and daily logs.
"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.schemas.api import HabitCreate, HabitLogCreate

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post("/", status_code=201)
def create_habit(req: HabitCreate, user_id: str = Depends(get_current_user)):
    """Create a new habit definition."""
    habit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            """INSERT INTO habit_definitions (id, user_id, name, category, target_days_per_week,
                                              reminder_time, is_default, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)""",
            (habit_id, user_id, req.name, req.category, req.target_days_per_week, req.reminder_time, now)
        )
    return {"id": habit_id, "name": req.name}


@router.get("/")
def list_habits(user_id: str = Depends(get_current_user)):
    """List all active habits with their weekly stats."""
    with get_db() as db:
        habits = db.execute(
            "SELECT * FROM habit_definitions WHERE user_id = ? AND is_active = 1 ORDER BY created_at",
            (user_id,)
        ).fetchall()

        result = []
        for h in habits:
            # Weekly completion count
            logs = db.execute(
                """SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as done
                   FROM habit_logs WHERE habit_id = ? AND log_date >= date('now', '-7 days')""",
                (h["id"],)
            ).fetchone()

            # Current streak
            streak_rows = db.execute(
                """SELECT log_date, completed FROM habit_logs
                   WHERE habit_id = ? AND completed = 1
                   ORDER BY log_date DESC LIMIT 30""",
                (h["id"],)
            ).fetchall()
            streak = 0
            if streak_rows:
                from datetime import timedelta
                prev = date.today()
                for row in streak_rows:
                    try:
                        d = date.fromisoformat(row["log_date"])
                        if (prev - d).days <= 1:
                            streak += 1
                            prev = d
                        else:
                            break
                    except (ValueError, TypeError):
                        break

            result.append({
                **dict(h),
                "weekly_done": logs["done"] if logs else 0,
                "weekly_total": logs["total"] if logs else 0,
                "streak": streak,
            })
    return result


@router.post("/log", status_code=201)
def log_habit(req: HabitLogCreate, user_id: str = Depends(get_current_user)):
    """Log a habit completion for a day."""
    log_date = req.log_date or date.today().isoformat()
    with get_db() as db:
        # Verify habit belongs to user
        habit = db.execute(
            "SELECT id FROM habit_definitions WHERE id = ? AND user_id = ?",
            (req.habit_id, user_id)
        ).fetchone()
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found")

        # Upsert (delete existing then insert)
        db.execute(
            "DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ? AND log_date = ?",
            (req.habit_id, user_id, log_date)
        )
        db.execute(
            "INSERT INTO habit_logs (habit_id, user_id, log_date, completed) VALUES (?, ?, ?, ?)",
            (req.habit_id, user_id, log_date, req.completed)
        )
    return {"habit_id": req.habit_id, "log_date": log_date, "completed": req.completed}


@router.delete("/{habit_id}")
def delete_habit(habit_id: str, user_id: str = Depends(get_current_user)):
    """Deactivate a habit (soft delete)."""
    with get_db() as db:
        result = db.execute(
            "UPDATE habit_definitions SET is_active = 0 WHERE id = ? AND user_id = ?",
            (habit_id, user_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Habit not found")
    return {"message": "Habit deactivated"}


@router.get("/logs")
def get_habit_logs(
    days: int = Query(7, ge=1, le=90),
    user_id: str = Depends(get_current_user)
):
    """Get all habit logs for the user over the last N days."""
    with get_db() as db:
        rows = db.execute(
            """SELECT hl.*, hd.name as habit_name, hd.category
               FROM habit_logs hl JOIN habit_definitions hd ON hl.habit_id = hd.id
               WHERE hl.user_id = ? AND hl.log_date >= date('now', ?)
               ORDER BY hl.log_date DESC, hd.name""",
            (user_id, f"-{days} days")
        ).fetchall()
    return [dict(r) for r in rows]
