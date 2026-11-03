"""
Rainfall Analysis & Rain Prediction — ML training pipeline.

This is the reference Python pipeline that produced the model concept used by
the live system. In production you would:
  1. Load a real historical climate CSV (see datasets/rainfall_sample.csv).
  2. Engineer features, train a Random Forest / XGBoost model.
  3. Serialize the model to .joblib / .pkl.
  4. Serve it from a Python API (FastAPI/Flask) — OR mirror its logic as a
     lightweight in-process model (see src/ml/rainforest.ts) for serverless use.

Run:  python python/train_rain_model.py
"""

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, mean_absolute_error
from sklearn.model_selection import train_test_split

FEATURES = [
    "humidity",
    "temperature_c",
    "pressure_hpa",
    "wind_speed_kmh",
    "cloud_cover_pct",
]

TARGET_CLASS = "rain"          # 1 if it rained that day
TARGET_REG = "rainfall_mm"     # measured rainfall in mm


def load_dataset(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    # Basic cleaning — drop rows missing core features.
    df = df.dropna(subset=FEATURES + [TARGET_CLASS, TARGET_REG]).copy()
    df[TARGET_CLASS] = df[TARGET_CLASS].astype(int)
    df[FEATURES] = df[FEATURES].apply(pd.to_numeric, errors="coerce")
    return df.dropna(subset=FEATURES)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Feature engineering: rolling means + interaction terms."""
    df = df.sort_values("reading_date")
    # 3-day rolling humidity / pressure capture the recent trend.
    df["humidity_3d"] = df["humidity"].rolling(3, min_periods=1).mean()
    df["pressure_3d"] = df["pressure_hpa"].rolling(3, min_periods=1).mean()
    # Interaction: high humidity + high cloud = stronger rain signal.
    df["humidity_x_cloud"] = df["humidity"] * df["cloud_cover_pct"] / 100
    return df


def train(df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    X = df[FEATURES].values
    y_class = df[TARGET_CLASS].values
    y_reg = df[TARGET_REG].values

    X_train, X_test, y_c_train, y_c_test, y_r_train, y_r_test = train_test_split(
        X, y_class, y_reg, test_size=0.2, random_state=42, stratify=y_class
    )

    # Classifier: probability of rain.
    clf = RandomForestClassifier(
        n_estimators=200, max_depth=8, random_state=42, n_jobs=-1
    )
    clf.fit(X_train, y_c_train)
    print("Classification report (rain / no rain):")
    print(classification_report(y_c_test, clf.predict(X_test)))

    # Regressor: expected rainfall in mm (only trained on rainy rows).
    rainy_mask = y_r_train > 0
    reg = RandomForestRegressor(
        n_estimators=200, max_depth=8, random_state=42, n_jobs=-1
    )
    reg.fit(X_train[rainy_mask], y_r_train[rainy_mask])
    pred_mm = reg.predict(X_test)
    print(f"Rainfall MAE: {mean_absolute_error(y_r_test, pred_mm):.2f} mm")

    # Persistence.
    joblib.dump(clf, out_dir / "rain_classifier.joblib")
    joblib.dump(reg, out_dir / "rain_regressor.joblib")
    joblib.dump(FEATURES, out_dir / "model_features.joblib")
    print(f"Saved model artifacts to {out_dir}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--csv",
        default="datasets/rainfall_sample.csv",
        help="Path to the historical climate CSV",
    )
    ap.add_argument(
        "--out",
        default="models",
        help="Directory to write .joblib artifacts",
    )
    args = ap.parse_args()

    df = engineer_features(load_dataset(Path(args.csv)))
    print(f"Loaded {len(df)} rows from {args.csv}")
    train(df, Path(args.out))


if __name__ == "__main__":
    main()