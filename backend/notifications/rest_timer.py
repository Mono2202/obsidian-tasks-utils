import threading
from backend.logger import get_logger

logger = get_logger(__name__)

_lock = threading.Lock()
_timer = None


def start(duration, pushover):
    """(Re)schedule the rest-timer push notification, replacing any pending one."""
    global _timer
    with _lock:
        if _timer:
            _timer.cancel()

        def _fire():
            try:
                pushover.send_message(
                    message="Rest time is up — time for your next set! 💪",
                    title="Workout Timer"
                )
            except Exception as e:
                logger.error(f"Failed to send rest timer notification: {e}")

        _timer = threading.Timer(duration, _fire)
        _timer.daemon = True
        _timer.start()


def cancel():
    global _timer
    with _lock:
        if _timer:
            _timer.cancel()
            _timer = None
