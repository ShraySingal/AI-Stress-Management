# MindPulse — AI Stress & Mental Health Analytics Platform

Full-stack mental health tracking and **next-day stress risk prediction** system.
Combines a FastAPI backend, an ML inference service (Random Forest / XGBoost on 19 biometric features),
a responsive single-page frontend, and a SQLite data layer — evaluated using stratified holdout
and group-split (unseen users) cross-validation.

---

## 📁 Repository Structure

`	ext
AI-Stress-Management/
│
├── backend/                     # FastAPI backend service
│   ├── main.py                  # App entrypoint, lifespan, route registration
│   ├── config.py                # Environment & settings
│   ├── database.py              # SQLite connection & schema init
│   ├── middleware/
│   │   └── auth.py              # JWT-based authentication middleware
│   ├── models/
│   │   └── __init__.py          # SQLAlchemy / Pydantic models
│   ├── routes/
│   │   ├── auth.py              # Login, signup, token refresh
│   │   ├── users.py             # User profile CRUD
│   │   ├── trackers.py          # Mood, sleep, activity tracker endpoints
│   │   ├── dashboard.py         # Aggregated analytics dashboard
│   │   ├── predictions.py       # ML prediction API (calls ml_service)
│   │   └── habits.py            # Habit definitions & daily logging
│   └── schemas/
│       └── api.py               # Request / response Pydantic schemas
│
├── ml_service/                  # Machine Learning inference microservice
│   ├── main.py                  # FastAPI wrapper for prediction endpoints
│   ├── predictor.py             # Model loader, prediction & explanation engine
│   └── schemas.py               # ML-specific request/response schemas
│
├── frontend/                    # Single-page application (HTML/CSS/JS)
│   ├── index.html               # Main SPA entry
│   ├── css/
│   │   └── style.css            # Responsive stylesheet
│   └── js/
│       └── app.js               # Client-side logic & API integration
│
├── dataset/                     # Data assets (git-ignored; see .gitignore)
│   ├── ml_training_dataset.csv  # 22,112-row synthetic training set
│   ├── best_model.joblib        # Trained pipeline bundle (imputer+scaler+clf)
│   ├── evaluation_report.json   # Detailed evaluation metrics (JSON)
│   ├── model_comparison.csv     # Side-by-side model comparison table
│   └── *.csv                    # Per-table exports from capstone.db
│
├── scripts/                     # Utility & training scripts
│   ├── train_model.py           # End-to-end training pipeline
│   ├── evaluate_comprehensive.py # Full evaluation with confusion matrices
│   └── seed_data.py             # Database seeding from CSV exports
│
├── db/
│   └── migrations/
│       └── 001_initial_schema.sql  # DDL for all 17 application tables
│
├── tests/                       # Automated test suite
│   └── test_api.py              # End-to-end API integration tests (6 tests)
│
├── files/                       # Standalone data-generation utilities
│   ├── generate_dataset.py      # Synthetic dataset generator
│   ├── train_model.py           # Alternate training script
│   └── requirements.txt         # ML-only pip dependencies
│
├── Documentation_template.md    # Official solution methodology documentation
├── README.md                    # Project overview & guidelines (this file)
├── requirements.txt             # Python dependencies
└── .gitignore                   # Git ignore rules
`

---

## 👤 Project Scope & Responsibilities

- **Backend API** (ackend/): RESTful endpoints for user management, mood/sleep/stress tracking, habit logging, dashboard analytics, and ML prediction orchestration.
- **ML Service** (ml_service/): Standalone prediction engine wrapping a trained scikit-learn / XGBoost pipeline. Generates risk scores (0–100), risk levels, confidence values, and factor-level explanations via surrogate models.
- **Frontend SPA** (rontend/): Responsive single-page application providing login, dashboard visualization, mood/stress entry forms, and real-time prediction display.
- **Data & Training** (scripts/, iles/, dataset/): Synthetic biometric data generation, model training (Balanced Random Forest, Tuned XGBoost), hyperparameter optimization, and comprehensive evaluation.

