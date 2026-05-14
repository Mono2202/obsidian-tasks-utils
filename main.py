import os
import subprocess
from datetime import date
import dotenv
from flask import Flask, render_template, send_from_directory

from backend.logger import get_logger
from backend.tasks.obsidian import Obsidian
from backend.tasks import reminder
from backend.notifications.pushover import Pushover
from backend.routes.tasks import create_tasks_blueprint
from backend.routes.habits import create_habits_blueprint
from backend.routes.music import create_music_blueprint

FETCH_TASKS_INTERVAL = 30

dotenv.load_dotenv()

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'static'),
)

logger = get_logger(__name__)

obsidian = Obsidian(vault_path=os.getenv("OBSIDIAN_VAULT_PATH"))
pushover = Pushover(api_token=os.getenv("PUSHOVER_API_TOKEN"), user_key=os.getenv("PUSHOVER_USER_KEY"))

tasks_store = {}
reminder.start(obsidian, pushover, tasks_store, interval=FETCH_TASKS_INTERVAL)

# Spotify / music reviewer (optional — only enabled if SPOTIFY_CLIENT_ID is set)
_spotify = None
_music_writer = None
_spotify_error = None

if os.getenv("SPOTIFY_CLIENT_ID"):
    try:
        from backend.music.spotify import SpotifyClient
        from backend.music.writer import MusicWriter
        _spotify = SpotifyClient()
        _music_writer = MusicWriter(_spotify)
        logger.info("Spotify client initialized")
    except Exception as e:
        _spotify_error = str(e)
        logger.warning(f"Spotify not available: {e}")

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

app.register_blueprint(create_tasks_blueprint(obsidian, tasks_store, logger))
app.register_blueprint(create_habits_blueprint(obsidian, logger))
app.register_blueprint(create_music_blueprint(_spotify, _music_writer, logger, _spotify_error))

def main():
    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
