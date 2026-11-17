# MindPulse — Solution Methodology Documentation

## 1. Problem Statement

Predict whether a user will experience **high stress** (score >= 61) on the following day,
given 19 biometric and behavioral features collected via wearables, mood trackers, and
habit logs.

## 2. Data Overview

| Property | Value |
|---|---|
| Total Samples | 22,112 |
| Feature Count | 19 |
| Target | 
ext_day_high_stress (binary) |
| Positive Class Prevalence | 24.94% |
| Data Source | Synthetic biometric simulator |

### Feature Categories

| Category | Features | Count |
|---|---|---|
| Sleep | sleep_duration, sleep_quality, sleep_3d_mean, sleep_7d_std | 4 |
| Mood | mood_score, mood_3d_mean | 2 |
| Activity | steps, ctive_minutes, steps_7d_mean | 3 |
| Stress Assessment | stress_score, previous_stress, stress_3d_mean, stress_7d_mean | 4 |
| Heart Rate | 
esting_hr, hrv | 2 |
| Habits | habit_completion | 1 |
| Temporal | day_of_week, is_weekend | 2 |
| Device | has_wearable | 1 |

## 3. Methodology

### 3.1 Data Preprocessing
- Missing value imputation (median strategy via SimpleImputer)
- Feature standardization (StandardScaler)
- Stratified train/test split (80/20)
- Group-based split for unseen-user generalization testing

### 3.2 Model Selection
Three classifiers were evaluated:
1. **Baseline Random Forest** — unweighted, 200 estimators
2. **Improved Balanced Random Forest** — class_weight='balanced', 300 estimators, max_depth=12
3. **Tuned XGBoost** — scale_pos_weight calibrated, 300 estimators, max_depth=6, learning_rate=0.05

### 3.3 Threshold Optimization
Decision threshold swept from 0.10 to 0.95 in steps of 0.01.
Optimal threshold selected by maximizing F1-score on validation fold.

### 3.4 Explanation Generation
Factor-level explanations produced via:
- Feature importance weighting (tree models)
- Surrogate logistic regression coefficients (standardized)
- Grouped into 6 clinical categories (Sleep, Mood, Activity, Stress, Heart Rate, Habits)

## 4. Results Summary

| Model | Accuracy | Precision | Recall | F1 | ROC AUC |
|---|---|---|---|---|---|
| Baseline RF | 0.8512 | 0.7658 | 0.5811 | 0.6608 | 0.8981 |
| Balanced RF | 0.8275 | 0.6232 | 0.7797 | 0.6927 | 0.9009 |
| **Tuned XGBoost** | **0.8270** | **0.6211** | **0.7860** | **0.6939** | **0.9011** |

Key improvements over baseline:
- **Recall**: +19.86 percentage points (0.5811 → 0.7860)
- **False Negatives**: reduced from 462 to 236 (nearly halved)
- **ROC AUC**: improved from 0.8981 to 0.9011

## 5. Architecture

`	ext
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Frontend   │────▶│  FastAPI      │────▶│  ML Service   │
│  (SPA)      │◀────│  Backend      │◀────│  (predictor)  │
└─────────────┘     └──────┬───────┘     └───────────────┘
                           │
                    ┌──────▼───────┐
                    │  SQLite DB   │
                    │  (capstone)  │
                    └──────────────┘
`

## 6. Reproducibility

All experiments are fully reproducible. See README.md → **Reproduction & Execution Guide** for step-by-step instructions.

## 7. Future Directions

- Integration with real wearable APIs (Fitbit, Apple Health, Google Fit)
- LSTM / Transformer-based temporal stress modeling
- Federated learning for privacy-preserving multi-user training
- Mobile application (React Native / Flutter)
