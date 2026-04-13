# Real-Time E-commerce Analytics System

## Project Overview
This project is an end-to-end analytics platform built on the Olist e-commerce dataset.
It simulates real-time data ingestion using incremental batches, stores processed data in a cloud PostgreSQL database (Supabase), serves analytics through a FastAPI backend, and presents business insights in a modern Next.js dashboard.

The system demonstrates production-style engineering across data, API, frontend, and ML:
- Incremental batch ingestion and tracking
- Cloud database integration with upsert loading
- API-first analytics delivery
- Interactive dashboard for operational insights
- Revenue prediction and anomaly detection

## Architecture
Data flow:

Airflow-style Batch Simulation -> Supabase PostgreSQL -> FastAPI -> Next.js Dashboard -> Machine Learning Insights

### Components
- Ingestion layer: prepares and cleans source data, then creates batch files
- Storage layer: loads clean records into Supabase PostgreSQL
- API layer: exposes metrics, trends, prediction, and anomalies
- UI layer: renders KPIs, charts, prediction card, and anomaly alerts
- ML layer: trains on daily revenue features and detects anomalies

## Features
- Incremental data ingestion pipeline with batch pointer tracking
- Supabase PostgreSQL integration with conflict-safe upserts
- FastAPI analytics endpoints
- Next.js dashboard with responsive KPI cards and trend charts
- Next-day revenue prediction endpoint
- Anomaly detection endpoint using Z-score

## Tech Stack
- Backend: Python, FastAPI
- Database: PostgreSQL (Supabase)
- Frontend: Next.js, TypeScript, Tailwind CSS, Recharts
- Data Processing: Pandas
- ML: XGBoost, NumPy
- DB Driver: psycopg2
- Config: python-dotenv

## How It Works
1. Data preparation
- Source Olist CSVs are joined into a unified clean dataset.
- Data quality steps include type conversion, null handling, deduplication, and sorting.

2. Batch simulation
- Clean data is split into ordered batch files.
- A state file tracks the current batch index.

3. Incremental loading
- Each run processes one batch.
- Rows are upserted into PostgreSQL to prevent duplicate primary-key inserts.

4. API analytics
- FastAPI executes aggregate SQL queries for:
  - total orders
  - total revenue
  - daily revenue
  - daily orders
  - cumulative data growth

5. ML outputs
- Daily revenue series is feature-engineered and used for next-day forecasting.
- Z-score detection flags unusual revenue spikes.

6. Dashboard rendering
- Frontend fetches API endpoints and auto-refreshes periodically.
- Users see KPIs, trend charts, prediction, and anomaly alerts.

## Machine Learning
### Features
- day_of_week
- rolling_mean_7
- lag_1

### Prediction Method
- Model: XGBoost Regressor
- Target: daily_revenue
- Output: predicted_revenue

### Anomaly Detection
- Method: Z-score over daily_revenue
- Rule: abs(z_score) > 2.5
- Output: list of anomalies with date, revenue, z_score

## API Endpoints
- GET /metrics
- GET /daily-revenue
- GET /daily-orders
- GET /data-growth
- GET /prediction
- GET /anomalies

## How to Run
### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- npm
- Supabase/PostgreSQL connection string

### 2. Python environment and dependencies
From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment variables
Create or update .env in the project root:

```env
SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
```

Create frontend/.env.local:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 4. Run data pipeline
Real load (writes to DB):

```powershell
python run_pipeline.py false
```

Dry run (no DB writes):

```powershell
python run_pipeline.py
```

### 5. Run backend
From project root:

```powershell
uvicorn backend.app:app --reload
```

Backend URL:
- http://127.0.0.1:8000

### 6. Run frontend
In a new terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:
- http://localhost:3000

## Future Improvements
- Replace simulated batching with true streaming (Kafka/Kinesis)
- Add model evaluation tracking and versioning
- Improve forecasting with richer temporal features
- Add real-time alerting (email/Slack/webhook)
- Add authentication and role-based access
- Add CI/CD, tests, and containerized deployment

## License
For portfolio/demo use. Add a formal license if publishing publicly.
