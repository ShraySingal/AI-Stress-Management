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


def init_db():
    """Initialize the database with the schema."""
    conn = get_connection()
    try:
        with open(SCHEMA_PATH, "r") as f:
            conn.executescript(f.read())
        conn.commit()
        print(f"[OK] Database initialized at {DB_PATH}")
    finally:
        conn.close()


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
