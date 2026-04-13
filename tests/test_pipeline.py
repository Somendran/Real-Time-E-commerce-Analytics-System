from pathlib import Path

import pandas as pd

from pipeline.batch_creator import create_batches
from pipeline.tracker import get_current_batch, update_current_batch


def test_create_batches_row_mode(tmp_path: Path) -> None:
    source_path = tmp_path / "orders_clean.csv"
    batch_dir = tmp_path / "batches"
    df = pd.DataFrame(
        {
            "order_id": ["o1", "o2", "o3"],
            "product_id": ["p1", "p2", "p3"],
            "order_date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "payment_value": [10.0, 20.0, 30.0],
        }
    )
    df.to_csv(source_path, index=False)

    batch_count = create_batches(source_path=source_path, batch_dir=batch_dir, batch_size=2)

    assert batch_count == 2
    assert (batch_dir / "batch_0.csv").exists()
    assert (batch_dir / "batch_1.csv").exists()
    assert len(pd.read_csv(batch_dir / "batch_0.csv")) == 2
    assert len(pd.read_csv(batch_dir / "batch_1.csv")) == 1


def test_tracker_reads_and_updates_temp_state(tmp_path: Path) -> None:
    state_file = tmp_path / "current_batch.txt"

    assert get_current_batch(state_file) == 0

    update_current_batch(7, state_file)

    assert get_current_batch(state_file) == 7
