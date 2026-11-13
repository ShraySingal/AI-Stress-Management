"""
Database configuration and connection management.
Uses SQLite for local development, easily switchable to PostgreSQL.
"""
import os
import sqlite3
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./capstone.db")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "capstone.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db", "migrations", "001_initial_schema.sql")


def get_connection():
    """Get a new SQLite connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_demo_user():
    """Ensure the default demo user exists with valid credentials and settings."""
    from backend.middleware.auth import hash_password
    from datetime import datetime, timezone

    DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
    DEMO_EMAIL = "demo@mindpulse.io"
    DEMO_PASS = "Password123!"

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,))
        existing = cursor.fetchone()
        now = datetime.now(timezone.utc).isoformat()

        if existing:
            cursor.execute("UPDATE users SET full_name = 'Demo User' WHERE id = ? AND full_name = 'Shray Demo'", (existing[0],))
        else:
            pw_hash = hash_password(DEMO_PASS)
            cursor.execute(
                """
                INSERT INTO users (id, email, password_hash, full_name, age, gender, occupation, country_code, email_verified, is_active, created_at)
                VALUES (?, ?, ?, 'Demo User', 24, 'male', 'Software Engineer', 'IN', 1, 1, ?)
                """,
                (DEMO_USER_ID, DEMO_EMAIL, pw_hash, now),
            )
            cursor.execute(
                """
                INSERT OR IGNORE INTO user_preferences (user_id, wellness_goal, stress_sources, typical_bedtime, typical_wake_time, activity_level, theme, mood_reminder_time, notifications_enabled, language)
                VALUES (?, 'Stress Reduction', 'Work|Deadlines', '23:00', '07:30', 'moderate', 'dark', '09:00', 1, 'en')
                """,
                (DEMO_USER_ID,),
            )
            cursor.execute(
                """
                INSERT OR IGNORE INTO privacy_settings (user_id, wearable_access, ai_personalization, chat_data_retention_days, allow_anonymous_analytics)
                VALUES (?, 1, 1, 90, 0)
                """,
                (DEMO_USER_ID,),
            )
            print(f"[OK] Demo user ({DEMO_EMAIL}) created successfully.")

        # Seed initial entries if empty so dashboard is immediately ready
        cursor.execute("SELECT COUNT(*) FROM mood_entries WHERE user_id = ?", (DEMO_USER_ID,))
        if cursor.fetchone()[0] == 0:
            import uuid
            from datetime import date
            mood_id = str(uuid.uuid4())
            today_str = date.today().isoformat()
            cursor.execute(
                """
                INSERT INTO mood_entries (id, user_id, entry_date, mood_score, mood_label, emotions, activities, triggers, note, created_at)
                VALUES (?, ?, ?, 4, 'good', 'Calm|Focused', 'Work|Meditation', 'Productive morning', 'Feeling balanced and ready for the day.', ?)
                """,
                (mood_id, DEMO_USER_ID, today_str, now),
            )

        cursor.execute("SELECT COUNT(*) FROM stress_assessments WHERE user_id = ?", (DEMO_USER_ID,))
        if cursor.fetchone()[0] == 0:
            import uuid
            from datetime import date
            stress_id = str(uuid.uuid4())
            today_str = date.today().isoformat()
            cursor.execute(
                """
                INSERT INTO stress_assessments (id, user_id, assessment_date, q_stress, q_sleep_quality, q_energy, stress_score, stress_level, created_at)
                VALUES (?, ?, ?, 2, 4, 4, 38, 'moderate', ?)
                """,
                (stress_id, DEMO_USER_ID, today_str, now),
            )

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[WARNING] Could not ensure demo user: {e}")
    finally:
        conn.close()


def init_db():
    """Initialize the database with the schema and ensure default demo user."""
    conn = get_connection()
    try:
        with open(SCHEMA_PATH, "r") as f:
            conn.executescript(f.read())
        conn.commit()
        print(f"[OK] Database initialized at {DB_PATH}")
    finally:
        conn.close()

    ensure_demo_user()


def seed_db():
    """Seed database from CSV files in the dataset directory."""
    import pandas as pd

    dataset_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset")
    if not os.path.exists(dataset_dir):
        print("[WARNING] No dataset directory found. Skipping seed.")
        return

    conn = get_connection()
    try:
        # Order matters for foreign key constraints
        tables = [
            "users", "user_preferences", "privacy_settings", "emergency_contacts",
            "mood_entries", "stress_assessments", "sleep_records", "activity_records",
            "habit_definitions", "habit_logs", "wearable_devices", "wearable_data",
            "chat_sessions", "chat_messages", "notifications", "audit_logs",
            "predictions", "prediction_factors", "recommendations",
        ]
        for table in tables:
            csv_path = os.path.join(dataset_dir, f"{table}.csv")
            if not os.path.exists(csv_path):
                continue
            df = pd.read_csv(csv_path)
            # Check if table already has data
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if count > 0:
                print(f"  {table}: already has {count:,} rows, skipping")
                continue
            df.to_sql(table, conn, if_exists="append", index=False)
            print(f"  [OK] {table}: {len(df):,} rows loaded")
        conn.commit()
        print("[OK] Database seeded successfully")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Seed error: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    seed_db()
