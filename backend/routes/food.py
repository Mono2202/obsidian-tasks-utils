import os
from flask import Blueprint, request, jsonify


def create_food_blueprint(food, logger):
    bp = Blueprint('food', __name__)

    def _unconfigured():
        return jsonify({"error": "Food reviews not configured. Set OBSIDIAN_FOOD_PATH in .env"}), 503

    @bp.route('/food/restaurants', methods=['GET'])
    def get_restaurants():
        if not food or not food.reviews_path:
            return jsonify({"restaurants": []})
        return jsonify({"restaurants": food.get_restaurants()})

    @bp.route('/food/submit', methods=['POST'])
    def submit():
        if not food or not food.reviews_path:
            return _unconfigured()

        mode = request.form.get('mode', 'homemade')
        dish = request.form.get('dish', '').strip()
        restaurant = request.form.get('restaurant', '').strip()
        cost = request.form.get('cost', '').strip() or None
        notes = request.form.get('notes', '').strip() or None

        try:
            rating = int(request.form.get('rating', 0))
        except ValueError:
            return jsonify({"error": "Invalid rating"}), 400

        if not dish:
            return jsonify({"error": "Dish name is required"}), 400
        if mode == 'restaurant' and not restaurant:
            return jsonify({"error": "Restaurant name is required"}), 400
        if not 1 <= rating <= 10:
            return jsonify({"error": "Rating must be 1–5"}), 400

        photo_bytes = photo_ext = None
        photo = request.files.get('photo')
        if photo and photo.filename:
            photo_ext = os.path.splitext(photo.filename)[1].lower() or '.jpg'
            photo_bytes = photo.read()

        try:
            filename = food.save_review(
                mode=mode, dish=dish, rating=rating,
                restaurant=restaurant or None, cost=cost, notes=notes,
                photo_bytes=photo_bytes, photo_ext=photo_ext,
            )
            return jsonify({"status": "ok", "file": filename})
        except Exception as e:
            logger.error(f"Food review error: {e}")
            return jsonify({"error": str(e)}), 500

    return bp
