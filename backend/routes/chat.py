"""
Chatbot API route with Crisis Pre-Filter, Context Builder, and Non-Clinical Guardrails.
Implements Phase 5 (Chatbot) of the MindEase / MindPulse architecture.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.database import get_db
from backend.middleware.auth import get_current_user
from backend.schemas.api import (
    ChatMessageRequest,
    ChatMessageResponse,
    CrisisResource,
    ChatMessageItem,
    ChatHistoryResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])

# ─────────────────────────────────────────────────────────────
# 1. CRISIS INTERVENTION FILTER (Strict Pre-Filter)
# ─────────────────────────────────────────────────────────────
CRISIS_PATTERNS = [
    r"\b(kill|killing)\s+(myself|me)\b",
    r"\b(suicid(e|al))\b",
    r"\bwant\s+to\s+(die|end\s+it(\s+all)?)\b",
    r"\b(end|ending)\s+my\s+life\b",
    r"\b(hurt|hurting|harm|harming)\s+myself\b",
    r"\b(cut|cutting)\s+my(self|wrist|wrists|arms)\b",
    r"\boverdose\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bdon'?t\s+want\s+to\s+live\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bcannot\s+go\s+on\s+anymore\b",
]

CRISIS_RESOURCES = [
    CrisisResource(
        name="988 Suicide & Crisis Lifeline",
        contact="988",
        action_type="call",
        description="Free, confidential 24/7 support across the US and Canada (Call or Text 988)."
    ),
    CrisisResource(
        name="Crisis Text Line",
        contact="741741",
        action_type="sms",
        description="Text HOME to 741741 to connect with a crisis counselor 24/7."
    ),
    CrisisResource(
        name="Vandrevala Foundation Helpline",
        contact="+91 9999 666 555",
        action_type="call",
        description="24/7 free mental health support and counseling (India)."
    ),
    CrisisResource(
        name="KIRAN Mental Health Helpline",
        contact="1800-599-0019",
        action_type="call",
        description="Govt. of India 24/7 toll-free mental health rehabilitation helpline."
    ),
    CrisisResource(
        name="International Befrienders",
        contact="https://www.befrienders.org",
        action_type="web",
        description="Worldwide network of emotional support centers and confidential hotlines."
    ),
]


def detect_crisis(message: str) -> bool:
    """Pre-filter layer: detects acute crisis / self-harm expressions before any LLM processing."""
    lowered = message.lower()
    for pattern in CRISIS_PATTERNS:
        if re.search(pattern, lowered):
            return True
    return False


# ─────────────────────────────────────────────────────────────
# 2. CONTEXT BUILDER (Data Minimization)
# ─────────────────────────────────────────────────────────────
def build_user_context(db, user_id: str) -> dict:
    """Collects minimal aggregated summaries (no raw private notes) for personalized response."""
    context = {
        "user_name": "there",
        "avg_sleep_3d": None,
        "latest_stress": None,
        "latest_mood": None,
    }

    # User profile name
    user_row = db.execute("SELECT full_name FROM users WHERE id = ?", (user_id,)).fetchone()
    if user_row and user_row["full_name"]:
        context["user_name"] = user_row["full_name"].split()[0]

    # Rolling 3-day sleep average
    sleep_row = db.execute(
        """SELECT AVG(duration_hours) as avg_sleep 
           FROM sleep_records 
           WHERE user_id = ? AND sleep_date >= date('now', '-3 days')""",
        (user_id,)
    ).fetchone()
    if sleep_row and sleep_row["avg_sleep"]:
        context["avg_sleep_3d"] = round(float(sleep_row["avg_sleep"]), 1)

    # Latest stress assessment
    stress_row = db.execute(
        """SELECT stress_score, stress_level 
           FROM stress_assessments 
           WHERE user_id = ? 
           ORDER BY assessment_date DESC, created_at DESC LIMIT 1""",
        (user_id,)
    ).fetchone()
    if stress_row:
        context["latest_stress"] = {
            "score": stress_row["stress_score"],
            "level": stress_row["stress_level"]
        }

    # Latest mood
    mood_row = db.execute(
        """SELECT mood_score, mood_label 
           FROM mood_entries 
           WHERE user_id = ? 
           ORDER BY entry_date DESC, created_at DESC LIMIT 1""",
        (user_id,)
    ).fetchone()
    if mood_row:
        context["latest_mood"] = {
            "score": mood_row["mood_score"],
            "label": mood_row["mood_label"]
        }

    return context


# ─────────────────────────────────────────────────────────────
# 3. RESPONSE GENERATOR & GUARDRAIL
# ─────────────────────────────────────────────────────────────
def generate_assistant_response(message: str, context: dict) -> Tuple[str, str, List[str]]:
    """
    Intelligent wellness guidance engine with strict non-clinical safety boundaries.
    Returns (response_text, intent, suggested_actions).
    """
    lowered = message.lower()
    name = context.get("user_name", "there")
    avg_sleep = context.get("avg_sleep_3d")
    stress_info = context.get("latest_stress")
    mood_info = context.get("latest_mood")

    # Guardrail: Clinical / Medication / Diagnosis requests
    clinical_keywords = ["prescribe", "medication", "pills", "diagnose", "bipolar disorder", "schizophrenia", "prozac", "xanax", "adderall", "cure my depression"]
    if any(k in lowered for k in clinical_keywords):
        return (
            f"I hear your concern, {name}. As an AI wellness companion, I cannot prescribe medication, provide formal psychiatric diagnoses, or replace a licensed physician. If you are experiencing persistent distress or considering medical treatment, please consult a qualified healthcare provider or psychiatrist for clinical guidance.",
            "clinical_boundary",
            ["Find a Provider", "Contact Emergency Support", "Try Grounding Exercise"]
        )

    # Intent: Sleep & Rest
    if any(k in lowered for k in ["sleep", "insomnia", "tired", "exhausted", "can't sleep", "waking up", "nightmare"]):
        sleep_context = f" I see your recent 3-day sleep has averaged {avg_sleep} hours." if avg_sleep else ""
        return (
            f"Quality rest is fundamental for nervous system recovery, {name}.{sleep_context} When winding down, try a 10-minute digital sunset before bed (lowering screen brightness) and practice 4-7-8 breathing to activate your parasympathetic relaxation response.",
            "sleep_hygiene",
            ["Start 4-7-8 Breathing", "Log Sleep Record", "View Sleep Trends"]
        )

    # Intent: Acute Panic / Overwhelmed / Anxiety
    if any(k in lowered for k in ["panic", "anxious", "anxiety", "overwhelmed", "freaking out", "hyperventilating", "racing thoughts"]):
        stress_context = f" Your latest recorded stress level is {stress_info['score']}/100 ({stress_info['level']})." if stress_info else ""
        return (
            f"Take a slow breath with me right now, {name}.{stress_context} When you feel overwhelmed, try the 5-4-3-2-1 grounding technique:\n"
            f"• Look around for 5 things you can see\n"
            f"• Touch 4 physical objects around you\n"
            f"• Listen for 3 distinct sounds\n"
            f"• Identify 2 things you can smell\n"
            f"• Notice 1 taste or sensation\n"
            f"Your nervous system is safe in this moment.",
            "anxiety_grounding",
            ["Open Breathing Pacer", "Log Stress Check-In", "Go to Support Center"]
        )

    # Intent: Breathing Exercise
    if any(k in lowered for k in ["breathe", "breathing", "box breathing", "pranayama", "calm down"]):
        return (
            f"Breathing exercises are the fastest biological switch to reduce acute cortisol levels. Let's do a guided 4-7-8 cycle:\n"
            f"Inhale quietly through your nose for 4 seconds, hold gently for 7 seconds, and exhale completely with a whoosh for 8 seconds.",
            "breathing_technique",
            ["Start Breathing Exercise", "Log Quick Check-In", "Check Stress Insights"]
        )

    # Intent: Workload & Burnout
    if any(k in lowered for k in ["work", "burnout", "boss", "deadline", "job", "study", "exam", "pressure"]):
        return (
            f"Workload pressure can quickly trigger cognitive overload, {name}. One helpful strategy is micro-breaks: step away from your workstation for 2 minutes every hour. Focus on one single priority task right now and gently set aside secondary demands.",
            "burnout_management",
            ["Review Habit Tracker", "Start Guided Rest", "Check Predictions"]
        )

    # Intent: Mood / Sadness
    if any(k in lowered for k in ["sad", "depressed", "down", "unhappy", "lonely", "crying", "hopeless"]):
        mood_context = f" (Your recent logged mood is '{mood_info['label']}')" if mood_info else ""
        return (
            f"Thank you for sharing that with me, {name}{mood_context}. It is completely valid to have difficult days. Remember to be gentle with yourself today—small acts of care like drinking a glass of water, going for a 5-minute walk, or talking with a trusted friend can offer quiet comfort.",
            "emotional_support",
            ["Log Daily Mood", "Connect with Contacts", "Try Calming Audio"]
        )

    # Default supportive response
    return (
        f"I'm here with you, {name}. Whether you'd like to reflect on your day, explore practical ways to reduce stress, or try a guided breathing session, let me know what would feel most supportive right now.",
        "general_support",
        ["Start 4-7-8 Breathing", "Log Stress Assessment", "View Next-Day Risk"]
    )


# ─────────────────────────────────────────────────────────────
# 4. CHAT ENDPOINTS
# ─────────────────────────────────────────────────────────────
optional_security = HTTPBearer(auto_error=False)

def get_chat_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)) -> str:
    """Extract user_id safely for chat without hard 401 failure in demo or offline mode."""
    if not credentials or not credentials.credentials:
        return "00000000-0000-0000-0000-000000000001"
    token = credentials.credentials
    if token in ("demo-local-session", "demo-token", "demo-access-token"):
        return "00000000-0000-0000-0000-000000000001"
    try:
        from backend.middleware.auth import decode_token
        payload = decode_token(token)
        return payload.get("sub") or "00000000-0000-0000-0000-000000000001"
    except Exception:
        return "00000000-0000-0000-0000-000000000001"

@router.post("", response_model=ChatMessageResponse)
@router.post("/", response_model=ChatMessageResponse)
@router.post("/message", response_model=ChatMessageResponse)
def send_chat_message(
    req: ChatMessageRequest,
    user_id: str = Depends(get_chat_user)
):
    """
    Send a message to the MindEase Assistant.
    Executes:
    1. Crisis Pre-Filter: if triggered, stops immediately, flags safety, and returns crisis hotlines.
    2. Context Builder: compiles recent sleep/stress summaries with data minimization.
    3. Non-Clinical Safety Guardrail & Response Generation.
    4. Persists chat sessions and messages in SQLite database.
    """
    now = datetime.now(timezone.utc).isoformat()
    session_id = req.session_id or str(uuid.uuid4())
    is_crisis = detect_crisis(req.message)

    with get_db() as db:
        # Ensure session exists
        session = db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            db.execute(
                """INSERT INTO chat_sessions (id, user_id, title, started_at, message_count, escalated_to_support)
                   VALUES (?, ?, 'Chat Session', ?, 0, ?)""",
                (session_id, user_id, now, 1 if is_crisis else 0)
            )

        # Build context
        context = build_user_context(db, user_id)

        if is_crisis:
            # 1. Log user message with safety flag
            db.execute(
                """INSERT INTO chat_messages (session_id, user_id, role, content, intent, safety_flag, created_at)
                   VALUES (?, ?, 'user', ?, 'crisis_detected', 1, ?)""",
                (session_id, user_id, req.message, now)
            )

            # 2. Mark session escalated
            db.execute(
                """UPDATE chat_sessions 
                   SET escalated_to_support = 1, message_count = message_count + 1 
                   WHERE id = ?""",
                (session_id,)
            )

            # 3. Crisis guidance reply
            crisis_content = (
                "I am deeply concerned about what you are going through, and I want you to be safe. "
                "You do not have to carry this alone. Please connect right away with compassionate professionals "
                "who are available 24/7 to support you. Free, confidential help is available right now."
            )

            db.execute(
                """INSERT INTO chat_messages (session_id, user_id, role, content, intent, safety_flag, created_at)
                   VALUES (?, ?, 'assistant', ?, 'crisis_support', 1, ?)""",
                (session_id, user_id, crisis_content, now)
            )

            return ChatMessageResponse(
                session_id=session_id,
                role="assistant",
                content=crisis_content,
                intent="crisis_intervention",
                is_crisis=True,
                crisis_resources=CRISIS_RESOURCES,
                disclaimer="URGENT: MindEase is an automated wellness app and cannot manage acute medical crises. Please call 988 or your local emergency services immediately.",
                suggested_actions=["Call 988 Lifeline", "Text HOME to 741741", "Open Emergency Support Screen"]
            )

        # Normal Flow
        bot_reply, intent, suggested_actions = generate_assistant_response(req.message, context)

        # Insert user message
        db.execute(
            """INSERT INTO chat_messages (session_id, user_id, role, content, intent, safety_flag, created_at)
               VALUES (?, ?, 'user', ?, ?, 0, ?)""",
            (session_id, user_id, req.message, intent, now)
        )

        # Insert assistant message
        db.execute(
            """INSERT INTO chat_messages (session_id, user_id, role, content, intent, safety_flag, created_at)
               VALUES (?, ?, 'assistant', ?, ?, 0, ?)""",
            (session_id, user_id, bot_reply, intent, now)
        )

        # Update message count
        db.execute(
            """UPDATE chat_sessions 
               SET message_count = message_count + 2 
               WHERE id = ?""",
            (session_id,)
        )

        return ChatMessageResponse(
            session_id=session_id,
            role="assistant",
            content=bot_reply,
            intent=intent,
            is_crisis=False,
            crisis_resources=None,
            disclaimer="MindEase is an AI wellness companion, not a licensed therapist or physician.",
            suggested_actions=suggested_actions
        )


@router.get("/history", response_model=ChatHistoryResponse)
@router.get("/history/", response_model=ChatHistoryResponse)
def get_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    """Retrieve chat message history for the active session or most recent session."""
    with get_db() as db:
        if not session_id:
            recent_session = db.execute(
                """SELECT id FROM chat_sessions 
                   WHERE user_id = ? 
                   ORDER BY started_at DESC LIMIT 1""",
                (user_id,)
            ).fetchone()
            if recent_session:
                session_id = recent_session["id"]
            else:
                return ChatHistoryResponse(session_id=None, messages=[])

        messages = db.execute(
            """SELECT id, role, content, safety_flag, created_at 
               FROM chat_messages 
               WHERE session_id = ? AND user_id = ? 
               ORDER BY id ASC""",
            (session_id, user_id)
        ).fetchall()

        return ChatHistoryResponse(
            session_id=session_id,
            messages=[
                ChatMessageItem(
                    id=m["id"],
                    role=m["role"],
                    content=m["content"],
                    created_at=m["created_at"],
                    safety_flag=bool(m["safety_flag"])
                )
                for m in messages
            ]
        )


@router.delete("/history")
@router.delete("/history/")
def delete_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    """Delete chat history for privacy compliance (Phase 7 Privacy Center)."""
    with get_db() as db:
        if session_id:
            db.execute("DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?", (session_id, user_id))
            db.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        else:
            db.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
            db.execute("DELETE FROM chat_sessions WHERE user_id = ?", (user_id,))

        db.execute(
            "INSERT INTO audit_logs (user_id, action, created_at) VALUES (?, 'delete_chat_history', ?)",
            (user_id, datetime.now(timezone.utc).isoformat())
        )

    return {"message": "Chat history deleted successfully"}

