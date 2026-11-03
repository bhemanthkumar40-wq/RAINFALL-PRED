# Rainfall Analysis & Rain Prediction System

A production-ready rain-prediction dashboard for farmers & growers. It turns
live climate readings (humidity, temperature, pressure, wind, cloud cover)
into plain-language rain odds for planting, irrigation, and harvest planning.

## What's here

```
.
├─ src/                          # React + Vite + TypeScript frontend
│  ├─ App.tsx                    # Dashboard shell, geolocation, fetch orchestration
│  ├─ components/
│  │  ├─ PredictionForm.tsx       # Slider inputs + forecast button + advice
│  │  ├─ WeatherCards.tsx         # Climate-feature cards + rain-odds summary
│  │  ├─ Charts.tsx               # Trend line, feature-importance bar, rain doughnut
│  │  ├─ ModelPanel.tsx           # Held-out model metrics (accuracy/precision/recall/F1)
│  │  └─ HistoryPanel.tsx         # Recent forecasts table
│  ├─ hooks/useTheme.ts          # Light/dark theme toggle (persisted)
│  ├─ lib/
│  │  ├─ api.ts                   # Typed client for the edge function
│  │  └─ charts.ts                # Chart.js registration + shared colors
│  └─ ml/rainforest.ts           # In-process random-forest ensemble (model)
├─ supabase/
│  ├─ config.toml
│  └─ functions/rain-predict/
│     ├─ index.ts                 # Backend: /predict, /analyze, /historical
│     └─ rainforest.ts            # Model code (mirror of src/ml/rainforest.ts)
├─ python/train_rain_model.py     # Reference Python training pipeline (sklearn)
├─ datasets/rainfall_sample.csv   # Sample historical climate dataset (CSV headers + rows)
└─ README.md
```

## Architecture

- **Frontend**: React + Vite + Tailwind. Glassmorphism dashboard, dark/light
  theme, geolocation, slider inputs, and Chart.js visualizations.
- **Backend**: Supabase Edge Function (`rain-predict`) exposing three REST
  endpoints. CORS-enabled, error-wrapped, persists every prediction.
- **ML model**: A random-forest-style ensemble of CART decision trees
  (bagging + random feature subsets), implemented in TypeScript so it runs
  both in the browser and in the edge function with no Python runtime.
  Trained from the `climate_readings` table on each cold start (cached 5 min).
- **Reference pipeline**: `python/train_rain_model.py` shows the production
  version — pandas preprocessing, feature engineering, sklearn
  `RandomForestClassifier`/`Regressor`, and `.joblib` persistence.
- **Data**: Supabase `climate_readings` (training set, 200 seeded rows) and
  `rainfall_predictions` (every forecast logged). RLS-enabled, single-tenant.

## REST API

All routes are under `/functions/v1/rain-predict`.

| Method | Route        | Purpose                                                    |
|--------|--------------|------------------------------------------------------------|
| POST   | `/predict`   | Forecast rain probability, intensity (mm), and farmer advice|
| POST   | `/analyze`   | Held-out evaluation: accuracy, precision, recall, F1, MAE |
| GET    | `/historical`| Latest climate readings + recent forecasts                 |

### Example: `/predict`

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rain-predict/predict" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"features":{"humidity":90,"temperature_c":12,"pressure_hpa":1001,
       "wind_speed_kmh":22,"cloud_cover_pct":95},"location_label":"North orchard"}'
```

```json
{
  "rain_probability": 0.97,
  "predicted_intensity_mm": 44.2,
  "advice": "Heavy rain likely. Delay irrigation, postpone spraying...",
  "advice_level": "very high"
}
```

## ML pipeline

**Feature engineering** (`python/train_rain_model.py`):
- 3-day rolling means of humidity and pressure.
- Interaction term `humidity × cloud_cover / 100`.
- Train/test split 80/20, stratified on the rain target.

**Training** (Random Forest, 200 trees, max depth 8):
- Classifier → probability of rain.
- Regressor (trained on rainy rows only) → expected rainfall in mm.

**Persistence**:
```bash
python python/train_rain_model.py --csv datasets/rainfall_sample.csv --out models/
# writes: rain_classifier.joblib, rain_regressor.joblib, model_features.joblib
```

The deployed edge function uses the TypeScript port of this model so it
doesn't need a Python sidecar — the same algorithm runs serverless.

## Sample dataset

`datasets/rainfall_sample.csv`:

```
reading_date,location,humidity,temperature_c,pressure_hpa,wind_speed_kmh,cloud_cover_pct,rain,rainfall_mm
2025-01-01,North Fields,68.4,15.2,1018.7,12.0,55.0,0,0
2025-01-02,North Fields,81.2,13.8,1006.1,18.0,88.0,1,12.4
...
```

## Running

The dev server starts automatically. The frontend talks to the deployed edge
function; no local backend needed. To retrain the model with new data, insert
rows into `climate_readings` — the edge function retrains within 5 minutes.
```


## Sign-in / account setup

The dashboard now starts with a Supabase Authentication screen. Users can create an account with an email and password, confirm their email if confirmation is enabled, sign in, and sign out.

1. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local `.env` file.
2. In the Supabase dashboard for this project, open **Authentication → Providers → Email** and make sure Email is enabled.
3. For local testing, configure the Supabase Auth site URL / redirect URLs for your local Vite URL (usually `http://localhost:5173`).
4. Run `npm install` and `npm.cmd run dev`.

**Security note:** this change gates the frontend dashboard with Supabase sign-in. The existing SQL migration currently allows public access to rainfall tables and the Edge Function has `verify_jwt = false`; before deploying this as a genuinely private multi-user service, tighten the table RLS policies and validate authenticated users in the backend as well. Never put a Supabase service-role key in the frontend.
