#!/usr/bin/env python3
"""
Synthetic dataset generator
AI-Powered Anxiety & Stress Management App with Intelligent Risk Prediction

Generates CSV files matching the PostgreSQL schema in the master prompt, plus a
flat ML training table (ml_training_dataset.csv).

!! ALL DATA IS SYNTHETIC !!
Relationships (sleep -> stress, activity -> stress, etc.) are *assumed* by the
simulator, not discovered from real people. Models trained on this data prove
the pipeline works; they say nothing about real-world accuracy. State this
clearly in your report.

Tables produced (the prediction-related ones come from train_model.py):
  users, user_preferences, privacy_settings, emergency_contacts,
  mood_entries, stress_assessments, sleep_records, activity_records,
  habit_definitions, habit_logs, wearable_devices, wearable_data,
  chat_sessions, chat_messages, notifications, audit_logs,
  ml_training_dataset
  (predictions, prediction_factors, recommendations -> train_model.py)

Usage:
  python generate_dataset.py --users 300 --days 180 --seed 42 --out dataset
"""
import argparse
import json
import os
import random
import uuid

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Configuration (mirror these in the backend config, not in the UI)
# --------------------------------------------------------------------------
RISK_THRESHOLDS = {"low": [0, 30], "moderate": [31, 60], "elevated": [61, 80], "high": [81, 100]}
HIGH_STRESS_CUTOFF = 61  # next-day stress >= 61 (Elevated or High) is the ML target

FIRST = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Arjun", "Kavya", "Rahul", "Meera",
         "Emma", "Liam", "Olivia", "Noah", "Sophia", "James", "Mia", "Lucas", "Zara", "Omar",
         "Aisha", "Daniel", "Hannah", "Ethan", "Isha", "Karan", "Neha", "Sam", "Tara", "Yusuf"]
LAST = ["Sharma", "Verma", "Singh", "Gupta", "Patel", "Reddy", "Khan", "Mehta", "Nair", "Joshi",
        "Smith", "Brown", "Taylor", "Wilson", "Clark", "Lewis", "Walker", "Hall", "Young", "King"]
OCCUPATIONS = ["student", "office_worker", "healthcare", "teacher", "freelancer", "engineer"]
COUNTRIES = ["IN", "US", "GB", "CA", "AU"]
GOALS = ["reduce_stress", "sleep_better", "be_more_active", "improve_mood", "build_habits", "understand_patterns"]
STRESS_SOURCES = ["work", "studies", "finances", "relationships", "health", "family", "social_media", "uncertainty"]
DEVICES = [("Apple Watch", "Apple HealthKit"), ("Fitbit Charge", "Health Connect"),
           ("Samsung Galaxy Watch", "Health Connect"), ("Garmin Venu", "Health Connect"),
           ("Xiaomi Mi Band", "Health Connect")]

# name, category, weekly target
HABITS = [("Sleep on time", "sleep", 7), ("Exercise", "activity", 4), ("Meditation", "mindfulness", 5),
          ("Hydration", "health", 7), ("Screen-time reduction", "digital", 5), ("Outdoor activity", "activity", 4),
          ("Breathing exercise", "mindfulness", 5), ("Journaling", "mindfulness", 3)]

EMO_POS = ["Happy", "Calm", "Excited"]
EMO_NEG = ["Tired", "Worried", "Angry", "Lonely", "Sad", "Overwhelmed"]
MOOD_LABELS = {1: "very_low", 2: "low", 3: "neutral", 4: "good", 5: "excellent"}
ACTIVITIES = ["work", "study", "exercise", "socializing", "family_time", "commuting", "relaxing", "chores", "outdoors"]
TRIGGERS = ["deadline", "poor_sleep", "conflict", "finances", "health_worry", "crowded_schedule", "news", "loneliness"]
NOTES = {
    1: ["Really rough day.", "Everything felt heavy.", "Could not focus on anything."],
    2: ["Not a great day.", "Felt drained after work.", "Mind kept racing."],
    3: ["Pretty average day.", "Nothing special.", "Okay overall."],
    4: ["Good day, got things done.", "Had a nice walk.", "Felt fairly relaxed."],
    5: ["Great day!", "Feeling energised.", "Spent time with friends."],
}
EXERCISES = ["walking", "running", "cycling", "yoga", "gym", "swimming", "sports"]
USER_AGENTS = ["MindApp/1.0 (Android 14)", "MindApp/1.0 (iOS 17)", "MindApp/1.1 (Android 13)", "MindApp/1.1 (iOS 18)"]
AUDIT_ACTIONS = ["login", "logout", "view_prediction", "export_data", "update_privacy", "connect_wearable",
                 "update_profile", "delete_chat_history", "change_password"]

