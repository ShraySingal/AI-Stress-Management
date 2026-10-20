#!/usr/bin/env python3
"""
Train and compare stress-risk models, then build the prediction-related tables.

Input : dataset/ml_training_dataset.csv   (from generate_dataset.py)
Output: dataset/model_comparison.csv, dataset/evaluation_report.json,
        dataset/predictions.csv, dataset/prediction_factors.csv,
        dataset/recommendations.csv, dataset/best_model.joblib

Target: next_day_high_stress  (next-day stress score >= 61, "Elevated" or above)

Methodology notes (put these in your report):
  * Train/test split is BY USER (GroupShuffleSplit) so no user appears in both sets.
  * predictions.csv uses out-of-fold predictions (GroupKFold), so every prediction
    comes from a model that never saw that user during training.
  * Explanations (prediction_factors) come from a logistic-regression surrogate:
    coefficient x standardised feature value, grouped into user-friendly factors.
  * Data is SYNTHETIC. Metrics demonstrate the pipeline, not real-world accuracy.

Usage:  python train_model.py --data dataset
"""
import argparse
import json
import os
import uuid

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except ImportError:  # optional
    XGBClassifier = None

FEATURES = ["mood_score", "stress_score", "sleep_duration", "sleep_quality", "steps", "active_minutes",
            "resting_hr", "hrv", "habit_completion", "previous_stress", "stress_3d_mean", "stress_7d_mean",
            "mood_3d_mean", "sleep_3d_mean", "sleep_7d_std", "steps_7d_mean", "day_of_week", "is_weekend",
            "has_wearable"]
TARGET = "next_day_high_stress"

# user-facing factor groups for explainability
FACTOR_GROUPS = {
    "Sleep": ["sleep_duration", "sleep_quality", "sleep_3d_mean", "sleep_7d_std"],
    "Mood": ["mood_score", "mood_3d_mean"],
    "Activity": ["steps", "active_minutes", "steps_7d_mean"],
    "Stress Assessment": ["stress_score", "previous_stress", "stress_3d_mean", "stress_7d_mean"],
    "Heart Rate": ["resting_hr", "hrv"],
    "Habits": ["habit_completion"],
}
RECS = {
    "Sleep": ("sleep", "Protect your sleep", "Try to keep your usual bedtime tonight and wind down 30 minutes earlier."),
    "Mood": ("mood", "Reflect on your mood", "Consider noting what may be contributing to your current mood."),
    "Activity": ("activity", "Take a short walk", "A 10-15 minute walk can help. Light movement is enough."),
    "Stress Assessment": ("breathing", "Try a 5-minute breathing exercise", "A short guided breathing session may help you reset."),
    "Heart Rate": ("break", "Take a short break", "Your heart-rate pattern is a little elevated. Consider a relaxation break."),
    "Habits": ("habit", "Pick one small habit", "Choose one easy habit to complete today to rebuild your routine."),
}
RISK_THRESHOLDS = [(30, "low"), (60, "moderate"), (80, "elevated"), (100, "high")]


def level(score):
    s = np.asarray(score)
    return np.select([s <= 30, s <= 60, s <= 80], ["low", "moderate", "elevated"], default="high")


def make_models(pos_weight):
    models = {
        "logistic_regression": Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()),
                                         ("clf", LogisticRegression(max_iter=1000, class_weight="balanced"))]),
        "random_forest": Pipeline([("imp", SimpleImputer(strategy="median")),
                                   ("clf", RandomForestClassifier(n_estimators=300, min_samples_leaf=10, n_jobs=-1,
                                                                  class_weight="balanced", random_state=42))]),
    }
    if XGBClassifier is not None:
        models["xgboost"] = Pipeline([("imp", SimpleImputer(strategy="median")),
                                      ("clf", XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05,
                                                            subsample=0.8, colsample_bytree=0.8, eval_metric="logloss",
                                                            scale_pos_weight=pos_weight, random_state=42))])
    return models


