from flask import Blueprint, jsonify, request, redirect
from backend.music.spotify import TrackInfo


def create_music_blueprint(spotify, music_writer, logger, spotify_error=None):
    bp = Blueprint('music', __name__)

    def _track_from_args(args) -> TrackInfo:
        return TrackInfo(
            track_id=args.get('track_id', ''),
            track_name=args.get('track_name', ''),
            track_number=int(args.get('track_number', 0)),
            artist=args.get('artist', ''),
            album_name=args.get('album_name', ''),
            album_id=args.get('album_id', ''),
            cover_url=args.get('cover_url', ''),
            release_year=int(args.get('release_year', 0)),
        )

    @bp.route('/music/current-track', methods=['GET'])
    def current_track():
        if spotify is None:
            return jsonify({"error": spotify_error or "Spotify not configured", "code": "not_configured"}), 503
        if not spotify.is_authenticated():
            return jsonify({"error": "Not authenticated", "code": "needs_auth"}), 401
        try:
            track = spotify.get_current_track()
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

    @bp.route('/music/get-review', methods=['GET'])
    def get_review():
        if music_writer is None:
            return jsonify({"error": "Spotify not configured", "code": "not_configured"}), 503
        try:
            track = _track_from_args(request.args)
            album_mode = request.args.get('album_mode', 'true').lower() != 'false'
            result = music_writer.get_existing_review(track, album_mode=album_mode)
            if not result:
                return jsonify({"review": None})
            rating, notes = result
            return jsonify({"review": {"rating": rating, "notes": notes}})
        except Exception as e:
            logger.error(f"Failed to get review: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/music/submit-review', methods=['POST'])
    def submit_review():
        if music_writer is None:
            return jsonify({"error": "Spotify not configured", "code": "not_configured"}), 503
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        try:
            track = _track_from_args(data.get('track', {}))
            rating = int(data.get('rating', 0))
            notes = data.get('notes', '')
            album_mode = data.get('album_mode', True)
            music_writer.upsert_review(track, rating, notes, album_mode=album_mode)
            mode_label = "album" if album_mode else "song"
            logger.info(f"Review saved [{mode_label} mode]: {track.track_name} ({rating}/10)")
            return jsonify({"status": "success"})
        except Exception as e:
            logger.error(f"Failed to submit review: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/music/auth', methods=['GET'])
    def auth():
        if spotify is None:
            return "Spotify not configured", 503
        return redirect(spotify.get_auth_url())

    @bp.route('/music/callback', methods=['GET'])
    def callback():
        code = request.args.get('code')
        if code and spotify:
            try:
                spotify.exchange_code(code)
            except Exception as e:
                logger.error(f"Spotify OAuth callback error: {e}")
        return redirect('/')

    return bp
