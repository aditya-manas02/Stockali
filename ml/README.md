# Stockali — ML Track

Goal for Phase 0: get from "no data" to a working baseline forecasting model
this week, so model work is progressing in parallel with the app build —
not blocked behind it.

## Step 1 — Get a dataset

### Option A: Rossmann Store Sales (recommended first — clean, fast to work with)
1. Go to https://www.kaggle.com/competitions/rossmann-store-sales/data
2. Download `train.csv`, `store.csv`, `test.csv`
3. Place them in `ml/data/rossmann/`

### Option B: Favorita Grocery Sales Forecasting (closer to real kirana/grocery demand)
1. Go to https://www.kaggle.com/competitions/favorita-grocery-sales-forecasting/data
2. Download `train.csv.7z`, `stores.csv`, `items.csv`, `oil.csv`, `holidays_events.csv`
3. Place them in `ml/data/favorita/`
4. Note: `train.csv` is large (~125M rows) — for early iteration, filter to a
   subset of stores/items first rather than loading everything.

Both require a free Kaggle account. Use the Kaggle CLI (`pip install kaggle`)
to script the download once your API token is set up — ask Antigravity to
write that script for you.

## Step 2 — Baseline EDA and model

Suggested first notebook: `notebooks/01_eda.ipynb`
- Load the data, check for missing values, seasonality, promotions effect
- Plot demand over time for a few sample store/item pairs
- Establish a naive baseline (e.g., last-week-same-day, or moving average) —
  you need this number to know if your real model is actually better

Suggested second notebook: `notebooks/02_baseline_forecast.ipynb`
- Train a simple model first (e.g., XGBoost or LightGBM regressor on lag +
  rolling-window features) before anything fancier
- Evaluate with a time-based train/test split (never random split for
  time series — this is a common mistake, causes leakage)
- Track metrics (MAE, RMSE, MAPE) — log them somewhere so later comparisons
  (e.g., baseline vs. demand-signal-augmented model) are apples-to-apples

## Step 3 — Where this connects to the app later

Once `customer_events` (see `database/schema.sql`) has real rows from the
running app — searches, out-of-stock hits, restock-subscribe events — the
plan is to:
1. Aggregate these into features (e.g., daily out-of-stock search count per product)
2. Join them onto the same store/item/date grain as the sales-history features
3. Retrain the same model architecture with the added features
4. Compare against the Step 2 baseline using the same metrics

That comparison *is* the project's central research question — keep the
Step 2 baseline results well-documented so this comparison is credible later.

## Suggested folder layout as this grows

```
ml/
├── data/                # raw downloaded datasets (gitignored — don't commit)
├── notebooks/           # exploration and experiments
├── src/                 # promoted, reusable code (feature engineering, training scripts)
└── models/               # saved model artifacts (also gitignore large files)
```