---

## 📊 Benchmark Results (Validation Set)

Evaluated on the **22,112-sample synthetic biometric dataset** with stratified 80/20 holdout split:

| Metric | Baseline RF | Improved Balanced RF | Tuned XGBoost | Notes |
|---|---|---|---|---|
| **Accuracy** | 0.8512 | 0.8275 | 0.8270 | Trade-off for higher recall |
| **Precision** | 0.7658 | 0.6232 | 0.6211 | Balanced for clinical use |
| **Recall** | 0.5811 | **0.7797** | **0.7860** | +19.86pp gain over baseline |
| **F1 Score** | 0.6608 | 0.6927 | **0.6939** | Best overall harmonic mean |
| **ROC AUC** | 0.8981 | 0.9009 | **0.9011** | Strong class separation |
| **False Negatives** | 462 | 243 | **236** | Nearly halved vs baseline |

### Breakdown by Evaluation Strategy

- **Stratified Holdout** (4,422 samples): Best F1 = **0.6939** (Tuned XGBoost at threshold 0.58)
- **Unseen Users Group Split** (4,219 samples): Best F1 = **0.6762** (Tuned XGBoost at threshold 0.58)
- **Optimal Classification Threshold**: 0.54–0.58 (empirically selected via threshold sweep)

### Key Features (19 Biometric Dimensions)

`	ext
mood_score, stress_score, sleep_duration, sleep_quality, steps, active_minutes,
resting_hr, hrv, habit_completion, previous_stress, stress_3d_mean, stress_7d_mean,
mood_3d_mean, sleep_3d_mean, sleep_7d_std, steps_7d_mean, day_of_week, is_weekend,
has_wearable
`

---

## 🚀 Reproduction & Execution Guide

### 1. Environment Setup

`ash
# Clone the repository
git clone https://github.com/ShraySingal/AI-Stress-Management.git
cd AI-Stress-Management

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows

# Install dependencies
pip install -r requirements.txt
`

### 2. Train the ML Model

Executes feature engineering, trains Balanced Random Forest + Tuned XGBoost, sweeps decision thresholds, and saves dataset/best_model.joblib:

`ash
python scripts/train_model.py
`

### 3. Run Comprehensive Evaluation

Generates confusion matrices, classification reports, and updates dataset/evaluation_report.json and dataset/model_comparison.csv:

`ash
python scripts/evaluate_comprehensive.py
`

### 4. Seed the Database

Populates the SQLite database with synthetic CSV data for all 17 tables:

`ash
python scripts/seed_data.py
`

### 5. Start the Application

Launches the FastAPI backend (serves both API and frontend SPA):

`ash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
`

Then open [http://localhost:8000](http://localhost:8000) in your browser.

### 6. Run Tests

Validates API health, authentication, mood/stress tracking, and dashboard endpoints:

`ash
python -m pytest tests/ -v
`

### 7. Validate Submission Files

Checks dataset integrity, model loading, and prediction outputs:

`ash
python scripts/evaluate_comprehensive.py --validate
`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | FastAPI 0.104+ |
| **ML Framework** | scikit-learn, XGBoost, joblib |
| **Database** | SQLite 3 (via Python stdlib) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Authentication** | JWT (JSON Web Tokens) |
| **Testing** | pytest, FastAPI TestClient |
| **Data Processing** | pandas, NumPy |

---

## 📐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | User authentication, returns JWT |
| POST | /api/auth/signup | New user registration |
| GET | /api/dashboard/summary | Aggregated health analytics |
| POST | /api/mood | Log a mood entry |
| GET | /api/mood | Retrieve mood history |
| POST | /api/stress | Submit stress assessment |
| GET | /api/predictions/latest | Get latest stress prediction |
| POST | /api/predictions/predict | Run ML prediction with features |
| GET | /api/habits | List habit definitions |
| POST | /api/habits/log | Log daily habit completion |
| GET | /api/health | Service health check |

---

## 📝 License

This project was developed as a capstone project for academic evaluation.
