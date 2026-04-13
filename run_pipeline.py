from __future__ import annotations

import sys

from config import DB_URL
from pipeline.batch_creator import create_batches
from pipeline.loader import load_batch
from pipeline.prepare_data import prepare_orders_dataset
from pipeline.tracker import get_current_batch, update_current_batch
from pipeline.validation import (
    validate_batches,
    validate_database_insert,
    validate_orders_clean,
)


def run_local_pipeline(dry_run: bool = True, batch_size: int = 1000, batch_mode: str = "row") -> None:
    """Run full pipeline locally without Airflow."""
    try:
        print("Preparing data...")
        prepare_orders_dataset()
        validate_orders_clean()

        print("Creating batches...")
        create_batches(batch_size=batch_size, mode=batch_mode)
        validate_batches(expected_batch_size=batch_size)

        current_batch = get_current_batch()
        print(f"Loading batch {current_batch}...")

        inserted_rows = load_batch(batch_idx=current_batch, dry_run=dry_run)

        if dry_run:
            print(
                f"Dry run enabled. Batch {current_batch} was not inserted into database. "
                f"Rows inspected: {inserted_rows}"
            )
            print("Batch loaded successfully")
            return

        update_current_batch(current_batch + 1)
        print("Batch loaded successfully")

        # Validate persisted data only after real insertion.
        if DB_URL:
            validate_database_insert(DB_URL)
        else:
            print("Skipping database validation because DB URL is not set.")

    except FileNotFoundError as exc:
        print(f"File not found error: {exc}")
        raise
    except ConnectionError as exc:
        print(f"Database connection error: {exc}")
        raise
    except ValueError as exc:
        print(f"Validation or data error: {exc}")
        raise
    except Exception as exc:
        print(f"Unexpected pipeline error: {exc}")
        raise


if __name__ == "__main__":
    # Default per requirement: dry run mode enabled.
    DRY_RUN = True

    if len(sys.argv) > 1:
        arg = sys.argv[1].strip().lower()
        if arg in {"false", "0", "no", "off"}:
            DRY_RUN = False
        elif arg in {"true", "1", "yes", "on"}:
            DRY_RUN = True

    run_local_pipeline(dry_run=DRY_RUN)