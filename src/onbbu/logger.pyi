import logging
from enum import Enum
from prometheus_client import Counter
from rich.console import Console

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

LOG_COUNTER: Counter

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str: ...

class Logger:
    console: Console
    logger: logging.Logger
    def __init__(self) -> None: ...
    def log(
        self, level: LogLevel, message: str, extra_data: dict[str, str]
    ) -> None: ...
    def pretty_print(
        self, level: LogLevel, message: str, extra_data: dict[str, str]
    ) -> None: ...

logger: Logger
