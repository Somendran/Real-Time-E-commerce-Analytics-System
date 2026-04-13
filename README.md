# Real-Time E-commerce Analytics System

End-to-end data engineering, BI, and ML analytics system built on the Olist Brazilian e-commerce dataset.

The project simulates real-time ingestion with incremental batches, stores cleaned data in Supabase PostgreSQL, serves analytics through FastAPI, and presents operational BI insights in a Next.js dashboard.

Dataset source: [Brazilian E-Commerce Public Dataset by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)

## What This Project Does

- Ingests and cleans raw Olist CSV files
- Splits clean data into incremental batch files
- Loads one batch per run into PostgreSQL with conflict-safe upserts
- Serves KPI, trend, BI, ML, anomaly, and geo-analysis endpoints through FastAPI
- Displays KPIs, charts, filters, recommendations, anomaly alerts, and model metrics in a Next.js dashboard
- Persists an XGBoost revenue prediction model to disk instead of retraining on every request
- Includes pytest coverage and GitHub Actions CI

## Screenshots

### Dashboard Overview

![Dashboard overview](docs/screenshots/dashboard-overview.png)

Dashboard overview with KPI cards, revenue prediction, and interactive filters.

### Business Intelligence

![Business intelligence section](docs/screenshots/bi-section.png)

BI layer showing category performance, customer segmentation, weekday behavior, and state-level revenue.

### Insights and Recommendations

![Insights and recommendations](docs/screenshots/insights-recommendations.png)

Decision-support layer with automated business insights and recommendations.

### Model Metrics

![Model metrics](docs/screenshots/model-metrics.png)

Persisted ML model metrics showing forecast evaluation and last training time.

### GitHub Actions CI

![GitHub Actions CI](docs/screenshots/github-actions-ci.png)

Automated CI running backend tests and frontend build checks.

## Architecture

```mermaid
flowchart LR
    raw["Olist CSV files<br/>data/raw"] --> prep["Pandas data preparation<br/>pipeline/prepare_data.py"]
    prep --> clean["Clean dataset<br/>data/orders_clean.csv"]
    clean --> batches["Incremental batches<br/>data_batches/batch_*.csv"]
    batches --> loader["Batch loader + validation<br/>run_pipeline.py"]
    loader --> db[("PostgreSQL / Supabase<br/>orders_clean")]
    loader --> train["Model training<br/>train_and_save_model()"]
    train --> artifact["Saved model + metrics<br/>backend/models"]
    db --> api["FastAPI backend<br/>analytics + BI + ML endpoints"]
    artifact --> api
    api --> ui["Next.js dashboard<br/>KPIs, charts, filters, insights"]
    api --> docs["FastAPI docs<br/>/docs"]
    db -. "optional local dev" .-> docker["Docker Compose<br/>Postgres + backend + frontend"]
```

The same application can run against Supabase or against the local PostgreSQL service defined in Docker Compose.

## Project Structure

```text
backend/
  app.py
  db.py
  ml.py
  models/
  routes/
frontend/
  app/
  components/
  lib/
pipeline/
  prepare_data.py
  batch_creator.py
  loader.py
  tracker.py
  validation.py
dags/
  streaming_dag.py
data/
  raw/
infra/
  sql/001_create_orders_clean.sql
tests/
.github/workflows/ci.yml
run_pipeline.py
```

## Data

The full raw Olist dataset is not committed because the files are large.

Download the dataset from Kaggle:

```text
https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
```

Place these files in `data/raw/`:

```text
olist_orders_dataset.csv
olist_order_items_dataset.csv
olist_order_payments_dataset.csv
olist_order_reviews_dataset.csv
olist_products_dataset.csv
olist_customers_dataset.csv
product_category_name_translation.csv
```

The pipeline reads from `data/raw/` first and only falls back to project-root CSVs for legacy local setups.

## Features

### Data Pipeline

- Raw CSV loading
- Data cleaning and type conversion
- Null handling
- Deduplication
- Ordered batch creation
- Batch pointer tracking with `current_batch.txt`
- PostgreSQL upsert loading
- Validation checks for clean data, batches, and database inserts

### Analytics API

FastAPI serves:

- total orders
- total revenue
- daily revenue
- daily orders
- cumulative data growth
- category revenue analysis
- customer segmentation
- weekday revenue analysis
- geographic revenue analysis by state
- rule-based insights
- business recommendations
- anomaly detection
- next-day revenue prediction
- model evaluation metrics

### BI Dashboard

The Next.js dashboard includes:

- KPI cards
- daily revenue chart
- daily orders chart
- cumulative data growth chart
- category analysis chart
- customer segmentation pie chart
- weekday revenue chart
- geographic revenue chart
- model metrics section
- anomaly alerts
- key insights
- recommendations
- filters for date range, product category, customer state, and revenue range

### Machine Learning

The ML layer predicts next-day revenue using daily revenue features:

- `day_of_week`
- `rolling_mean_7`
- `lag_1`

Model lifecycle:

```text
train_and_save_model()
  -> trains XGBoost model
  -> evaluates MAE, RMSE, MAPE
  -> saves backend/models/model.pkl
  -> saves backend/models/metrics.json
```

`/prediction` loads the saved model from disk. It does not retrain on every request.

Model artifacts are local runtime files and are ignored by git:

```text
backend/models/model.pkl
backend/models/metrics.json
```

## API Endpoints

Core analytics:

```text
GET /metrics
GET /daily-revenue
GET /daily-orders
GET /data-growth
```

BI endpoints:

```text
GET /category-analysis
GET /customer-segmentation
GET /weekday-analysis
GET /geo-analysis
GET /insights
GET /recommendations
GET /filter-options
```

ML endpoints:

```text
GET  /prediction
GET  /anomalies
GET  /model-metrics
POST /train-model
```

Filterable endpoints support:

```text
?start_date=YYYY-MM-DD
&end_date=YYYY-MM-DD
&category=category_name
&state=SP
&min_revenue=0
&max_revenue=500
```

Example:

```text
GET /metrics?state=SP&category=furniture_decor
```

## Database Schema

The schema is stored in:

```text
infra/sql/001_create_orders_clean.sql
```

The pipeline uses this SQL file when creating the `orders_clean` table.

## How to Run

### Option A: Docker Compose

Start local Postgres, FastAPI, and Next.js:

```powershell
docker compose up --build
```

URLs:

```text
Frontend: http://localhost:3000
Backend:  http://127.0.0.1:8000
API docs: http://127.0.0.1:8000/docs
```

The Compose setup uses local PostgreSQL:

```text
postgresql://postgres:postgres@db:5432/ecommerce
```

To load data into the Docker Postgres database after the services are running:

```powershell
docker compose exec backend python run_pipeline.py false
```

Raw CSVs must exist locally in `data/raw/`. They are mounted into the backend container but are not baked into the Docker image.

### Option B: Local Python and Node

### 1. Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Supabase or PostgreSQL connection string
- Olist CSV files in `data/raw/`

### 2. Python Environment

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 3. Environment Variables

Create or update `.env` in the project root:

```env
SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
```

Create or update `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 4. Run the Pipeline

Dry run, no database writes:

```powershell
.\.venv\Scripts\python.exe run_pipeline.py
```

Real load, writes the next batch to PostgreSQL and trains the saved ML model:

```powershell
.\.venv\Scripts\python.exe run_pipeline.py false
```

Manual model training:

```powershell
.\.venv\Scripts\python.exe -c "from backend.ml import train_and_save_model; print(train_and_save_model())"
```

### 5. Run the Backend

Use the venv Python module form so PowerShell does not accidentally pick a global `uvicorn` install:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

### 6. Run the Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Testing

Run Python tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Current test coverage includes:

- batch creation
- batch pointer tracking
- ML feature engineering
- persisted prediction behavior
- `/metrics`
- `/prediction`
- `/model-metrics`

Run frontend production build:

```powershell
cd frontend
npm run build
```

## CI

GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

The workflow:

- checks out the repo
- sets up Python
- installs `requirements.txt`
- runs `pytest`
- sets up Node.js
- installs frontend dependencies
- builds the Next.js frontend

## Business Questions Answered

- How much revenue has the platform processed?
- Which product categories generate the most revenue?
- Which customer segments contribute the most volume?
- Which weekdays perform best?
- Which customer states generate the most revenue?
- Is revenue trending up or down?
- Are there unusual revenue spikes?
- What actions should the business take next?
- What is the next-day revenue forecast?
- How accurate is the current model?

## Known Limitations

- Streaming is simulated through batch files, not Kafka or Kinesis.
- The saved ML model is local to the backend runtime and is not versioned.
- No authentication or role-based access is implemented yet.
- Database migrations use a SQL file, not Alembic.
- CI does not spin up a real PostgreSQL/Supabase database yet.
- Full local reproduction requires downloading the Olist CSV files from Kaggle.

## Future Improvements

- Add model versioning and model registry metadata
- Add Alembic migrations
- Add authentication and role-based access
- Replace simulated batching with Kafka, Redpanda, Kinesis, or Pub/Sub
- Add alert delivery through email, Slack, or webhooks

## License

For portfolio and demo use. Add a formal license before publishing or distributing.
