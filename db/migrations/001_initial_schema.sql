-- ============================================================================
-- AI-Powered Anxiety & Stress Management App
-- Database Schema — 19 tables
-- Compatible with PostgreSQL (primary) and SQLite (local dev)
-- ============================================================================

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    age             INTEGER,
    gender          TEXT CHECK (gender IN ('female','male','non_binary','prefer_not_to_say')),
    occupation      TEXT,
    country_code    TEXT DEFAULT 'IN',
    email_verified  BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP
);

-- 2. user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wellness_goal           TEXT,
    stress_sources          TEXT,  -- pipe-separated
    typical_bedtime         TEXT,
    typical_wake_time       TEXT,
    activity_level          TEXT CHECK (activity_level IN ('low','moderate','high')),
    theme                   TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
    mood_reminder_time      TEXT DEFAULT '09:00',
    notifications_enabled   BOOLEAN DEFAULT TRUE,
    language                TEXT DEFAULT 'en'
);

-- 3. privacy_settings
CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id                     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wearable_access             BOOLEAN DEFAULT FALSE,
    ai_personalization          BOOLEAN DEFAULT TRUE,
    chat_data_retention_days    INTEGER DEFAULT 90,
    allow_anonymous_analytics   BOOLEAN DEFAULT FALSE,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. emergency_contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    relationship    TEXT,
    phone           TEXT NOT NULL,
    is_primary      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);

-- 5. mood_entries
CREATE TABLE IF NOT EXISTS mood_entries (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date  DATE NOT NULL,
    mood_score  INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    mood_label  TEXT CHECK (mood_label IN ('very_low','low','neutral','good','excellent')),
    emotions    TEXT,  -- pipe-separated
    activities  TEXT,  -- pipe-separated
    triggers    TEXT,  -- pipe-separated
    note        TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mood_user_date ON mood_entries(user_id, entry_date);

-- 6. stress_assessments
CREATE TABLE IF NOT EXISTS stress_assessments (
    id                          TEXT PRIMARY KEY,
    user_id                     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_date             DATE NOT NULL,
    q_stress                    INTEGER CHECK (q_stress BETWEEN 1 AND 5),
    q_sleep_quality             INTEGER CHECK (q_sleep_quality BETWEEN 1 AND 5),
    q_energy                    INTEGER CHECK (q_energy BETWEEN 1 AND 5),
    q_concentration_difficulty  INTEGER CHECK (q_concentration_difficulty BETWEEN 1 AND 5),
    q_workload                  INTEGER CHECK (q_workload BETWEEN 1 AND 5),
    q_social_connection         INTEGER CHECK (q_social_connection BETWEEN 1 AND 5),
    q_physical_activity         INTEGER CHECK (q_physical_activity BETWEEN 1 AND 5),
    q_anxious_overwhelmed       INTEGER CHECK (q_anxious_overwhelmed BETWEEN 1 AND 5),
    stress_score                INTEGER NOT NULL CHECK (stress_score BETWEEN 0 AND 100),
    stress_level                TEXT CHECK (stress_level IN ('low','moderate','elevated','high')),
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stress_user_date ON stress_assessments(user_id, assessment_date);

-- 7. sleep_records
CREATE TABLE IF NOT EXISTS sleep_records (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sleep_date          DATE NOT NULL,
    bedtime             TEXT,
    wake_time           TEXT,
    duration_hours      REAL,
    quality             INTEGER CHECK (quality BETWEEN 1 AND 5),
    consistency_score   REAL,
    awakenings          INTEGER DEFAULT 0,
    source              TEXT DEFAULT 'manual' CHECK (source IN ('manual','wearable'))
);
CREATE INDEX IF NOT EXISTS idx_sleep_user_date ON sleep_records(user_id, sleep_date);

-- 8. activity_records
CREATE TABLE IF NOT EXISTS activity_records (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date   DATE NOT NULL,
    steps           INTEGER DEFAULT 0,
    active_minutes  INTEGER DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    distance_km     REAL DEFAULT 0,
    exercise_type   TEXT,
    source          TEXT DEFAULT 'phone' CHECK (source IN ('phone','wearable'))
);
CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_records(user_id, activity_date);

-- 9. habit_definitions
CREATE TABLE IF NOT EXISTS habit_definitions (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    category                TEXT,
    target_days_per_week    INTEGER DEFAULT 7,
    reminder_time           TEXT,
    is_default              BOOLEAN DEFAULT TRUE,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_habit_def_user ON habit_definitions(user_id);

-- 10. habit_logs
CREATE TABLE IF NOT EXISTS habit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id    TEXT NOT NULL REFERENCES habit_definitions(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date    DATE NOT NULL,
    completed   BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);

-- 11. wearable_devices
CREATE TABLE IF NOT EXISTS wearable_devices (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     TEXT NOT NULL,
    platform        TEXT,
    connected_at    TIMESTAMP,
    status          TEXT DEFAULT 'connected' CHECK (status IN ('connected','disconnected','paused')),
    permissions     TEXT,  -- pipe-separated
    last_sync_at    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wearable_dev_user ON wearable_devices(user_id);

-- 12. wearable_data
CREATE TABLE IF NOT EXISTS wearable_data (
    id                  TEXT PRIMARY KEY,
    device_id           TEXT NOT NULL REFERENCES wearable_devices(id) ON DELETE CASCADE,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_date           DATE NOT NULL,
    resting_hr          REAL,
    avg_hr              REAL,
    max_hr              REAL,
    hrv_ms              REAL,
    steps               INTEGER,
    calories            INTEGER,
    exercise_minutes    INTEGER,
    sleep_hours         REAL,
    synced_at           TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wearable_data_user_date ON wearable_data(user_id, data_date);

-- 13. chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                   TEXT,
    started_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count           INTEGER DEFAULT 0,
    escalated_to_support    BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- 14. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content         TEXT NOT NULL,
    intent          TEXT,
    safety_flag     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_session ON chat_messages(session_id);

-- 15. predictions
CREATE TABLE IF NOT EXISTS predictions (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prediction_date         DATE NOT NULL,
    target_date             DATE NOT NULL,
    prediction_window       TEXT DEFAULT 'next_day',
    risk_score              INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    risk_level              TEXT CHECK (risk_level IN ('low','moderate','elevated','high')),
    confidence              REAL,
    model_name              TEXT,
    model_version           TEXT,
    actual_next_day_stress  REAL,
    actual_high_stress      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pred_user_date ON predictions(user_id, prediction_date);

-- 16. prediction_factors
CREATE TABLE IF NOT EXISTS prediction_factors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id   TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    factor_name     TEXT NOT NULL,
    impact_pct      REAL,
    direction       TEXT CHECK (direction IN ('increases_risk','reduces_risk'))
);
CREATE INDEX IF NOT EXISTS idx_pred_factors_pred ON prediction_factors(prediction_id);

-- 17. recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id   TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        TEXT,
    title           TEXT NOT NULL,
    body            TEXT,
    priority        INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','saved','completed','dismissed')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recs_user ON recommendations(user_id);

-- 18. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    scheduled_at    TIMESTAMP,
    is_read         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- 19. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
