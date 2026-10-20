import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split, GroupShuffleSplit
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from xgboost import XGBClassifier

df = pd.read_csv(r"C:\Users\shray\OneDrive\Desktop\AI-Stress-Management\dataset\ml_training_dataset.csv")
features = [
    "mood_score", "stress_score", "sleep_duration", "sleep_quality", "steps", "active_minutes",
    "resting_hr", "hrv", "habit_completion", "previous_stress", "stress_3d_mean", "stress_7d_mean",
    "mood_3d_mean", "sleep_3d_mean", "sleep_7d_std", "steps_7d_mean", "day_of_week", "is_weekend",
    "has_wearable"
]
X = df[features]
y = df["next_day_high_stress"]
groups = df["user_id"]

X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(gss.split(X, y, groups))
X_train_g, X_test_g = X.iloc[train_idx], X.iloc[test_idx]
y_train_g, y_test_g = y.iloc[train_idx], y.iloc[test_idx]

def eval_pipe(pipe, X_tr, y_tr, X_te, y_te, name="Model"):
    pipe.fit(X_tr, y_tr)
    probs = pipe.predict_proba(X_te)[:, 1]
    
    preds = (probs >= 0.5).astype(int)
    acc = accuracy_score(y_te, preds)
    prec = precision_score(y_te, preds, zero_division=0)
    rec = recall_score(y_te, preds, zero_division=0)
    f1 = f1_score(y_te, preds, zero_division=0)
    auc = roc_auc_score(y_te, probs)
    tn, fp, fn, tp = confusion_matrix(y_te, preds).ravel()
    
    best_th = 0.5
    best_f1 = f1
    for th in np.arange(0.3, 0.75, 0.02):
        th_preds = (probs >= th).astype(int)
        th_f1 = f1_score(y_te, th_preds, zero_division=0)
        if th_f1 > best_f1:
            best_f1 = th_f1
            best_th = th
            
    th_preds = (probs >= best_th).astype(int)
    b_acc = accuracy_score(y_te, th_preds)
    b_prec = precision_score(y_te, th_preds, zero_division=0)
    b_rec = recall_score(y_te, th_preds, zero_division=0)
    
    return {
        "name": name,
        "acc": acc, "prec": prec, "rec": rec, "f1": f1, "auc": auc,
        "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn),
        "best_th": float(best_th), "b_f1": float(best_f1), "b_acc": float(b_acc),
        "b_prec": float(b_prec), "b_rec": float(b_rec)
    }

models = [
    ("Original Baseline RF (No Balancing)", RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)),
    ("Improved Balanced RF (n=300, d=12, leaf=4)", RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_leaf=4, class_weight="balanced", random_state=42, n_jobs=-1)),
    ("Tuned XGBoost (d=5, scale_weight=2.8, lr=0.05)", XGBClassifier(n_estimators=250, max_depth=5, learning_rate=0.05, scale_pos_weight=2.8, subsample=0.8, colsample_bytree=0.8, random_state=42, eval_metric="logloss", n_jobs=-1))
]

print("=== STRATIFIED 80/20 SPLIT EVALUATION (4,422 Holdout Samples) ===")
for label, clf in models:
    pipe = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()), ("clf", clf)])
    res = eval_pipe(pipe, X_train_s, y_train_s, X_test_s, y_test_s, label)
    print("--------------------------------------------------")
    print(res["name"])
    print(f"  At default threshold 0.50:")
    print(f"    Accuracy:  {res['acc']:.4f} ({res['acc']*100:.2f}%)")
    print(f"    Precision: {res['prec']:.4f} ({res['prec']*100:.2f}%)")
    print(f"    Recall:    {res['rec']:.4f} ({res['rec']*100:.2f}%)")
    print(f"    F1-Score:  {res['f1']:.4f} ({res['f1']*100:.2f}%)")
    print(f"    ROC-AUC:   {res['auc']:.4f}")
    print(f"    Confusion: TP={res['tp']}, FP={res['fp']}, TN={res['tn']}, FN={res['fn']}")
    print(f"  At optimal F1 threshold ({res['best_th']:.2f}):")
    print(f"    Accuracy:  {res['b_acc']:.4f} ({res['b_acc']*100:.2f}%)")
    print(f"    Precision: {res['b_prec']:.4f} ({res['b_prec']*100:.2f}%)")
    print(f"    Recall:    {res['b_rec']:.4f} ({res['b_rec']*100:.2f}%)")
    print(f"    F1-Score:  {res['b_f1']:.4f} ({res['b_f1']*100:.2f}%)")

print("\n=== GROUP SPLIT / UNSEEN USERS EVALUATION (4,219 Holdout Samples) ===")
for label, clf in models:
    pipe = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()), ("clf", clf)])
    res = eval_pipe(pipe, X_train_g, y_train_g, X_test_g, y_test_g, label)
    print("--------------------------------------------------")
    print(res["name"])
    print(f"  At default threshold 0.50:")
    print(f"    Accuracy:  {res['acc']:.4f} ({res['acc']*100:.2f}%)")
    print(f"    Precision: {res['prec']:.4f} ({res['prec']*100:.2f}%)")
    print(f"    Recall:    {res['rec']:.4f} ({res['rec']*100:.2f}%)")
    print(f"    F1-Score:  {res['f1']:.4f} ({res['f1']*100:.2f}%)")
    print(f"    ROC-AUC:   {res['auc']:.4f}")
    print(f"    Confusion: TP={res['tp']}, FP={res['fp']}, TN={res['tn']}, FN={res['fn']}")
    print(f"  At optimal F1 threshold ({res['best_th']:.2f}):")
    print(f"    Accuracy:  {res['b_acc']:.4f} ({res['b_acc']*100:.2f}%)")
    print(f"    Precision: {res['b_prec']:.4f} ({res['b_prec']*100:.2f}%)")
    print(f"    Recall:    {res['b_rec']:.4f} ({res['b_rec']*100:.2f}%)")
    print(f"    F1-Score:  {res['b_f1']:.4f} ({res['b_f1']*100:.2f}%)")
