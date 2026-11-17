"""
Model loader and prediction engine.
Loads the trained joblib model and provides prediction + explanation capabilities.
"""
import os
import numpy as np
import joblib
from typing import Optional, Dict, List, Tuple

FEATURES = [
    "mood_score", "stress_score", "sleep_duration", "sleep_quality", "steps", "active_minutes",
    "resting_hr", "hrv", "habit_completion", "previous_stress", "stress_3d_mean", "stress_7d_mean",
    "mood_3d_mean", "sleep_3d_mean", "sleep_7d_std", "steps_7d_mean", "day_of_week", "is_weekend",
    "has_wearable",
]

FACTOR_GROUPS = {
    "Sleep": ["sleep_duration", "sleep_quality", "sleep_3d_mean", "sleep_7d_std"],
    "Mood": ["mood_score", "mood_3d_mean"],
    "Activity": ["steps", "active_minutes", "steps_7d_mean"],
    "Stress Assessment": ["stress_score", "previous_stress", "stress_3d_mean", "stress_7d_mean"],
    "Heart Rate": ["resting_hr", "hrv"],
    "Habits": ["habit_completion"],
}

RISK_THRESHOLDS = {"low": (0, 30), "moderate": (31, 60), "elevated": (61, 80), "high": (81, 100)}


class StressPredictor:
    """Loads the trained model and performs predictions with explanations."""

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = None
        self.model_name = "unknown"
        self.model_version = "1.0.0-synthetic"
        self.features = FEATURES
        self._surrogate = None  # logistic regression for explanations
        self._load()

    def _load(self):
        """Load the trained model from joblib."""
        if not os.path.exists(self.model_path):
            print(f"[WARNING] Model file not found at {self.model_path}")
            return
        bundle = joblib.load(self.model_path)
        self.model = bundle["model"]
        self.features = bundle.get("features", FEATURES)
        # Try to detect model name from pipeline
        clf = self.model.named_steps.get("clf", None)
        if clf is not None:
            name = type(clf).__name__
            name_map = {"XGBClassifier": "xgboost", "RandomForestClassifier": "random_forest",
                        "LogisticRegression": "logistic_regression"}
            self.model_name = name_map.get(name, name.lower())
        print(f"[OK] Model loaded: {self.model_name} (v{self.model_version})")

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def _risk_level(self, score: int) -> str:
        if score <= 30:
            return "low"
        elif score <= 60:
            return "moderate"
        elif score <= 80:
            return "elevated"
        return "high"

    def predict(self, features: Dict[str, Optional[float]]) -> Dict:
        """
        Run prediction and generate explanations.

        Args:
            features: dict with feature names as keys

        Returns:
            dict with risk_score, risk_level, confidence, factors
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")

        # Build feature vector (replace None with NaN for the imputer)
        X = np.array([[features.get(f, np.nan) for f in self.features]])

        # Get probability
        prob = self.model.predict_proba(X)[0, 1]
        risk_score = int(np.clip(np.round(prob * 100), 0, 100))
        risk_level = self._risk_level(risk_score)
        confidence = round(float(max(prob, 1 - prob)), 3)

        # Generate explanations via surrogate approach
        factors = self._explain(X)

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "factors": factors,
            "model_name": self.model_name,
            "model_version": self.model_version,
        }

    def _explain(self, X: np.ndarray) -> List[Dict]:
        """
        Generate factor-level explanations using the model's pipeline.
        Uses coefficient × standardized feature value for LR, or
        feature importance weighting for tree models.
        """
        factors = []

        try:
            # Try to get the imputer and scaler from the pipeline
            imp = self.model.named_steps.get("imp")
            sc = self.model.named_steps.get("sc")
            clf = self.model.named_steps.get("clf")

            if imp is not None:
                X_imp = imp.transform(X)
            else:
                X_imp = np.nan_to_num(X, nan=0.0)

            # Feature index map
            fi = {f: i for i, f in enumerate(self.features)}

            if sc is not None and hasattr(clf, "coef_"):
                # Logistic regression: coefficient × standardised value
                Z = sc.transform(X_imp)
                contrib = Z[0] * clf.coef_[0]
            elif hasattr(clf, "feature_importances_"):
                # Tree models: feature importance × (value - median)
                importances = clf.feature_importances_
                # Use sign of (value - 0) as proxy for direction
                contrib = importances * np.sign(X_imp[0] - np.nanmedian(X_imp[0]))
            else:
                # Fallback: equal contribution
                contrib = np.ones(len(self.features))

            # Group contributions
            group_contrib = {}
            for group, feats in FACTOR_GROUPS.items():
                idxs = [fi[f] for f in feats if f in fi]
                if idxs:
                    group_contrib[group] = float(np.sum(contrib[idxs]))

            # Normalize to percentages and sort by absolute impact
            total = sum(abs(v) for v in group_contrib.values()) or 1.0
            sorted_groups = sorted(group_contrib.items(), key=lambda x: abs(x[1]), reverse=True)

            for name, val in sorted_groups[:4]:
                factors.append({
                    "factor_name": name,
                    "impact_pct": round(100 * abs(val) / total, 1),
                    "direction": "increases_risk" if val > 0 else "reduces_risk",
                })
        except Exception as e:
            print(f"⚠ Explanation generation failed: {e}")
            factors = [{"factor_name": "Unknown", "impact_pct": 100.0, "direction": "increases_risk"}]

        return factors
