"""
ML Service module alias pointing to backend.ml_service for seamless backward compatibility.
All primary ML service code is consolidated under backend/ml_service/.
"""
from backend.ml_service import predictor, schemas

__all__ = ["predictor", "schemas"]
