import os
import subprocess
from datetime import date
import dotenv
from flask import Flask, render_template, send_from_directory

from backend.logger import get_logger
from backend.notifications import reminder
from backend.notifications.pushover import Pushover
from backend.routes.tasks import create_tasks_blueprint
from backend.routes.habits import create_habits_blueprint
from backend.routes.music import create_music_blueprint
from backend.routes.workout import create_workout_blueprint
from obsidian import Vault

FETCH_TASKS_INTERVAL = 30

dotenv.load_dotenv()

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'static'),
)

logger = get_logger(__name__)

_spotify = None
_spotify_error = None

if os.getenv("SPOTIFY_CLIENT_ID"):
    try:
        from backend.music.spotify import SpotifyClient
        _spotify = SpotifyClient()
        logger.info("Spotify client initialized")
    except Exception as e:
        _spotify_error = str(e)
        logger.warning(f"Spotify not available: {e}")

vault = Vault(vault_path=os.getenv("OBSIDIAN_VAULT_PATH"), spotify=_spotify)
pushover = Pushover(api_token=os.getenv("PUSHOVER_API_TOKEN"), user_key=os.getenv("PUSHOVER_USER_KEY"))

tasks_store = {}
reminder.start(vault.tasks, pushover, tasks_store, interval=FETCH_TASKS_INTERVAL)

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(
        os.path.join(os.path.dirname(__file__), 'frontend', 'assets'), filename
    )

_daily_open_date = None

@app.route('/')
def index():
    global _daily_open_date
    today = date.today()
    if _daily_open_date != today:
        subprocess.Popen(['obsidian', 'daily:read'])
        _daily_open_date = today
    return render_template('index.html')

app.register_blueprint(create_tasks_blueprint(vault.tasks, tasks_store, logger))
app.register_blueprint(create_habits_blueprint(vault.habits, logger))
app.register_blueprint(create_music_blueprint(_spotify, vault.music, logger, _spotify_error))
app.register_blueprint(create_workout_blueprint(vault.workout, logger))

def main():
    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
