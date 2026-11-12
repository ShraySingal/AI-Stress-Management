"""
Wearable Device and Biometric Synchronization Routes.
Implements Phase 6 (Wearables) with idempotent sync, permission management,
and automatic synchronization with manual sleep/activity records.
"""

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.schemas.api import (
    WearableDeviceCreate,
    WearableDeviceResponse,
    WearableDataSyncRequest,
    WearableDataSyncResponse,
)

router = APIRouter(prefix="/wearables", tags=["wearables"])


@router.get("/", response_model=List[WearableDeviceResponse])
def list_devices(user_id: str = Depends(get_current_user)):
    """List all connected or paired wearable devices for the user."""
    with get_db() as db:
        rows = db.execute(
            """SELECT id, device_name, platform, status, permissions, connected_at, last_sync_at
               FROM wearable_devices
               WHERE user_id = ?
               ORDER BY connected_at DESC""",
            (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


@router.post("/connect", response_model=WearableDeviceResponse, status_code=status.HTTP_201_CREATED)
def connect_device(
    req: WearableDeviceCreate,
    user_id: str = Depends(get_current_user)
):
    """Pair a wearable platform or device (Health Connect, Apple HealthKit, Garmin, Fitbit)."""
    now = datetime.now(timezone.utc).isoformat()
    device_id = str(uuid.uuid4())

    with get_db() as db:
        # Check if already connected with same platform & device_name
        existing = db.execute(
            """SELECT id FROM wearable_devices 
               WHERE user_id = ? AND platform = ? AND device_name = ?""",
            (user_id, req.platform, req.device_name)
        ).fetchone()

        if existing:
            # Re-activate device
            db.execute(
                """UPDATE wearable_devices 
                   SET status = 'connected', permissions = ?, last_sync_at = ? 
                   WHERE id = ?""",
                (req.permissions, now, existing["id"])
            )
            device_id = existing["id"]
        else:
            db.execute(
                """INSERT INTO wearable_devices (id, user_id, device_name, platform, connected_at, status, permissions, last_sync_at)
                   VALUES (?, ?, ?, ?, ?, 'connected', ?, ?)""",
                (device_id, user_id, req.device_name, req.platform, now, req.permissions, now)
            )

        row = db.execute("SELECT * FROM wearable_devices WHERE id = ?", (device_id,)).fetchone()
        return dict(row)


@router.post("/sync", response_model=WearableDataSyncResponse)
def sync_wearable_data(
    req: WearableDataSyncRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Idempotent biometric upsert for wearable data by (device_id, data_date).
    Also updates daily sleep and activity records with high-precision wearable data.
    """
    now = datetime.now(timezone.utc).isoformat()
    sync_date = req.data_date or date.today().isoformat()

    with get_db() as db:
        # Validate device ownership
        device = db.execute(
            "SELECT id FROM wearable_devices WHERE id = ? AND user_id = ?",
            (req.device_id, user_id)
        ).fetchone()
        if not device:
            raise HTTPException(status_code=404, detail="Wearable device not found or unauthorized")

        # Idempotent upsert in wearable_data
        existing_data = db.execute(
            "SELECT id FROM wearable_data WHERE device_id = ? AND data_date = ?",
            (req.device_id, sync_date)
        ).fetchone()

        overrode_sleep = False
        if existing_data:
            data_id = existing_data["id"]
            db.execute(
                """UPDATE wearable_data
                   SET resting_hr = coalesce(?, resting_hr),
                       avg_hr = coalesce(?, avg_hr),
                       max_hr = coalesce(?, max_hr),
                       hrv_ms = coalesce(?, hrv_ms),
                       steps = coalesce(?, steps),
                       calories = coalesce(?, calories),
                       exercise_minutes = coalesce(?, exercise_minutes),
                       sleep_hours = coalesce(?, sleep_hours),
                       synced_at = ?
                   WHERE id = ?""",
                (req.resting_hr, req.avg_hr, req.max_hr, req.hrv_ms,
                 req.steps, req.calories, req.exercise_minutes, req.sleep_hours,
                 now, data_id)
            )
        else:
            data_id = str(uuid.uuid4())
            db.execute(
                """INSERT INTO wearable_data (id, device_id, user_id, data_date, resting_hr, avg_hr, max_hr, hrv_ms, steps, calories, exercise_minutes, sleep_hours, synced_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (data_id, req.device_id, user_id, sync_date,
                 req.resting_hr, req.avg_hr, req.max_hr, req.hrv_ms,
                 req.steps, req.calories, req.exercise_minutes, req.sleep_hours,
                 now)
            )

        # Update last_sync_at timestamp on device
        db.execute(
            "UPDATE wearable_devices SET last_sync_at = ? WHERE id = ?",
            (now, req.device_id)
        )

        # If wearable recorded sleep, sync to sleep_records
        if req.sleep_hours is not None:
            existing_sleep = db.execute(
                "SELECT id FROM sleep_records WHERE user_id = ? AND sleep_date = ?",
                (user_id, sync_date)
            ).fetchone()

            if existing_sleep:
                db.execute(
                    """UPDATE sleep_records 
                       SET duration_hours = ?, source = 'wearable' 
                       WHERE id = ?""",
                    (req.sleep_hours, existing_sleep["id"])
                )
                overrode_sleep = True
            else:
                db.execute(
                    """INSERT INTO sleep_records (id, user_id, sleep_date, duration_hours, source)
                       VALUES (?, ?, ?, ?, 'wearable')""",
                    (str(uuid.uuid4()), user_id, sync_date, req.sleep_hours)
                )
                overrode_sleep = True

        # If wearable recorded steps or active minutes, sync to activity_records
        if req.steps is not None or req.exercise_minutes is not None:
            existing_activity = db.execute(
                "SELECT id FROM activity_records WHERE user_id = ? AND activity_date = ?",
                (user_id, sync_date)
            ).fetchone()

            if existing_activity:
                db.execute(
                    """UPDATE activity_records 
                       SET steps = coalesce(?, steps),
                           active_minutes = coalesce(?, active_minutes),
                           calories_burned = coalesce(?, calories_burned),
                           source = 'wearable'
                       WHERE id = ?""",
                    (req.steps, req.exercise_minutes, req.calories, existing_activity["id"])
                )
            else:
                db.execute(
                    """INSERT INTO activity_records (id, user_id, activity_date, steps, active_minutes, calories_burned, source)
                       VALUES (?, ?, ?, ?, ?, ?, 'wearable')""",
                    (str(uuid.uuid4()), user_id, sync_date, req.steps or 0, req.exercise_minutes or 0, req.calories or 0)
                )

        return WearableDataSyncResponse(
            status="success",
            message="Biometric sync completed successfully",
            device_id=req.device_id,
            data_date=sync_date,
            overrode_manual_sleep=overrode_sleep
        )


@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
def disconnect_device(
    device_id: str,
    user_id: str = Depends(get_current_user)
):
    """Disconnect or remove a wearable device."""
    with get_db() as db:
        res = db.execute(
            "DELETE FROM wearable_devices WHERE id = ? AND user_id = ?",
            (device_id, user_id)
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Device not found")
        return {"message": "Wearable device disconnected successfully"}
