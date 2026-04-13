from __future__ import annotations

from pathlib import Path

import pandas as pd

from config import BATCH_DIR, ORDERS_CLEAN_PATH


def _clear_existing_batches(batch_dir: Path) -> None:
    for file in batch_dir.glob("batch_*.csv"):
        file.unlink()


def create_batches(
    source_path: Path = ORDERS_CLEAN_PATH,
    batch_dir: Path = BATCH_DIR,
    batch_size: int = 1000,
    mode: str = "row",
) -> int:
    """
    Split orders_clean.csv into batch files.

    mode='row'   -> fixed-size row batches
    mode='daily' -> one batch file per order_date day
    """
    if not source_path.exists():
        raise FileNotFoundError(f"Clean dataset not found: {source_path}")

    df = pd.read_csv(source_path)
    if df.empty:
        raise ValueError("Clean dataset is empty; cannot create batches.")

    if "order_date" not in df.columns:
        raise ValueError("Expected 'order_date' column in clean dataset.")

    df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
    df = df.dropna(subset=["order_date"]).sort_values("order_date").reset_index(drop=True)

    batch_dir.mkdir(parents=True, exist_ok=True)
    _clear_existing_batches(batch_dir)

    batch_count = 0

    if mode == "row":
        for idx, start in enumerate(range(0, len(df), batch_size)):
            batch = df.iloc[start : start + batch_size]
            batch.to_csv(batch_dir / f"batch_{idx}.csv", index=False)
            batch_count += 1
    elif mode == "daily":
        grouped = df.groupby(df["order_date"].dt.date, sort=True)
        for idx, (_, batch) in enumerate(grouped):
            batch.to_csv(batch_dir / f"batch_{idx}.csv", index=False)
            batch_count += 1
    else:
        raise ValueError("mode must be either 'row' or 'daily'.")

    return batch_count


if __name__ == "__main__":
    total = create_batches(mode="row")
    print(f"Created {total} batch files in {BATCH_DIR}")