# Templated, clearly non-clinical chatbot replies (context filled from the user's data)
CHAT_TEMPLATES = {
    "stress_factors": ("What is affecting my stress?",
                       "Over the last 3 days you slept about {sleep:.1f} hours on average and your check-ins show {level} stress. "
                       "Shorter sleep and busier days often go together with higher stress. This is an observation from your "
                       "logged data, not a diagnosis. Would you like a short relaxation exercise?"),
    "relax": ("How can I relax?",
              "A few options: a 5-minute breathing exercise, a short walk, or stretching. Your recent stress looks {level}, "
              "so a short break may help. I'm a wellness assistant, not a therapist."),
    "stress_increase": ("Why did my stress increase?",
                        "Compared with your usual pattern, your sleep was {sleep:.1f} hours and you logged about {steps:,} steps. "
                        "These may be contributing, though many things can influence stress. Want to note any triggers from today?"),
    "week_summary": ("How was my week?",
                     "Your average sleep was {sleep:.1f} hours and your recent stress level is {level}. Keeping a steady bedtime "
                     "could help next week. Would you like to see your weekly insights?"),
    "before_sleep": ("What can I do before sleeping?",
                     "Try dimming lights, putting your phone away 30 minutes before bed, and doing slow breathing. "
                     "You slept {sleep:.1f} hours recently, so keeping your usual bedtime tonight may help."),
}
SUPPORT_MSG = ("I feel really overwhelmed and I don't know how to cope right now.",
               "I'm sorry you're feeling this way. You don't have to handle this alone. I can show breathing and grounding "
               "exercises, or help you contact a trusted person or local support services. I'm not a replacement for "
               "professional or emergency care.")

NOTIF_TYPES = [("mood_reminder", "Daily check-in", "How are you feeling today? Log your mood.", 0.30),
               ("stress_assessment", "Stress check", "Take a 1-minute stress assessment.", 0.15),
               ("habit_reminder", "Habit reminder", "Don't forget your habits for today.", 0.20),
               ("sleep_reminder", "Wind-down time", "Time to start winding down for sleep.", 0.15),
               ("prediction_update", "Prediction updated", "Your stress-risk estimate for tomorrow is ready.", 0.10),
               ("recommendation", "New recommendation", "We have a personalised wellness suggestion for you.", 0.07),
               ("wearable_sync", "Sync complete", "Your wearable data has been synced.", 0.03)]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def new_ids(rng, n):
    return [str(uuid.UUID(bytes=rng.bytes(16), version=4)) for _ in range(n)]


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def risk_level(score):
    s = np.asarray(score)
    return np.select([s <= 30, s <= 60, s <= 80], ["low", "moderate", "elevated"], default="high")


def hhmm(hours):
    return [f"{int(h % 24):02d}:{int((h % 1) * 60):02d}" for h in np.asarray(hours).ravel()]


def rint(x, lo, hi):
    return np.clip(np.rint(x), lo, hi).astype(int)


