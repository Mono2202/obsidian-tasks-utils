import os
import subprocess
from datetime import date
from urllib.parse import quote
import dotenv
from flask import Flask, send_from_directory, jsonify

from backend.logger import get_logger
from backend.notifications import reminder, rest_timer
from backend.notifications.pushover import Pushover
from backend.routes.tasks import create_tasks_blueprint
from backend.routes.habits import create_habits_blueprint
from backend.routes.inbox import create_inbox_blueprint
from backend.routes.music import create_music_blueprint
from backend.routes.workout import create_workout_blueprint
from backend.routes.food import create_food_blueprint
from backend.routes.finance import create_finance_blueprint
from backend.routes.items import create_items_blueprint
from obsidian import Vault

FETCH_TASKS_INTERVAL = 30

dotenv.load_dotenv()

_FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'frontend')
_DIST_DIR = os.path.join(_FRONTEND_DIR, 'dist')

app = Flask(
    __name__,
    static_folder=os.path.join(_DIST_DIR, 'js'),
    static_url_path='/js',
)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # no cache during development

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
rest_timer.start(pushover)
reminder.start(vault.tasks, vault.habits, vault.inbox, pushover, tasks_store, interval=FETCH_TASKS_INTERVAL,
               daily_summary_time=os.getenv("DAILY_SUMMARY_TIME", ""),
               habits_reminder_time=os.getenv("DAILY_HABITS_TIME", ""))

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(os.path.join(_FRONTEND_DIR, 'assets'), filename)

@app.route('/manifest.json')
def manifest():
    return send_from_directory(os.path.join(_FRONTEND_DIR, 'assets'), 'manifest.json')

_daily_open_date = None

@app.route('/daily-note-uri')
def daily_note_uri_endpoint():
    daily_folder = os.getenv("OBSIDIAN_DAILY_PATH", "")
    today_str = date.today().strftime("%Y-%m-%d")
    daily_rel = f"{daily_folder}/{today_str}.md" if daily_folder else f"{today_str}.md"
    return jsonify({'uri': f"obsidian://open?file={quote(daily_rel)}"})

@app.route('/')
def index():
    global _daily_open_date
    today = date.today()
    if _daily_open_date != today:
        subprocess.Popen(['obsidian', 'daily:read'])
        _daily_open_date = today
    return send_from_directory(_DIST_DIR, 'index.html')

app.register_blueprint(create_tasks_blueprint(vault.tasks, tasks_store, logger))
app.register_blueprint(create_habits_blueprint(vault.habits, logger))
app.register_blueprint(create_inbox_blueprint(vault.inbox, logger))
app.register_blueprint(create_music_blueprint(_spotify, vault.music, logger, _spotify_error))
app.register_blueprint(create_workout_blueprint(vault.workout, logger, pushover))
app.register_blueprint(create_food_blueprint(vault.food, logger))
app.register_blueprint(create_finance_blueprint(vault.finance, logger))
app.register_blueprint(create_items_blueprint(vault.inbox, vault.tasks, logger))

def main():
    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False, threaded=True)

if __name__ == '__main__':
    main()
