import subprocess
import time
import os
import sys
from datetime import datetime
import dotenv

dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

POLL_INTERVAL = 60  # seconds between git checks
BRANCH = "main"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable


def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def get_local_commit():
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=PROJECT_DIR, capture_output=True, text=True
    )
    return result.stdout.strip()


def fetch_remote_commit():
    subprocess.run(
        ["git", "fetch", "origin", BRANCH],
        cwd=PROJECT_DIR, capture_output=True
    )
    result = subprocess.run(
        ["git", "rev-parse", f"origin/{BRANCH}"],
        cwd=PROJECT_DIR, capture_output=True, text=True
    )
    return result.stdout.strip()


def pull():
    subprocess.run(["git", "pull", "origin", BRANCH], cwd=PROJECT_DIR)


def start_server():
    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "5000")
    process = subprocess.Popen(
        [PYTHON, "-m", "waitress", f"--host={host}", f"--port={port}", "main:app"],
        cwd=PROJECT_DIR
    )
    log(f"Server started via Waitress on {host}:{port} (PID {process.pid})")
    return process


def main():
    log("Runner started, launching server...")
    process = start_server()

    while True:
        time.sleep(POLL_INTERVAL)

        try:
            local = get_local_commit()
            remote = fetch_remote_commit()

            if not local or not remote:
                log("Could not read git commits, skipping check.")
                continue

            if local != remote:
                log(f"New version detected ({local[:7]} -> {remote[:7]}), restarting...")
                process.terminate()
                process.wait(timeout=10)
                pull()
                process = start_server()
            else:
                log("No updates.")
        except Exception as e:
            log(f"Error during update check: {e}")


if __name__ == "__main__":
    main()