def metrics(y, prob, thr=0.5):
    pred = (prob >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {"accuracy": accuracy_score(y, pred), "precision": precision_score(y, pred, zero_division=0),
            "recall": recall_score(y, pred), "f1": f1_score(y, pred), "roc_auc": roc_auc_score(y, prob),
            "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="dataset")
    a = ap.parse_args()
    rng = np.random.default_rng(7)

    df = pd.read_csv(os.path.join(a.data, "ml_training_dataset.csv"), parse_dates=["date"])
    X, y, groups = df[FEATURES], df[TARGET].values, df["user_id"].values
    pos_weight = (y == 0).sum() / (y == 1).sum()

    # ---------- model comparison on a user-level hold-out set ----------
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(X, y, groups))
    results, fitted = {}, {}
    for name, model in make_models(pos_weight).items():
        model.fit(X.iloc[tr], y[tr])
        results[name] = metrics(y[te], model.predict_proba(X.iloc[te])[:, 1])
        fitted[name] = model

    # naive baseline: "tomorrow will be high if today is high" (shows the ML adds value)
    base = (df["stress_score"].values[te] >= 61).astype(float)
    results["baseline_persistence"] = metrics(y[te], base)

    comp = pd.DataFrame(results).T
    comp.index.name = "model"
    comp.round(4).to_csv(os.path.join(a.data, "model_comparison.csv"))
    print("\nHold-out (unseen users) results:")
    print(comp[["accuracy", "precision", "recall", "f1", "roc_auc"]].round(3).to_string())

    best = max((m for m in fitted), key=lambda m: results[m]["roc_auc"])
    print(f"\nBest model by ROC-AUC: {best}")

    # ---------- out-of-fold predictions for every row ----------
    oof = np.zeros(len(df))
    for tri, tei in GroupKFold(n_splits=5).split(X, y, groups):
        m = make_models(pos_weight)[best]
        m.fit(X.iloc[tri], y[tri])
        oof[tei] = m.predict_proba(X.iloc[tei])[:, 1]

    # final model on all data (what you would deploy)
    final = make_models(pos_weight)[best].fit(X, y)
    joblib.dump({"model": final, "features": FEATURES, "target": TARGET}, os.path.join(a.data, "best_model.joblib"))

    # ---------- logistic-regression surrogate for explanations ----------
    lr = make_models(pos_weight)["logistic_regression"].fit(X, y)
    Z = lr.named_steps["sc"].transform(lr.named_steps["imp"].transform(X))
    contrib = Z * lr.named_steps["clf"].coef_[0]
    fi = {f: i for i, f in enumerate(FEATURES)}
    names = list(FACTOR_GROUPS)
    G = np.column_stack([contrib[:, [fi[f] for f in FACTOR_GROUPS[g]]].sum(1) for g in names])

    # ---------- predictions ----------
    n = len(df)
    pred_ids = [str(uuid.UUID(bytes=rng.bytes(16), version=4)) for _ in range(n)]
    risk = np.rint(oof * 100).astype(int)
    predictions = pd.DataFrame({
        "id": pred_ids, "user_id": df["user_id"].values,
        "prediction_date": df["date"].dt.date.values,
        "target_date": (df["date"] + pd.Timedelta(days=1)).dt.date.values,
        "prediction_window": "next_day",
        "risk_score": risk, "risk_level": level(risk),
        "confidence": np.maximum(oof, 1 - oof).round(3),
        "model_name": best, "model_version": "1.0.0-synthetic",
        "actual_next_day_stress": df["next_day_stress_score"].values,
        "actual_high_stress": y,
    })

    # ---------- prediction_factors (top 4 by absolute contribution) ----------
    order = np.argsort(-np.abs(G), axis=1)[:, :4]
    absG = np.abs(G).sum(1, keepdims=True)
    f_rows = []
    for i in range(n):
        for j in order[i]:
            f_rows.append((pred_ids[i], names[j], round(100 * abs(G[i, j]) / absG[i, 0], 1),
                           "increases_risk" if G[i, j] > 0 else "reduces_risk"))
    prediction_factors = pd.DataFrame(f_rows, columns=["prediction_id", "factor_name", "impact_pct", "direction"])
    prediction_factors.insert(0, "id", np.arange(1, len(prediction_factors) + 1))

    # ---------- recommendations (rule-based on top risk-increasing factors) ----------
    r_rows = []
    status_p = rng.random(n)
    for i in np.where(risk > 30)[0]:  # only when risk is above "low"
        ups = [names[j] for j in order[i] if G[i, j] > 0][:2]
        for rank, fname in enumerate(ups):
            cat, title, body = RECS[fname]
            r_rows.append({"prediction_id": pred_ids[i], "user_id": df["user_id"].values[i], "category": cat,
                           "title": title, "body": body, "priority": rank + 1,
                           "status": "completed" if status_p[i] < 0.3 else ("dismissed" if status_p[i] < 0.4 else "pending"),
                           "created_at": df["date"].values[i]})
    recommendations = pd.DataFrame(r_rows)
    recommendations.insert(0, "id", np.arange(1, len(recommendations) + 1))

    predictions.to_csv(os.path.join(a.data, "predictions.csv"), index=False)
    prediction_factors.to_csv(os.path.join(a.data, "prediction_factors.csv"), index=False)
    recommendations.to_csv(os.path.join(a.data, "recommendations.csv"), index=False)

    report = {"best_model": best, "holdout_metrics": results, "features": FEATURES,
              "target": "next-day stress score >= 61", "split": "GroupShuffleSplit by user, 80/20",
              "positive_rate": float(y.mean()),
              "warning": "Trained on synthetic data. Not clinically validated. Not a medical tool."}
    with open(os.path.join(a.data, "evaluation_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    print(f"\npredictions: {len(predictions):,} | prediction_factors: {len(prediction_factors):,} | "
          f"recommendations: {len(recommendations):,}")
    print("Risk level distribution:\n", predictions["risk_level"].value_counts(normalize=True).round(3).to_string())


if __name__ == "__main__":
    main()
