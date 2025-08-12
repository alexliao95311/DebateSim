import json
import os
from typing import Any, Dict


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)


def _init_store(path: str) -> Dict[str, Any]:
    """Ensure the JSON file exists and has a top-level structure."""
    _ensure_parent_dir(path)
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        with open(path, 'w') as f:
            json.dump({'debates': []}, f, indent=2)
        return {'debates': []}
    try:
        with open(path, 'r') as f:
            data = json.load(f)
            if not isinstance(data, dict) or 'debates' not in data:
                data = {'debates': []}
    except Exception:
        data = {'debates': []}
    return data


def write_raw_metrics(path: str, debate_blob: Dict[str, Any]) -> None:
    """Append a single debate's organized data to the JSON store."""
    store = _init_store(path)
    store['debates'].append(debate_blob)
    with open(path, 'w') as f:
        json.dump(store, f, indent=2)