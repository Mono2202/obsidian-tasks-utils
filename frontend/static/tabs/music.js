let _musicRating = 0;
let _musicCurrentTrack = null;
let _musicPollTimer = null;
let _musicAlbumMode = localStorage.getItem('musicAlbumMode') !== 'false';

function onMusicModeChange(checked) {
  _musicAlbumMode = checked;
  localStorage.setItem('musicAlbumMode', checked);
  document.getElementById('music-mode-label').textContent = checked ? 'Album page' : 'Song page';
  if (_musicCurrentTrack) _loadExistingReview(_musicCurrentTrack);
}

function _initStarRating() {
  const container = document.getElementById('star-rating');
  container.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '★';
    star.dataset.value = i;
    star.addEventListener('click', () => _setMusicRating(i));
    star.addEventListener('mouseenter', () => _highlightStars(i, true));
    star.addEventListener('mouseleave', () => _highlightStars(_musicRating, false));
    container.appendChild(star);
  }
  _highlightStars(0, false);
}

function _highlightStars(n, isHover) {
  document.querySelectorAll('.star').forEach((s, idx) => {
    s.classList.toggle('filled', idx < _musicRating && !isHover);
    s.classList.toggle('hover', idx < n);
  });
  const label = n > 0 ? `${n}/10` : (_musicRating > 0 ? `${_musicRating}/10` : '-/10');
  document.getElementById('music-rating-text').textContent = label;
}

function _setMusicRating(n) {
  _musicRating = (_musicRating === n) ? 0 : n;
  _highlightStars(_musicRating, false);
}

function _showMusicIdle(msg) {
  document.getElementById('music-track-title').textContent = msg || 'Nothing playing';
  document.getElementById('music-track-meta').textContent = '';
  document.getElementById('music-cover').style.display = 'none';
  document.getElementById('music-cover-placeholder').style.display = 'block';
  _resetMusicForm();
  _musicCurrentTrack = null;
}

function _resetMusicForm() {
  _musicRating = 0;
  if (document.getElementById('star-rating').children.length) _highlightStars(0, false);
  document.getElementById('music-notes').value = '';
  document.getElementById('music-status').textContent = '';
  document.getElementById('music-status').className = 'music-status';
}

async function _onMusicTrackChanged(track) {
  document.getElementById('music-track-title').textContent = track.track_name;
  document.getElementById('music-track-meta').textContent = `${track.artist} · ${track.album_name} (${track.release_year})`;

  const img = document.getElementById('music-cover');
  const placeholder = document.getElementById('music-cover-placeholder');
  if (track.cover_url) {
    img.src = track.cover_url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }

  _resetMusicForm();
  await _loadExistingReview(track);
}

async function _loadExistingReview(track) {
  try {
    const params = new URLSearchParams({
      track_id: track.track_id,
      track_name: track.track_name,
      track_number: track.track_number,
      artist: track.artist,
      album_name: track.album_name,
      album_id: track.album_id,
      cover_url: track.cover_url,
      release_year: track.release_year,
      album_mode: _musicAlbumMode,
    });
    const res = await fetch(`/music/get-review?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.review) {
        _musicRating = data.review.rating;
        _highlightStars(_musicRating, false);
        document.getElementById('music-notes').value = data.review.notes || '';
      } else {
        _resetMusicForm();
      }
    }
  } catch (_) {}
}

async function _pollMusicTrack() {
  if (!document.getElementById('tab-music').classList.contains('active')) return;
  try {
    const res = await fetch('/music/current-track');
    const authPrompt = document.getElementById('music-auth-prompt');

    if (res.status === 401) {
      authPrompt.style.display = 'block';
      document.getElementById('music-submit-btn').style.display = 'none';
      _showMusicIdle('');
      document.getElementById('music-track-title').textContent = '';
      return;
    }

    if (res.status === 503) {
      authPrompt.style.display = 'none';
      _showMusicIdle('Spotify not configured.');
      return;
    }

    authPrompt.style.display = 'none';
    document.getElementById('music-submit-btn').style.display = '';

    const data = await res.json();
    if (!data.track) {
      _showMusicIdle();
      return;
    }

    const track = data.track;
    if (!_musicCurrentTrack || _musicCurrentTrack.track_id !== track.track_id) {
      _musicCurrentTrack = track;
      await _onMusicTrackChanged(track);
    }
  } catch (_) {}
}

async function submitMusicReview() {
  if (!_musicCurrentTrack) return;
  if (!_musicRating) {
    _setMusicStatus('Please select a rating.', true);
    return;
  }
  const btn = document.getElementById('music-submit-btn');
  btn.disabled = true;
  _setMusicStatus('Saving…', false);
  try {
    const res = await fetch('/music/submit-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: _musicCurrentTrack,
        rating: _musicRating,
        notes: document.getElementById('music-notes').value,
        album_mode: _musicAlbumMode,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      _setMusicStatus('Review saved!', false);
    } else {
      _setMusicStatus(data.error || 'Failed to save.', true);
    }
  } catch (_) {
    _setMusicStatus('Request failed.', true);
  }
  btn.disabled = false;
}

function _setMusicStatus(msg, isError) {
  const el = document.getElementById('music-status');
  el.textContent = msg;
  el.className = 'music-status ' + (isError ? 'err' : 'ok');
}

function loadMusic() {
  _initStarRating();
  // Restore persisted mode toggle
  const toggle = document.getElementById('music-album-mode');
  toggle.checked = _musicAlbumMode;
  document.getElementById('music-mode-label').textContent = _musicAlbumMode ? 'Album page' : 'Song page';
  _pollMusicTrack();
  if (!_musicPollTimer) {
    _musicPollTimer = setInterval(_pollMusicTrack, 5000);
  }
}
