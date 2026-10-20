"""
End-to-End API Integration Test Suite for MindPulse Platform.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure root in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "MindPulse" in data["service"]


def test_demo_user_login():
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@mindpulse.io", "password": "Password123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_dashboard_summary():
    # Login to get token
    login_res = client.post("/api/auth/login", json={"email": "demo@mindpulse.io", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/dashboard/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "user_name" in data


def test_mood_tracking():
    login_res = client.post("/api/auth/login", json={"email": "demo@mindpulse.io", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Mood Entry
    mood_data = {
        "mood_score": 5,
        "emotions": "Focused|Calm",
        "activities": "Coding|Exercise",
        "triggers": "Good Progress",
        "note": "Integration test entry"
    }
    create_res = client.post("/api/mood", json=mood_data, headers=headers)
    assert create_res.status_code == 201

    # Fetch Mood List
    list_res = client.get("/api/mood", headers=headers)
    assert list_res.status_code == 200
    entries = list_res.json()
    assert len(entries) > 0


def test_stress_tracking():
    login_res = client.post("/api/auth/login", json={"email": "demo@mindpulse.io", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    stress_data = {
        "q_stress": 3,
        "q_sleep_quality": 4,
        "q_energy": 4,
        "q_concentration_difficulty": 2,
        "q_workload": 3,
        "q_social_connection": 4,
        "q_physical_activity": 4,
        "q_anxious_overwhelmed": 2
    }
    res = client.post("/api/stress", json=stress_data, headers=headers)
    assert res.status_code == 201
    assert "stress_score" in res.json()


def test_habit_listing():
    login_res = client.post("/api/auth/login", json={"email": "demo@mindpulse.io", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/habits", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
