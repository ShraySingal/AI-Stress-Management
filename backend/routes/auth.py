"""
Authentication routes: register, login, refresh, logout.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from backend.database import get_db
from backend.middleware.auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token,
)
from backend.schemas.api import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, PasswordResetRequest, PasswordResetConfirm

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    """Register a new user."""
    with get_db() as db:
        existing = db.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            """INSERT INTO users (id, email, password_hash, full_name, age, gender, occupation,
                                  country_code, email_verified, is_active, created_at, last_login_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)""",
            (user_id, req.email.lower(), hash_password(req.password), req.full_name,
             req.age, req.gender, req.occupation, req.country_code, now, now)
        )
        # Create default preferences and privacy settings
        db.execute(
            "INSERT INTO user_preferences (user_id) VALUES (?)", (user_id,)
        )
        db.execute(
            "INSERT INTO privacy_settings (user_id) VALUES (?)", (user_id,)
        )
        # Audit log
        db.execute(
            "INSERT INTO audit_logs (user_id, action, created_at) VALUES (?, 'register', ?)",
            (user_id, now)
        )

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user_id=user_id,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """Login with email and password."""
    with get_db() as db:
        user = db.execute(
            "SELECT id, password_hash, is_active FROM users WHERE email = ?",
            (req.email.lower(),)
        ).fetchone()

        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account deactivated")

        user_id = user["id"]
        now = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, user_id))
        db.execute(
            "INSERT INTO audit_logs (user_id, action, created_at) VALUES (?, 'login', ?)",
            (user_id, now)
        )

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user_id=user_id,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest):
    """Refresh access token using a valid refresh token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = payload["sub"]
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user_id=user_id,
    )


@router.post("/logout")
def logout():
    """Logout (client-side token deletion; server-side blacklisting is optional)."""
    return {"message": "Logged out successfully"}

# Password reset request - send email with token (stub)
@router.post("/reset-request")
def reset_request(req: PasswordResetRequest):
    """Accept an email and (in a real system) send a password‑reset token.
    Here we simply return a placeholder response."""
    # In production you would generate a secure token, store it, and email the user.
    return {"message": f"Password reset link sent to {req.email}"}

# Password reset confirmation - set new password using token
@router.post("/reset-confirm")
def reset_confirm(req: PasswordResetConfirm):
    """Verify the reset token and update the user's password (stub implementation)."""
    # In a real system you would look up the token, ensure it is valid, then hash the new password.
    # For now we just return success.
    return {"message": "Password has been reset successfully"}
