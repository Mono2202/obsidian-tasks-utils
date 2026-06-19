import time
import threading
from backend.logger import get_logger

logger = get_logger(__name__)

_lock = threading.Lock()
_end_time = None  # float Unix timestamp or None


def set_timer(end_time_unix: float):
    global _end_time
    with _lock:
        _end_time = float(end_time_unix)


def cancel_timer():
    global _end_time
    with _lock:
        _end_time = None


def _worker(pushover):
    while True:
        time.sleep(5)
        should_fire = False
        with _lock:
            global _end_time
            if _end_time is not None and time.time() >= _end_time:
                _end_time = None
                should_fire = True
        if should_fire:
            try:
                pushover.send_message(
                    message="Rest time is up — time for your next set! 💪",
                    title="Workout Timer"
                )
                logger.info("Rest timer notification sent")
            except Exception as e:
                logger.error(f"Failed to send rest timer notification: {e}")


def start(pushover):
    t = threading.Thread(target=_worker, args=(pushover,), daemon=True)
    t.start()