# --------------------------------------------------------------------------
# Simulation of the underlying (latent) daily state for every user
# --------------------------------------------------------------------------
def simulate(rng, U, D, dates):
    dow = dates.dayofweek.values
    weekend = (dow >= 5).astype(float)

    base_stress = rng.normal(0, 1, U)
    resilience = rng.beta(5, 3, U)
    sleep_need = np.clip(rng.normal(7.8, 0.5, U), 6.5, 9.0)
    bed_base = np.clip(rng.normal(23.2, 0.9, U), 21, 26)
    step_pref = np.clip(rng.lognormal(np.log(6500), 0.4, U), 2000, 16000)
    rhr_base = rng.normal(66, 6, U)
    hrv_base = rng.lognormal(np.log(52), 0.25, U)

    # Workload: weekday/weekend pattern + exam/deadline blocks
    workload = rng.normal(0, 0.8, U)[:, None] + np.where(weekend == 1, -0.6, 0.5)[None, :] + rng.normal(0, 0.5, (U, D))
    for u in range(U):
        for _ in range(rng.integers(2, 5)):
            s = rng.integers(0, max(1, D - 14))
            workload[u, s:s + rng.integers(7, 15)] += 1.0

    # Which habits each user tracks
    H = len(HABITS)
    habit_active = rng.random((U, H)) < 0.75
    for u in np.where(habit_active.sum(1) < 3)[0]:
        habit_active[u, :3] = True
    habit_base = rng.normal(0, 0.8, (U, H))

    S = np.zeros((U, D))
    sleep_dur = np.zeros((U, D)); sleep_q = np.zeros((U, D)); bed = np.zeros((U, D))
    steps = np.zeros((U, D)); social = np.zeros((U, D))
    done = np.zeros((U, D, H), dtype=bool)
    habit_rate = np.zeros((U, D))

    prev_S = base_stress * 0.5
    prev_habit = np.full(U, 0.5)
    for d in range(D):
        pos = np.clip(prev_S, 0, None)
        sd = sleep_need - 0.35 * pos - 0.25 * np.clip(workload[:, d] - 0.5, 0, None) + 0.45 * weekend[d] + rng.normal(0, 0.7, U)
        sd = np.clip(sd, 3.5, 10.5)
        sq = 3.2 - 0.5 * pos + 0.5 * (sd - sleep_need) + rng.normal(0, 0.6, U)
        bd = bed_base + 0.4 * pos + 0.7 * weekend[d] + rng.normal(0, 0.6, U)
        st = np.clip(step_pref * np.exp(-0.12 * prev_S + 0.1 * weekend[d] + rng.normal(0, 0.3, U)), 500, 25000)
        so = 0.8 * rng.normal(0, 1, U) + 0.5 * weekend[d] - 0.2 * prev_S

        drive = (0.5 * base_stress + 0.45 * workload[:, d] + 0.45 * (sleep_need - sd)
                 - 0.35 * np.log(st / step_pref) - 0.25 * so - 0.4 * (prev_habit - 0.5))
        S_new = 0.45 * prev_S + 0.55 * drive * (1 - 0.3 * resilience) + rng.normal(0, 0.35, U)

        p = sigmoid(habit_base - 0.5 * S_new[:, None] + 0.25 * weekend[d])
        dn = (rng.random((U, H)) < p) & habit_active
        hr = dn.sum(1) / habit_active.sum(1)

        S[:, d] = S_new; sleep_dur[:, d] = sd; sleep_q[:, d] = sq; bed[:, d] = bd
        steps[:, d] = st; social[:, d] = so; done[:, d, :] = dn; habit_rate[:, d] = hr
        prev_S, prev_habit = S_new, hr

    Sz = (S - S.mean()) / S.std()
    return dict(dow=dow, weekend=weekend, workload=workload, Sz=Sz, sleep_dur=sleep_dur,
                sleep_q=rint(sleep_q, 1, 5), bed=bed, steps=steps, social=social, done=done,
                habit_rate=habit_rate, habit_active=habit_active, sleep_need=sleep_need,
                bed_base=bed_base, step_pref=step_pref, rhr_base=rhr_base, hrv_base=hrv_base,
                resilience=resilience)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--end-date", default="2026-09-30")
    ap.add_argument("--out", default="dataset")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(a.seed)
    py = random.Random(a.seed)
    U, D = a.users, a.days
    dates = pd.date_range(end=a.end_date, periods=D)
    sim = simulate(rng, U, D, dates)
    Sz = sim["Sz"]
    user_ids = np.array(new_ids(rng, U))
    H = len(HABITS)

    # ---------------- observed (true) daily signals ----------------
    stress = np.clip(np.rint(50 + 16 * Sz + rng.normal(0, 4, (U, D))), 0, 100)
    sleep_dev = sim["sleep_dur"] - sim["sleep_need"][:, None]
    mood_lat = -0.55 * Sz + 0.25 * sleep_dev + 0.2 * sim["social"] + rng.normal(0, 0.6, (U, D))
    mood = np.digitize(mood_lat, np.quantile(mood_lat, [0.10, 0.30, 0.70, 0.90])) + 1
    log_act = np.log(sim["steps"] / sim["step_pref"][:, None])
    active_min = np.clip(sim["steps"] / 180 + rng.normal(0, 6, (U, D)), 0, 300)

    # ---------------- engagement / missing data ----------------
    engage = rng.beta(7, 2.5, U)
    last_day = np.where(rng.random(U) < 0.15, rng.integers(30, D, U), D)
    active = np.arange(D)[None, :] < last_day[:, None]

    def obs(p):
        return active & (rng.random((U, D)) < p[:, None])

    mood_obs = obs(engage)
    assess_obs = obs(engage * 0.9)
    habit_obs = obs(engage * 0.95)
    sleep_obs = obs(np.minimum(engage + 0.1, 1))
    act_obs = obs(np.minimum(engage + 0.15, 1))

    has_wear = rng.random(U) < 0.55
    connect_day = rng.integers(0, 25, U)
    wear_obs = (active & has_wear[:, None] & (np.arange(D)[None, :] >= connect_day[:, None])
                & (rng.random((U, D)) < 0.93))
    sleep_obs |= wear_obs
    act_obs |= wear_obs

    # wearable metrics
    rhr = sim["rhr_base"][:, None] + 2.5 * Sz - 1.2 * sleep_dev + rng.normal(0, 1.8, (U, D))
    hrv = sim["hrv_base"][:, None] * np.exp(-0.12 * Sz + 0.03 * sleep_dev + rng.normal(0, 0.1, (U, D)))
    avg_hr = rhr + 12 + sim["steps"] / 1500 + rng.normal(0, 2, (U, D))
    calories = 1500 + sim["steps"] * 0.04 + active_min * 5

    # sleep consistency (rolling 7-day std)
    roll = pd.DataFrame(sim["sleep_dur"].T).rolling(7, min_periods=3).std().T.values
    consistency = np.nan_to_num(np.clip(100 - 18 * roll, 0, 100), nan=80.0)

    nan = np.nan
    daily = pd.DataFrame({
        "user_id": np.repeat(user_ids, D),
        "date": np.tile(dates.values, U),
        "day_of_week": np.tile(sim["dow"], U),
        "has_wearable": np.repeat(has_wear.astype(int), D),
        "mood_score": np.where(mood_obs, mood, nan).ravel(),
        "stress_score": np.where(assess_obs, stress, nan).ravel(),
        "sleep_duration": np.where(sleep_obs, sim["sleep_dur"], nan).ravel(),
        "sleep_quality": np.where(sleep_obs, sim["sleep_q"], nan).ravel(),
        "steps": np.where(act_obs, sim["steps"], nan).ravel(),
        "active_minutes": np.where(act_obs, active_min, nan).ravel(),
        "resting_hr": np.where(wear_obs, rhr, nan).ravel(),
        "hrv": np.where(wear_obs, hrv, nan).ravel(),
        "habit_completion": np.where(habit_obs, sim["habit_rate"], nan).ravel(),
    })

    # ---------------- users / preferences / privacy ----------------
    first, last = rng.choice(FIRST, U), rng.choice(LAST, U)
    created = pd.Timestamp(dates[0]) - pd.to_timedelta(rng.integers(0, 30, U), unit="D")
    users = pd.DataFrame({
        "id": user_ids,
        "email": [f"{f}.{l}{i}@example.com".lower() for i, (f, l) in enumerate(zip(first, last))],
        "password_hash": "$2b$12$SEED_PLACEHOLDER_NOT_A_REAL_HASH",
        "full_name": [f"{f} {l}" for f, l in zip(first, last)],
        "age": np.clip(np.rint(rng.normal(27, 8, U)), 18, 60).astype(int),
        "gender": rng.choice(["female", "male", "non_binary", "prefer_not_to_say"], U, p=[.48, .46, .03, .03]),
        "occupation": rng.choice(OCCUPATIONS, U),
        "country_code": rng.choice(COUNTRIES, U, p=[.4, .2, .15, .15, .1]),
        "email_verified": True,
        "is_active": True,
        "created_at": created,
        "last_login_at": [pd.Timestamp(dates[min(l, D) - 1]) + pd.Timedelta(hours=int(h)) for l, h in zip(last_day, rng.integers(7, 23, U))],
    })
    act_level = np.where(sim["step_pref"] < 4500, "low", np.where(sim["step_pref"] < 8000, "moderate", "high"))
    prefs = pd.DataFrame({
        "user_id": user_ids,
        "wellness_goal": rng.choice(GOALS, U),
        "stress_sources": ["|".join(rng.choice(STRESS_SOURCES, rng.integers(1, 4), replace=False)) for _ in range(U)],
        "typical_bedtime": hhmm(sim["bed_base"]),
        "typical_wake_time": hhmm(sim["bed_base"] + sim["sleep_need"]),
        "activity_level": act_level,
        "theme": rng.choice(["light", "dark", "system"], U, p=[.4, .3, .3]),
        "mood_reminder_time": rng.choice(["08:00", "09:00", "20:00", "21:00"], U),
        "notifications_enabled": rng.random(U) < 0.9,
        "language": "en",
    })
    privacy = pd.DataFrame({
        "user_id": user_ids,
        "wearable_access": has_wear,
        "ai_personalization": rng.random(U) < 0.8,
        "chat_data_retention_days": rng.choice([30, 90, 365], U),
        "allow_anonymous_analytics": rng.random(U) < 0.5,
        "updated_at": created,
    })
    n_ec = rng.integers(1, 3, U)
    ec_rows = []
    rels = ["parent", "sibling", "friend", "partner", "relative"]
    for i in range(U):
        for k in range(n_ec[i]):
            ec_rows.append({"id": new_ids(rng, 1)[0], "user_id": user_ids[i],
                            "name": f"{py.choice(FIRST)} {py.choice(LAST)}",
                            "relationship": py.choice(rels),
                            "phone": f"+1-555-01{py.randint(0, 99):02d}",  # fictional number range
                            "is_primary": k == 0})
    emergency_contacts = pd.DataFrame(ec_rows)

    # ---------------- mood_entries ----------------
    u, d = np.nonzero(mood_obs)
    ms = mood[u, d]
    rows = []
    for ui, di, m in zip(u, d, ms):
        k = py.randint(1, 3)
        pp = (m - 1) / 4 * 0.8 + 0.1
        emo = {py.choice(EMO_POS) if py.random() < pp else py.choice(EMO_NEG) for _ in range(k)}
        rows.append(("|".join(sorted(emo)),
                     "|".join(py.sample(ACTIVITIES, py.randint(1, 3))),
                     "|".join(py.sample(TRIGGERS, py.randint(1, 2))) if m <= 2 and py.random() < 0.6 else "",
                     py.choice(NOTES[int(m)]) if py.random() < 0.35 else ""))
    mood_entries = pd.DataFrame(rows, columns=["emotions", "activities", "triggers", "note"])
    mood_entries.insert(0, "id", new_ids(rng, len(u)))
    mood_entries.insert(1, "user_id", user_ids[u])
    mood_entries.insert(2, "entry_date", dates[d].date)
    mood_entries.insert(3, "mood_score", ms)
    mood_entries.insert(4, "mood_label", [MOOD_LABELS[int(x)] for x in ms])
    mood_entries["created_at"] = dates[d] + pd.to_timedelta(rng.integers(7, 23, len(u)), unit="h")

    # ---------------- stress_assessments ----------------
    u, d = np.nonzero(assess_obs)
    sc = stress[u, d]
    n = len(u)
    q = lambda x: x  # readability
    stress_assessments = pd.DataFrame({
        "id": new_ids(rng, n), "user_id": user_ids[u], "assessment_date": dates[d].date,
        "q_stress": rint(1 + sc / 25 + rng.normal(0, .3, n), 1, 5),
        "q_sleep_quality": sim["sleep_q"][u, d],
        "q_energy": rint(3 + 0.7 * sleep_dev[u, d] - 0.5 * Sz[u, d] + rng.normal(0, .5, n), 1, 5),
        "q_concentration_difficulty": rint(3 + 0.6 * Sz[u, d] - 0.3 * sleep_dev[u, d] + rng.normal(0, .5, n), 1, 5),
        "q_workload": rint(3 + 0.8 * sim["workload"][u, d] + rng.normal(0, .4, n), 1, 5),
        "q_social_connection": rint(3 + 0.8 * sim["social"][u, d] + rng.normal(0, .4, n), 1, 5),
        "q_physical_activity": rint(3 + 2 * log_act[u, d] + rng.normal(0, .3, n), 1, 5),
        "q_anxious_overwhelmed": rint(1 + sc / 25 + rng.normal(0, .5, n), 1, 5),
        "stress_score": sc.astype(int),
        "stress_level": risk_level(sc),
        "created_at": dates[d] + pd.to_timedelta(rng.integers(8, 23, n), unit="h"),
    })

    # ---------------- sleep_records ----------------
    u, d = np.nonzero(sleep_obs)
    n = len(u)
    is_w = wear_obs[u, d]
    bed_h = sim["bed"][u, d]
    sleep_records = pd.DataFrame({
        "id": new_ids(rng, n), "user_id": user_ids[u], "sleep_date": dates[d].date,
        "bedtime": hhmm(bed_h), "wake_time": hhmm(bed_h + sim["sleep_dur"][u, d]),
        "duration_hours": sim["sleep_dur"][u, d].round(2),
        "quality": sim["sleep_q"][u, d],
        "consistency_score": consistency[u, d].round(1),
        "awakenings": rng.poisson(1.2, n),
        "source": np.where(is_w, "wearable", "manual"),
    })

    # ---------------- activity_records ----------------
    u, d = np.nonzero(act_obs)
    n = len(u)
    am = active_min[u, d]
    activity_records = pd.DataFrame({
        "id": new_ids(rng, n), "user_id": user_ids[u], "activity_date": dates[d].date,
        "steps": sim["steps"][u, d].astype(int), "active_minutes": am.round(0).astype(int),
        "calories_burned": calories[u, d].round(0).astype(int),
        "distance_km": (sim["steps"][u, d] * 0.00075).round(2),
        "exercise_type": [py.choice(EXERCISES) if x > 35 else "" for x in am],
        "source": np.where(wear_obs[u, d], "wearable", "phone"),
    })

    # ---------------- habit_definitions / habit_logs ----------------
    hd_rows, hd_id = [], np.empty((U, H), dtype=object)
    for ui in range(U):
        for h in range(H):
            if sim["habit_active"][ui, h]:
                hid = new_ids(rng, 1)[0]
                hd_id[ui, h] = hid
                name, cat, tgt = HABITS[h]
                hd_rows.append({"id": hid, "user_id": user_ids[ui], "name": name, "category": cat,
                                "target_days_per_week": tgt, "reminder_time": py.choice(["07:00", "12:00", "18:00", "21:00"]),
                                "is_default": True, "is_active": True, "created_at": created[ui]})
    habit_definitions = pd.DataFrame(hd_rows)
    parts = []
    for h in range(H):
        u, d = np.nonzero(habit_obs & sim["habit_active"][:, h][:, None])
        parts.append(pd.DataFrame({"habit_id": hd_id[u, h], "user_id": user_ids[u], "log_date": dates[d].date,
                                   "completed": sim["done"][u, d, h]}))
    habit_logs = pd.concat(parts, ignore_index=True).sort_values(["user_id", "log_date"]).reset_index(drop=True)
    habit_logs.insert(0, "id", np.arange(1, len(habit_logs) + 1))

    # ---------------- wearable_devices / wearable_data ----------------
    dev_rows, dev_id = [], np.empty(U, dtype=object)
    for ui in np.where(has_wear)[0]:
        name, platform = DEVICES[rng.integers(0, len(DEVICES))]
        dev_id[ui] = new_ids(rng, 1)[0]
        dev_rows.append({"id": dev_id[ui], "user_id": user_ids[ui], "device_name": name, "platform": platform,
                         "connected_at": pd.Timestamp(dates[connect_day[ui]]), "status": "connected",
                         "permissions": "heart_rate|resting_hr|hrv|steps|sleep|calories|exercise",
                         "last_sync_at": pd.Timestamp(dates[last_day[ui] - 1]) + pd.Timedelta(hours=8)})
    wearable_devices = pd.DataFrame(dev_rows)
    u, d = np.nonzero(wear_obs)
    n = len(u)
    wearable_data = pd.DataFrame({
        "id": new_ids(rng, n), "device_id": dev_id[u], "user_id": user_ids[u], "data_date": dates[d].date,
        "resting_hr": rhr[u, d].round(1), "avg_hr": avg_hr[u, d].round(1),
        "max_hr": (avg_hr[u, d] + rng.uniform(25, 60, n)).round(0),
        "hrv_ms": hrv[u, d].round(1), "steps": sim["steps"][u, d].astype(int),
        "calories": calories[u, d].round(0).astype(int),
        "exercise_minutes": (active_min[u, d] * 0.5).round(0).astype(int),
        "sleep_hours": sim["sleep_dur"][u, d].round(2),
        "synced_at": dates[d] + pd.to_timedelta(rng.integers(6, 10, n), unit="h"),
    })

    # ---------------- chat_sessions / chat_messages ----------------
    sess_rows, msg_rows = [], []
    ai_on = privacy["ai_personalization"].values
    for ui in range(U):
        if not ai_on[ui] or py.random() > 0.5:
            continue
        for _ in range(py.randint(1, 7)):
            di = py.randrange(3, last_day[ui])
            sid = new_ids(rng, 1)[0]
            t0 = pd.Timestamp(dates[di]) + pd.Timedelta(hours=py.randint(8, 22))
            ctx = dict(sleep=float(sim["sleep_dur"][ui, max(0, di - 2):di + 1].mean()),
                       level=str(risk_level(stress[ui, max(0, di - 2):di + 1].mean())),
                       steps=int(sim["steps"][ui, di]))
            keys = py.sample(list(CHAT_TEMPLATES), py.randint(1, 3))
            turns = [(k, *CHAT_TEMPLATES[k]) for k in keys]
            escalate = py.random() < 0.03
            if escalate:
                turns.append(("support_needed", *SUPPORT_MSG))
            sess_rows.append({"id": sid, "user_id": user_ids[ui], "title": CHAT_TEMPLATES[keys[0]][0][:40],
                              "started_at": t0, "message_count": 2 * len(turns), "escalated_to_support": escalate})
            t = t0
            for intent, up, ai in turns:
                t += pd.Timedelta(seconds=py.randint(20, 90))
                msg_rows.append({"session_id": sid, "user_id": user_ids[ui], "role": "user", "content": up,
                                 "intent": intent, "safety_flag": intent == "support_needed", "created_at": t})
                t += pd.Timedelta(seconds=py.randint(2, 8))
                msg_rows.append({"session_id": sid, "user_id": user_ids[ui], "role": "assistant",
                                 "content": ai.format(**ctx) if "{" in ai else ai,
                                 "intent": intent, "safety_flag": intent == "support_needed", "created_at": t})
    chat_sessions = pd.DataFrame(sess_rows)
    chat_messages = pd.DataFrame(msg_rows)
    chat_messages.insert(0, "id", np.arange(1, len(chat_messages) + 1))

    # ---------------- notifications ----------------
    u, d = np.nonzero(active & (rng.random((U, D)) < 0.30))
    n = len(u)
    probs = np.array([t[3] for t in NOTIF_TYPES]); probs /= probs.sum()
    ti = rng.choice(len(NOTIF_TYPES), n, p=probs)
    notifications = pd.DataFrame({
        "id": new_ids(rng, n), "user_id": user_ids[u],
        "type": [NOTIF_TYPES[i][0] for i in ti], "title": [NOTIF_TYPES[i][1] for i in ti],
        "body": [NOTIF_TYPES[i][2] for i in ti],
        "scheduled_at": dates[d] + pd.to_timedelta(rng.integers(7, 22, n), unit="h"),
        "is_read": rng.random(n) < 0.65,
    })

    # ---------------- audit_logs ----------------
    n_a = U * 20
    au = rng.integers(0, U, n_a)
    audit_logs = pd.DataFrame({
        "id": np.arange(1, n_a + 1), "user_id": user_ids[au],
        "action": rng.choice(AUDIT_ACTIONS, n_a, p=[.3, .2, .2, .03, .05, .03, .1, .04, .05]),
        "ip_address": [f"203.0.113.{x}" for x in rng.integers(1, 255, n_a)],  # documentation IP range
        "user_agent": rng.choice(USER_AGENTS, n_a),
        "created_at": pd.Timestamp(dates[0]) + pd.to_timedelta(rng.integers(0, D * 24 * 60, n_a), unit="min"),
    }).sort_values("created_at").reset_index(drop=True)
    audit_logs["id"] = np.arange(1, n_a + 1)

    # ---------------- ML training table ----------------
    df = daily.sort_values(["user_id", "date"]).reset_index(drop=True)
    g = df.groupby("user_id")

    def roll(col, w, fn="mean"):
        r = g[col].rolling(w, min_periods=1)
        return getattr(r, fn)().reset_index(level=0, drop=True)

    df["previous_stress"] = g["stress_score"].shift(1)
    df["stress_3d_mean"] = roll("stress_score", 3)
    df["stress_7d_mean"] = roll("stress_score", 7)
    df["mood_3d_mean"] = roll("mood_score", 3)
    df["sleep_3d_mean"] = roll("sleep_duration", 3)
    df["sleep_7d_std"] = g["sleep_duration"].rolling(7, min_periods=3).std().reset_index(level=0, drop=True)
    df["steps_7d_mean"] = roll("steps", 7)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["next_day_stress_score"] = g["stress_score"].shift(-1)
    df = df[df["stress_score"].notna() & df["next_day_stress_score"].notna()].copy()
    df["next_day_high_stress"] = (df["next_day_stress_score"] >= HIGH_STRESS_CUTOFF).astype(int)
    num_cols = df.select_dtypes(include="number").columns
    ml = df.copy()
    ml[num_cols] = ml[num_cols].round(3)

    # ---------------- save ----------------
    tables = dict(users=users, user_preferences=prefs, privacy_settings=privacy, emergency_contacts=emergency_contacts,
                  mood_entries=mood_entries, stress_assessments=stress_assessments, sleep_records=sleep_records,
                  activity_records=activity_records, habit_definitions=habit_definitions, habit_logs=habit_logs,
                  wearable_devices=wearable_devices, wearable_data=wearable_data, chat_sessions=chat_sessions,
                  chat_messages=chat_messages, notifications=notifications, audit_logs=audit_logs,
                  ml_training_dataset=ml)
    for name, t in tables.items():
        t.to_csv(os.path.join(a.out, f"{name}.csv"), index=False)

    meta = {"synthetic": True, "seed": a.seed, "users": U, "days": D, "end_date": a.end_date,
            "risk_thresholds": RISK_THRESHOLDS, "ml_target": f"next_day_stress_score >= {HIGH_STRESS_CUTOFF}",
            "rows": {k: len(v) for k, v in tables.items()},
            "note": "All values are simulated. Not clinically validated. Not for medical use."}
    with open(os.path.join(a.out, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print("Saved to", os.path.abspath(a.out))
    for k, v in meta["rows"].items():
        print(f"  {k:24s}{v:>9,d} rows")
    print(f"\nML target positive rate: {ml['next_day_high_stress'].mean():.1%}")


if __name__ == "__main__":
    main()
