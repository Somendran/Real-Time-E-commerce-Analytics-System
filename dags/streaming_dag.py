from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import sys

from airflow import DAG
from airflow.operators.python import PythonOperator

# Ensure project root is importable from Airflow's dags folder.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from pipeline.loader import run_pipeline  # noqa: E402


default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="simulate_streaming_pipeline",
    default_args=default_args,
    description="Daily simulated streaming load for Olist orders",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["olist", "streaming", "batch"],
) as dag:
    run_streaming_batch = PythonOperator(
        task_id="run_streaming_batch",
        python_callable=run_pipeline,
    )
