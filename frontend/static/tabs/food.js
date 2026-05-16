let _foodRating = 0;
let _foodMode = 'restaurant';

async function loadFood() {
  try {
    const res = await fetch('/food/restaurants');
    const data = await res.json();
    const dl = document.getElementById('food-restaurant-list');
    dl.innerHTML = data.restaurants.map(r => `<option value="${escapeHtml(r)}"></option>`).join('');
  } catch (_) {}
}

function setFoodMode(mode) {
  _foodMode = mode;
  document.getElementById('food-mode-btn-restaurant').classList.toggle('active', mode === 'restaurant');
  document.getElementById('food-mode-btn-homemade').classList.toggle('active', mode === 'homemade');
  document.getElementById('food-restaurant-field').style.display = mode === 'restaurant' ? '' : 'none';
}

function setFoodRating(n) {
  _foodRating = n;
  document.querySelectorAll('#food-stars span').forEach((s, i) => s.classList.toggle('active', i < n));
}

function foodPhotoSelected(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('food-photo-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('food-photo-placeholder').style.display = 'none';
    document.getElementById('food-photo-change').style.display = '';
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitFoodReview() {
  const dish = document.getElementById('food-dish').value.trim();
  const restaurant = document.getElementById('food-restaurant').value.trim();
  const cost = document.getElementById('food-cost').value.trim();
  const notes = document.getElementById('food-notes').value.trim();
  const feedback = document.getElementById('food-feedback');
  const btn = document.getElementById('food-submit-btn');

  feedback.className = 'feedback';
  feedback.textContent = '';

  if (!dish) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Dish name is required.';
    return;
  }
  if (_foodMode === 'restaurant' && !restaurant) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Restaurant name is required.';
    return;
  }
  if (_foodRating === 0) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Please select a rating.';
    return;
  }

  btn.disabled = true;
  const formData = new FormData();
  formData.append('mode', _foodMode);
  formData.append('dish', dish);
  formData.append('rating', _foodRating);
  if (_foodMode === 'restaurant') formData.append('restaurant', restaurant);
  if (cost) formData.append('cost', cost);
  if (notes) formData.append('notes', notes);
  const photoInput = document.getElementById('food-photo-input');
  if (photoInput.files[0]) formData.append('photo', photoInput.files[0]);

  try {
    const res = await fetch('/food/submit', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      playCompletionFeedback();
      feedback.className = 'feedback ok';
      feedback.textContent = 'Review saved!';
      _resetFoodForm();
      if (_foodMode === 'restaurant') loadFood();
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Failed to save.';
    }
  } catch (_) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}

function _resetFoodForm() {
  document.getElementById('food-dish').value = '';
  document.getElementById('food-restaurant').value = '';
  document.getElementById('food-cost').value = '';
  document.getElementById('food-notes').value = '';
  _foodRating = 0;
  document.querySelectorAll('#food-stars span').forEach(s => s.classList.remove('active'));
  const preview = document.getElementById('food-photo-preview');
  preview.style.display = 'none';
  preview.src = '';
  document.getElementById('food-photo-placeholder').style.display = '';
  document.getElementById('food-photo-change').style.display = 'none';
  document.getElementById('food-photo-input').value = '';
}
