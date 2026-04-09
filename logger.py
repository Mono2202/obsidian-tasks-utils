import logging
import os
from datetime import datetime

_logs_dir = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(_logs_dir, exist_ok=True)
_log_filename = datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(_logs_dir, _log_filename), encoding="utf-8"),
        logging.StreamHandler()
    ]
)

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
