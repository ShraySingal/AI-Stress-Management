"""
ML Prediction Service — FastAPI
Endpoints: /predict, /health, /model-info

Run: uvicorn ml_service.main:app --port 8001
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ml_service.schemas import PredictionInput, PredictionOutput, FactorImpact, ModelInfo, HealthCheck
from ml_service.predictor import StressPredictor, FEATURES, RISK_THRESHOLDS

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "best_model.joblib")

app = FastAPI(
    title="Stress Risk ML Service",
    description="Next-day stress risk prediction with explanations",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup
predictor = StressPredictor(MODEL_PATH)


@app.get("/health", response_model=HealthCheck)
def health_check():
    """Health check endpoint."""
    return HealthCheck(
        status="healthy" if predictor.is_loaded else "degraded",
        model_loaded=predictor.is_loaded,
        version="1.0.0",
    )


@app.get("/model-info", response_model=ModelInfo)
def model_info():
    """Return metadata about the loaded model."""
    return ModelInfo(
        model_name=predictor.model_name,
        model_version=predictor.model_version,
        features=FEATURES,
        target="next-day stress score >= 61",
        risk_thresholds={k: {"min": v[0], "max": v[1]} for k, v in RISK_THRESHOLDS.items()},
        status="loaded" if predictor.is_loaded else "not_loaded",
    )


@app.post("/predict", response_model=PredictionOutput)
def predict(data: PredictionInput):
    """
    Predict next-day stress risk.

    Requires at minimum stress_score and sleep_duration to produce
    a meaningful prediction. With fewer than ~3 days of data in the
    rolling features, the model returns an 'early estimate' caveat.
    """
    if not predictor.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded. Ensure best_model.joblib is available.")

    # Check minimum data requirement
    required_minimum = [data.stress_score, data.sleep_duration]
    if all(v is None for v in required_minimum):
        raise HTTPException(
            status_code=422,
            detail="Not enough data. Provide at least stress_score and sleep_duration.",
        )

    # Build feature dict
    features = {
        "mood_score": data.mood_score,
        "stress_score": data.stress_score,
        "sleep_duration": data.sleep_duration,
        "sleep_quality": data.sleep_quality,
        "steps": data.steps,
        "active_minutes": data.active_minutes,
        "resting_hr": data.resting_hr,
        "hrv": data.hrv,
        "habit_completion": data.habit_completion,
        "previous_stress": data.previous_stress,
        "stress_3d_mean": data.stress_3d_mean,
        "stress_7d_mean": data.stress_7d_mean,
        "mood_3d_mean": data.mood_3d_mean,
        "sleep_3d_mean": data.sleep_3d_mean,
        "sleep_7d_std": data.sleep_7d_std,
        "steps_7d_mean": data.steps_7d_mean,
        "day_of_week": data.day_of_week,
        "is_weekend": data.is_weekend,
        "has_wearable": data.has_wearable,
    }

    try:
        result = predictor.predict(features)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    # Determine if this is an early estimate (missing rolling features)
    rolling_features = [data.stress_3d_mean, data.stress_7d_mean, data.mood_3d_mean,
                        data.sleep_3d_mean, data.sleep_7d_std, data.steps_7d_mean]
    is_early = sum(1 for f in rolling_features if f is None) >= 4
    warning = ("Early estimate — limited history available. Accuracy improves after 7 days of check-ins."
               if is_early else "This is an estimate based on recent patterns, not a diagnosis.")

    return PredictionOutput(
        user_id=data.user_id,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        confidence=result["confidence"],
        factors=[FactorImpact(**f) for f in result["factors"]],
        model_name=result["model_name"],
        model_version=result["model_version"],
        warning=warning,
    )
