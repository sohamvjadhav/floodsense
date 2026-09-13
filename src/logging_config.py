"""
Structured logging for FloodSense.

Provides consistent, machine-readable log output for debugging,
monitoring, and audit trails.

Usage:
    from src.logging_config import get_logger
    logger = get_logger("inference")
    logger.info("prediction_complete", station="MH_PUN", tier=2, p24=0.75)
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class StructuredFormatter(logging.Formatter):
    """JSON-structured log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Add extra fields
        for key in ["station_id", "district", "tier", "p24", "model_status",
                     "data_confidence", "duration_ms", "endpoint", "status_code"]:
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Get a structured logger for the given module."""
    logger = logging.getLogger(f"floodsense.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger
