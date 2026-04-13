from __future__ import annotations

from pathlib import Path

from config import PIPELINE_STATE_FILE


def get_current_batch(state_file: Path = PIPELINE_STATE_FILE) -> int:
    """Read current batch index from disk; defaults to 0 if file is missing."""
    if not state_file.exists():
        state_file.write_text("0\n", encoding="utf-8")
        return 0

    raw_value = state_file.read_text(encoding="utf-8").strip()
    if raw_value == "":
        return 0

    try:
        return int(raw_value)
    except ValueError as exc:
        raise ValueError(f"Invalid batch pointer in {state_file}: '{raw_value}'") from exc


def update_current_batch(next_batch: int, state_file: Path = PIPELINE_STATE_FILE) -> None:
    """Persist next batch index after successful load."""
    if next_batch < 0:
        raise ValueError("next_batch must be >= 0")

    state_file.write_text(f"{next_batch}\n", encoding="utf-8")
