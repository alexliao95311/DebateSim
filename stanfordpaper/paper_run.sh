#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
RAW_JSON="$DATA_DIR/raw_metrics.json"
LOG_DIR="$SCRIPT_DIR/run_logs"

mkdir -p "$DATA_DIR" "$LOG_DIR"

# Initialize empty JSON store if missing or empty
if [[ ! -s "$RAW_JSON" ]]; then
  echo '{"debates": []}' > "$RAW_JSON"
fi

# Run performance monitor
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/monitor_$TS.log"

echo "Running performance monitor... logs: $LOG_FILE"
python3 "$SCRIPT_DIR/performance_monitor.py" | tee "$LOG_FILE"

echo "Raw metrics written to: $RAW_JSON"