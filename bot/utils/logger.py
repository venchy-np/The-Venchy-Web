"""
Venchy Bot — Logger Module
Structured logging — Windows-safe (no emoji in console output).
"""

import logging
import sys
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for terminal output."""

    COLORS = {
        "DEBUG":    "\033[36m",
        "INFO":     "\033[32m",
        "WARNING":  "\033[33m",
        "ERROR":    "\033[31m",
        "CRITICAL": "\033[1;31m",
    }
    RESET = "\033[0m"
    BOLD = "\033[1m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        formatted = (
            f"[{timestamp}] "
            f"{color}[{record.levelname:^8}]{self.RESET} "
            f"{self.BOLD}[{record.name}]{self.RESET} "
            f"{record.getMessage()}"
        )

        if record.exc_info and record.exc_info[0]:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ColoredFormatter())
        logger.addHandler(handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    return setup_logger(f"venchy.{name}")
