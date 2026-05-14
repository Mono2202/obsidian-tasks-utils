import re
import dotenv
import os
from datetime import datetime
from flask import Flask, jsonify, request, render_template, send_from_directory, redirect
from obsidian import Obsidian
from pushover import Pushover
from logger import get_logger
import reminder

FETCH_TASKS_INTERVAL = 30

app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'templates'),
            static_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'static'))

dotenv.load_dotenv()
obsidian = Obsidian(vault_path=os.getenv("OBSIDIAN_VAULT_PATH"))
pushover = Pushover(api_token=os.getenv("PUSHOVER_API_TOKEN"), user_key=os.getenv("PUSHOVER_USER_KEY"))

logger = get_logger(__name__)

tasks_store = {}
reminder.start(obsidian, pushover, tasks_store_ref={"store": tasks_store}, interval=FETCH_TASKS_INTERVAL)

_spotify = None
_music_writer = None
_spotify_error = None

if os.getenv("SPOTIFY_CLIENT_ID"):
    try:
        from spotify_client import SpotifyClient
        from music_writer import MusicWriter
        _spotify = SpotifyClient()
        _music_writer = MusicWriter(_spotify)
        logger.info("Spotify client initialized")
    except Exception as e:
        _spotify_error = str(e)
        logger.warning(f"Spotify not available: {e}")

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'frontend', 'assets'), filename)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/today-tasks', methods=['GET'])
def today_tasks_endpoint():
    global tasks_store
    tasks_store = obsidian.fetch_today_tasks()
    logger.info(f"Fetched {len(tasks_store)} tasks for today")
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks_store.items()}
    return jsonify({
        "count": len(tasks_store),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "tasks": serializable
    })

@app.route('/complete-task/<task_id>', methods=['POST'])
def complete_task_endpoint(task_id):
    task = tasks_store.get(task_id)
    if not task:
        return jsonify({"error": "Task not found. Refresh and try again."}), 404

    try:
        obsidian.complete_task(task["file_path"], task["raw_line"])
        del tasks_store[task_id]
        logger.info(f"Task completed: {task['task']}")
        return jsonify({"status": "success", "message": "Task marked as done"}), 200
    except Exception as e:
        logger.error(f"Failed to complete task {task_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/add-task', methods=['GET'])
def add_task_endpoint():
    task_description = request.args.get('task')

    if not task_description:
        return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400

    formatted_task = f"- [ ] #todo {task_description.strip()}"

    try:
        with open(obsidian.inbox_file, "a", encoding="utf-8") as f:
            f.write(f"{formatted_task}\n")

        logger.info(f"Task added to Inbox: {formatted_task}")
        return jsonify({
            "status": "success",
            "message": "Task appended to Inbox",
            "formatted_line": formatted_task
        }), 200

    except Exception as e:
        logger.error(f"Failed to add inbox task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/add-today-task', methods=['GET'])
def add_today_task_endpoint():
    task_description = request.args.get('task')
    task_time = request.args.get('time')

    if not task_description:
        return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400

    if task_time and not re.match(r'^\d{2}:\d{2}$', task_time):
        return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    try:
        formatted_task = obsidian.add_task_to_today(task_description, task_time)
        logger.info(f"Task added to today: {formatted_task}")
        return jsonify({
            "status": "success",
            "message": "Task added to today's daily note",
            "formatted_line": formatted_task
        }), 200
    except Exception as e:
        logger.error(f"Failed to add today task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/upcoming-tasks', methods=['GET'])
def upcoming_tasks_endpoint():
    tasks = obsidian.fetch_upcoming_tasks()
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks.items()}
    return jsonify({"count": len(tasks), "tasks": serializable})

@app.route('/habits', methods=['GET'])
def habits_endpoint():
    habits = obsidian.fetch_habits()
    return jsonify({"habits": habits})

@app.route('/complete-habit/<path:name>', methods=['POST'])
def complete_habit_endpoint(name):
    try:
        obsidian.complete_habit(name)
        return jsonify({"status": "success"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        logger.error(f"Failed to complete habit '{name}': {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/uncomplete-habit/<path:name>', methods=['POST'])
def uncomplete_habit_endpoint(name):
    try:
        obsidian.uncomplete_habit(name)
        return jsonify({"status": "success"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        logger.error(f"Failed to uncomplete habit '{name}': {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/next-tasks', methods=['GET'])
def next_tasks_endpoint():
    tasks = obsidian.fetch_next_tasks()
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks.items()}
    return jsonify({"count": len(tasks), "tasks": serializable})

@app.route('/music/current-track', methods=['GET'])
def music_current_track():
    if _spotify is None:
        return jsonify({"error": _spotify_error or "Spotify not configured", "code": "not_configured"}), 503
    if not _spotify.is_authenticated():
        return jsonify({"error": "Not authenticated", "code": "needs_auth"}), 401
    try:
        track = _spotify.get_current_track()
        if not track:
            return jsonify({"track": None})
        return jsonify({"track": {
            "track_id": track.track_id,
            "track_name": track.track_name,
            "track_number": track.track_number,
            "artist": track.artist,
            "album_name": track.album_name,
            "album_id": track.album_id,
            "cover_url": track.cover_url,
            "release_year": track.release_year,
        }})
    except Exception as e:
        logger.error(f"Failed to get current track: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/music/get-review', methods=['GET'])
def music_get_review():
    if _music_writer is None:
        return jsonify({"error": "Spotify not configured", "code": "not_configured"}), 503
    from spotify_client import TrackInfo
    try:
        track = TrackInfo(
            track_id=request.args.get('track_id', ''),
            track_name=request.args.get('track_name', ''),
            track_number=int(request.args.get('track_number', 0)),
            artist=request.args.get('artist', ''),
            album_name=request.args.get('album_name', ''),
            album_id=request.args.get('album_id', ''),
            cover_url=request.args.get('cover_url', ''),
            release_year=int(request.args.get('release_year', 0)),
        )
        result = _music_writer.get_existing_review(track)
        if not result:
            return jsonify({"review": None})
        rating, notes = result
        return jsonify({"review": {"rating": rating, "notes": notes}})
    except Exception as e:
        logger.error(f"Failed to get review: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/music/submit-review', methods=['POST'])
def music_submit_review():
    if _music_writer is None:
        return jsonify({"error": "Spotify not configured", "code": "not_configured"}), 503
    from spotify_client import TrackInfo
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    track_data = data.get('track', {})
    try:
        track = TrackInfo(
            track_id=track_data.get('track_id', ''),
            track_name=track_data.get('track_name', ''),
            track_number=int(track_data.get('track_number', 0)),
            artist=track_data.get('artist', ''),
            album_name=track_data.get('album_name', ''),
            album_id=track_data.get('album_id', ''),
            cover_url=track_data.get('cover_url', ''),
            release_year=int(track_data.get('release_year', 0)),
        )
        rating = int(data.get('rating', 0))
        notes = data.get('notes', '')
        _music_writer.upsert_review(track, rating, notes)
        logger.info(f"Review saved: {track.track_name} ({rating}/10)")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Failed to submit review: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/music/auth', methods=['GET'])
def music_auth():
    if _spotify is None:
        return "Spotify not configured", 503
    return redirect(_spotify.get_auth_url())

@app.route('/music/callback', methods=['GET'])
def music_callback():
    code = request.args.get('code')
    if code and _spotify:
        try:
            _spotify.exchange_code(code)
        except Exception as e:
            logger.error(f"Spotify OAuth callback error: {e}")
    return redirect('/')

def main():
    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
