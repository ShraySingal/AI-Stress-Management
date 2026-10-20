"""
User profile, preferences, and privacy settings routes.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.schemas.api import UserProfile, UserPreferencesUpdate, PrivacySettingsUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
def get_profile(user_id: str = Depends(get_current_user)):
    """Get the current user's profile."""
    with get_db() as db:
        user = db.execute(
            "SELECT id, email, full_name, age, gender, occupation, country_code, created_at FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(user)


@router.put("/me")
def update_profile(updates: dict, user_id: str = Depends(get_current_user)):
    """Update profile fields (full_name, age, gender, occupation, country_code)."""
    allowed = {"full_name", "age", "gender", "occupation", "country_code"}
    fields = {k: v for k, v in updates.items() if k in allowed and v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user_id]

    with get_db() as db:
        db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
    return {"message": "Profile updated"}


@router.get("/me/preferences")
def get_preferences(user_id: str = Depends(get_current_user)):
    """Get user preferences."""
    with get_db() as db:
        row = db.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return {}
        return dict(row)


@router.put("/me/preferences")
def update_preferences(req: UserPreferencesUpdate, user_id: str = Depends(get_current_user)):
    """Update user preferences."""
    fields = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user_id]

    with get_db() as db:
        db.execute(f"UPDATE user_preferences SET {set_clause} WHERE user_id = ?", values)
    return {"message": "Preferences updated"}


@router.get("/me/privacy")
def get_privacy(user_id: str = Depends(get_current_user)):
    """Get privacy settings."""
    with get_db() as db:
        row = db.execute("SELECT * FROM privacy_settings WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return {}
        return dict(row)


@router.put("/me/privacy")
def update_privacy(req: PrivacySettingsUpdate, user_id: str = Depends(get_current_user)):
    """Update privacy settings."""
    fields = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    now = datetime.now(timezone.utc).isoformat()
    fields["updated_at"] = now

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user_id]

    with get_db() as db:
        db.execute(f"UPDATE privacy_settings SET {set_clause} WHERE user_id = ?", values)
        db.execute(
            "INSERT INTO audit_logs (user_id, action, created_at) VALUES (?, 'update_privacy', ?)",
            (user_id, now)
        )
    return {"message": "Privacy settings updated"}


@router.post("/me/export")
def export_data(user_id: str = Depends(get_current_user)):
    """Export all user data as JSON."""
    import json
    tables = [
        "users", "user_preferences", "privacy_settings", "emergency_contacts",
        "mood_entries", "stress_assessments", "sleep_records", "activity_records",
        "habit_definitions", "habit_logs", "predictions", "prediction_factors",
        "recommendations", "chat_sessions", "chat_messages", "notifications",
    ]
    export = {}
    with get_db() as db:
        for table in tables:
            if table == "users":
                rows = db.execute(
                    "SELECT id, email, full_name, age, gender, occupation, country_code, created_at FROM users WHERE id = ?",
                    (user_id,)
                ).fetchall()
            else:
                rows = db.execute(f"SELECT * FROM {table} WHERE user_id = ?", (user_id,)).fetchall()
            export[table] = [dict(r) for r in rows]

        db.execute(
            "INSERT INTO audit_logs (user_id, action, created_at) VALUES (?, 'export_data', ?)",
            (user_id, datetime.now(timezone.utc).isoformat())
        )
    return export


@router.delete("/me")
def delete_account(user_id: str = Depends(get_current_user)):
    """Delete user account and all associated data (cascade)."""
    with get_db() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return {"message": "Account deleted"}
