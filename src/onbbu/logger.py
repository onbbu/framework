from concurrent.futures import ThreadPoolExecutor
from enum import Enum
import json
import logging
from logging.handlers import RotatingFileHandler
from typing import Any, Dict, Union
from os import getenv

from prometheus_client import Counter
from rich.console import Console
from rich.text import Text
from rich.traceback import install

install()


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


LOG_COUNTER: Counter = Counter("app_log_total", "Total logs generated", ["level"])


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Union[str, Dict[str, Any]]] = {
            "timestamp": self.formatTime(record, "%Y-%m-%d %H:%M:%S"),
            "level": record.levelname,
            "message": record.getMessage(),
            "extra": getattr(record, "extra_data", {}),
        }
        return json.dumps(log_entry, ensure_ascii=False)


class Logger:
    console: Console
    executor: ThreadPoolExecutor
    logger: logging.Logger

    def __init__(self, log_file: str) -> None:
        self.executor = ThreadPoolExecutor(max_workers=5)
        self.logger = logging.getLogger("app_logger")
        self.logger.setLevel(logging.DEBUG)
        self.console = Console()

        log_format = JsonFormatter()
        file_handler = RotatingFileHandler(log_file, maxBytes=5000000, backupCount=3)
        file_handler.setFormatter(log_format)
        self.logger.addHandler(file_handler)

    def log(self, level: LogLevel, message: str, extra_data: Dict[str, str]) -> None:
        """Logs a message and prints it to the terminal, updating the log metric."""

        # Increment the counter metric for the corresponding level
        LOG_COUNTER.labels(level=level.value).inc()

        log_function = {
            LogLevel.DEBUG: self.logger.debug,
            LogLevel.INFO: self.logger.info,
            LogLevel.WARNING: self.logger.warning,
            LogLevel.ERROR: self.logger.error,
            LogLevel.CRITICAL: self.logger.critical,
        }.get(level, self.logger.info)

        self.pretty_print(level, message, extra_data)
        log_function(message, extra={"extra_data": extra_data})

    def pretty_print(
        self, level: LogLevel, message: str, extra_data: Dict[str, str]
    ) -> None:
        """Prints logs in the terminal with colors and formatting using Rich."""
        level_colors = {
            LogLevel.DEBUG: "cyan",
            LogLevel.INFO: "green",
            LogLevel.WARNING: "yellow",
            LogLevel.ERROR: "red",
            LogLevel.CRITICAL: "bold red",
        }

        color: str = level_colors.get(level, "white")

        text: Text = Text(f"[{level.value}] ", style=color)

        text.append(message, style="bold white")

        if extra_data:
            extra_json = json.dumps(extra_data, indent=2, ensure_ascii=False)
            text.append(f"\n{extra_json}", style="dim")

        self.console.print(text)


logger: Logger = Logger(log_file=getenv("LOGGER_FILE", "onbbu.log"))
