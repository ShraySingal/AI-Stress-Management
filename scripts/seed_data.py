"""
Database seeder script for MindPulse platform.
Initializes database schema, seeds CSV dataset, and ensures default demo user exists.
"""

import sys
import os
import uuid
from datetime import date, datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import get_db, init_db, seed_db
from backend.middleware.auth import hash_password

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
DEMO_EMAIL = "demo@mindpulse.io"
DEMO_PASS = "Password123!"


def seed_all():
    print("Starting database schema initialization...")
    init_db()

    print("\nPopulating database from synthetic CSV dataset...")
    seed_db()

    print("\nEnsuring default demo user exists...")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,))
        existing = cursor.fetchone()

        if existing:
            print(f"✓ Demo user ({DEMO_EMAIL}) already exists.")
        else:
            pw_hash = hash_password(DEMO_PASS)
            cursor.execute(
                """
                INSERT INTO users (id, email, password_hash, full_name, age, gender, occupation, country_code, email_verified, is_active, created_at)
                VALUES (?, ?, ?, ?, 24, 'male', 'Software Engineer', 'IN', 1, 1, ?)
            """,
                (DEMO_USER_ID, DEMO_EMAIL, pw_hash, "Shray Demo", datetime.now(timezone.utc).isoformat()),
            )

            cursor.execute(
                """
                INSERT INTO user_preferences (user_id, wellness_goal, stress_sources, typical_bedtime, typical_wake_time, activity_level, theme, mood_reminder_time, notifications_enabled, language)
                VALUES (?, 'Stress Reduction', 'Work|Deadlines', '23:00', '07:30', 'moderate', 'dark', '09:00', 1, 'en')
            """,
                (DEMO_USER_ID,),
            )

            cursor.execute(
                """
                INSERT INTO privacy_settings (user_id, wearable_access, ai_personalization, chat_data_retention_days, allow_anonymous_analytics)
                VALUES (?, 1, 1, 90, 0)
            """,
                (DEMO_USER_ID,),
            )
            print(f"✓ Created demo user: {DEMO_EMAIL} / {DEMO_PASS}")

        conn.commit()

    print("\n🎉 Complete database initialization and seeding finished!")


if __name__ == "__main__":
    seed_all()
