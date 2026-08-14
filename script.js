const tracks = [
  { title: 'Ánh sáng và bóng tối', artist: 'AI Sound Studio', genre: 'AI Music', src: 'ánh sáng và bóng tối .mp3', cover: 'album-cover.jpg', durationHint: '05:37' },
  { title: 'Synthetic Heart', artist: 'AI Sound Studio', genre: 'Future Pop', src: 'synthetic-heart.mp3', cover: 'synthetic-heart.jpg', durationHint: '04:21' },
  { title: 'Cosmic Memories', artist: 'AI Sound Studio', genre: 'Ambient R&B', src: 'cosmic-memories.mp3', cover: 'cosmic-memories.jpg', durationHint: '03:48' },
  { title: 'Echoes of You', artist: 'AI Sound Studio', genre: 'Dream Pop', src: 'echoes-of-you.mp3', cover: 'echoes-of-you.jpg', durationHint: '03:15' },
  { title: 'Digital Paradise', artist: 'AI Sound Studio', genre: 'Electronic', src: 'digital-paradise.mp3', cover: 'digital-paradise.jpg', durationHint: '03:59' }
];

let currentIndex = 0;
let shuffleEnabled = false;
let repeatMode = 0; // 0: off, 1: all, 2: one
let miniDismissed = false;
let waveRAF = null;

const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const listenBtn = document.getElementById('listenBtn');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumCover = document.getElementById('albumCover');
const coverFallback = document.getElementById('coverFallback');
const playingBadge = document.getElementById('playingBadge');
const playerStatus = document.getElementById('playerStatus');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeBar = document.getElementById('volumeBar');
const muteBtn = document.getElementById('muteBtn');
const speedSelect = document.getElementById('speedSelect');
const repeatBtn = document.getElementById('repeatBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const queue = document.getElementById('playlistQueue');
const availableCount = document.getElementById('availableCount');
const releaseList = document.getElementById('releaseList');
const wave = document.getElementById('wave');

const miniPlayer = document.getElementById('miniPlayer');
const miniCover = document.getElementById('miniCover');
const miniCoverFallback = document.getElementById('miniCoverFallback');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniPlay = document.getElementById('miniPlay');
const miniProgress = document.getElementById('miniProgress');
const miniTime = document.getElementById('miniTime');
const miniMute = document.getElementById('miniMute');

const toast = (msg) => {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function paintRange(el, valuePercent) {
  const pct = Math.max(0, Math.min(100, valuePercent));
  el.style.background = `linear-gradient(90deg,#8b5cff 0%,#23c5ff ${pct}%,rgba(255,255,255,.12) ${pct}%,rgba(255,255,255,.12) 100%)`;
}

for (let i = 0; i < 56; i++) {
  const b = document.createElement('span');
  b.className = 'bar';
  b.style.setProperty('--h', `${12 + ((i * 17) % 46)}px`);
  b.dataset.base = String(0.45 + ((i * 11) % 45) / 100);
  wave.appendChild(b);
}
const waveBars = [...wave.querySelectorAll('.bar')];

function animateWave() {
  const t = audio.currentTime || performance.now() / 1000;
  waveBars.forEach((bar, i) => {
    const base = Number(bar.dataset.base || 0.6);
    const pulse = 0.55 + Math.abs(Math.sin(t * (2.6 + (i % 6) * 0.19) + i * 0.67)) * 0.72;
    bar.style.transform = `scaleY(${Math.max(.32, base * pulse)})`;
    bar.style.opacity = String(0.62 + Math.min(.38, pulse * .25));
  });
  waveRAF = requestAnimationFrame(animateWave);
}

function startWave() {
  wave.classList.add('playing');
  if (!waveRAF) waveRAF = requestAnimationFrame(animateWave);
}

function stopWave() {
  wave.classList.remove('playing');
  if (waveRAF) cancelAnimationFrame(waveRAF);
  waveRAF = null;
  waveBars.forEach(b => { b.style.transform = 'scaleY(.62)'; b.style.opacity = '.82'; });
}

async function fileExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

async function detectAvailability() {
  await Promise.all(tracks.map(async (track) => {
    track.available = await fileExists(track.src);
  }));
  renderQueue();
  renderReleases();
  updateTrackCards();
  availableCount.textContent = `${tracks.filter(t => t.available).length}/${tracks.length} bài có MP3`;
}

function showCover(track, main = true) {
  const img = main ? albumCover : miniCover;
  const fallback = main ? coverFallback : miniCoverFallback;
  img.style.display = 'none';
  fallback.style.display = 'block';
  if (!track.cover) return;
  const test = new Image();
  test.onload = () => { img.src = track.cover; img.style.display = 'block'; fallback.style.display = 'none'; };
  test.onerror = () => { img.style.display = 'none'; fallback.style.display = 'block'; };
  test.src = track.cover;
}

function syncMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'AI Sound Studio',
      artwork: track.cover ? [{ src: track.cover, sizes: '512x512' }] : []
    });
  } catch {}
}

function renderQueue() {
  queue.innerHTML = '';
  tracks.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = `queue-item${i === currentIndex ? ' active' : ''}${track.available === false ? ' disabled' : ''}`;
    item.innerHTML = `<span class="queue-thumb"></span><span class="queue-meta"><strong>${track.title}</strong><span>${track.genre} • ${track.durationHint}</span></span><span class="queue-state">${track.available === false ? 'Chưa có MP3' : i === currentIndex && !audio.paused ? 'Đang phát' : 'Phát'}</span>`;
    item.onclick = () => {
      if (track.available === false) return toast(`Chưa có file ${track.src}`);
      loadTrack(i, true);
    };
    queue.appendChild(item);
  });
}

function renderReleases() {
  releaseList.innerHTML = '';
  tracks.forEach((track, i) => {
    const el = document.createElement('div');
    el.className = 'release';
    el.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><span class="thumb"></span><b>${track.title}</b><span class="hide-sm">AI Sound Studio</span><span class="hide-sm">${track.genre}</span><span>${track.durationHint}</span><span class="play-link ${track.available === false ? 'disabled' : ''}" data-index="${i}">${track.available === false ? 'Chờ MP3' : 'Phát'}</span>`;
    el.querySelector('.play-link').onclick = () => {
      if (track.available === false) return toast(`Chưa có file ${track.src}`);
      loadTrack(i, true);
    };
    releaseList.appendChild(el);
  });
}

function updateTrackCards() {
  document.querySelectorAll('.track-card').forEach(card => {
    const i = Number(card.dataset.track);
    const meta = card.querySelector('.meta span:last-child');
    if (!tracks[i]) return;
    meta.textContent = tracks[i].available === false ? 'Chờ MP3' : 'Phát ngay';
    card.onclick = () => {
      if (tracks[i].available === false) return toast(`Chưa có file ${tracks[i].src}`);
      loadTrack(i, true);
    };
  });
}

function updateUIForTrack() {
  const track = tracks[currentIndex];
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  miniTitle.textContent = track.title;
  miniArtist.textContent = track.artist;
  showCover(track, true);
  showCover(track, false);
  syncMediaSession(track);
  renderQueue();
}

async function loadTrack(index, autoplay = false) {
  if (!tracks[index]) return;
  const track = tracks[index];
  if (track.available === false) return toast(`Chưa có file ${track.src}`);
  currentIndex = index;
  audio.src = track.src;
  audio.load();
  progressBar.value = 0;
  miniProgress.value = 0;
  updateUIForTrack();
  updateProgress();
  if (autoplay) {
    try { await audio.play(); } catch { toast('Trình duyệt chưa cho phép tự phát. Hãy bấm Play.'); }
  }
}

async function toggleAudio() {
  const track = tracks[currentIndex];
  if (track.available === false) return toast(`Chưa có file ${track.src}`);
  try {
    if (audio.paused) await audio.play(); else audio.pause();
  } catch {
    toast(`Không thể phát ${track.title}. Hãy kiểm tra file MP3.`);
  }
}

function syncPlayUI() {
  const paused = audio.paused;
  playBtn.textContent = paused ? '▶' : 'Ⅱ';
  miniPlay.textContent = paused ? '▶' : 'Ⅱ';
  listenBtn.textContent = paused ? '▶ Nghe ngay' : 'Ⅱ Tạm dừng';
  playingBadge.textContent = paused ? 'TẠM DỪNG' : 'ĐANG PHÁT';
  playerStatus.textContent = paused ? 'Đã tạm dừng' : 'Đang phát';
  if (paused) stopWave(); else startWave();
  renderQueue();
  updateMiniVisibility();
}

function updateProgress() {
  const current = audio.currentTime || 0;
  const total = Number.isFinite(audio.duration) ? audio.duration : 0;
  const ratio = total > 0 ? current / total : 0;
  const sliderValue = Math.round(ratio * 1000);
  progressBar.value = sliderValue;
  miniProgress.value = sliderValue;
  currentTimeEl.textContent = formatTime(current);
  durationEl.textContent = formatTime(total);
  miniTime.textContent = `${formatTime(current)} / ${formatTime(total)}`;
  paintRange(progressBar, ratio * 100);
  paintRange(miniProgress, ratio * 100);
}

function findNextAvailable(direction = 1) {
  const available = tracks.map((t, i) => t.available !== false ? i : -1).filter(i => i >= 0);
  if (!available.length) return currentIndex;
  if (shuffleEnabled && available.length > 1) {
    const options = available.filter(i => i !== currentIndex);
    return options[Math.floor(Math.random() * options.length)];
  }
  let i = currentIndex;
  for (let n = 0; n < tracks.length; n++) {
    i = (i + direction + tracks.length) % tracks.length;
    if (tracks[i].available !== false) return i;
  }
  return currentIndex;
}

function nextTrack(auto = false) {
  if (repeatMode === 2 && auto) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  const next = findNextAvailable(1);
  if (next === currentIndex && repeatMode === 0 && auto) {
    audio.pause();
    audio.currentTime = 0;
    syncPlayUI();
    return;
  }
  loadTrack(next, true);
}

function previousTrack() {
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  loadTrack(findNextAvailable(-1), true);
}

function updateVolumeUI() {
  const pct = Math.round((audio.muted ? 0 : audio.volume) * 100);
  volumeBar.value = pct;
  muteBtn.textContent = pct === 0 ? '🔇' : pct < 45 ? '🔉' : '🔊';
  miniMute.textContent = muteBtn.textContent;
  paintRange(volumeBar, pct);
}

function updateMiniVisibility() {
  const shouldShow = !miniDismissed && (window.scrollY > 360 || !audio.paused);
  miniPlayer.classList.toggle('show', shouldShow);
}

playBtn.onclick = toggleAudio;
miniPlay.onclick = toggleAudio;
listenBtn.onclick = toggleAudio;
document.getElementById('back10Btn').onclick = () => audio.currentTime = Math.max(0, audio.currentTime - 10);
document.getElementById('forward10Btn').onclick = () => audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 10, audio.currentTime + 10);
document.getElementById('prevTrackBtn').onclick = previousTrack;
document.getElementById('nextTrackBtn').onclick = () => nextTrack(false);
document.getElementById('miniPrev').onclick = previousTrack;
document.getElementById('miniNext').onclick = () => nextTrack(false);

progressBar.oninput = () => {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = (Number(progressBar.value) / 1000) * audio.duration;
};
miniProgress.oninput = () => {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = (Number(miniProgress.value) / 1000) * audio.duration;
};

volumeBar.oninput = () => {
  audio.muted = false;
  audio.volume = Number(volumeBar.value) / 100;
  updateVolumeUI();
};
muteBtn.onclick = miniMute.onclick = () => { audio.muted = !audio.muted; updateVolumeUI(); };
speedSelect.onchange = () => { audio.playbackRate = Number(speedSelect.value); toast(`Tốc độ phát ${speedSelect.value}×`); };

repeatBtn.onclick = () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  repeatBtn.textContent = repeatMode === 2 ? '↻¹' : '↻';
  toast(repeatMode === 0 ? 'Đã tắt lặp' : repeatMode === 1 ? 'Lặp toàn bộ playlist' : 'Lặp một bài');
};
shuffleBtn.onclick = () => {
  shuffleEnabled = !shuffleEnabled;
  shuffleBtn.classList.toggle('active', shuffleEnabled);
  toast(shuffleEnabled ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên');
};
favoriteBtn.onclick = () => {
  favoriteBtn.classList.toggle('active');
  favoriteBtn.textContent = favoriteBtn.classList.contains('active') ? '♥' : '♡';
};

document.getElementById('miniClose').onclick = () => { miniDismissed = true; miniPlayer.classList.remove('show'); };
window.addEventListener('scroll', updateMiniVisibility, { passive: true });

// Mobile / lock-screen media controls when the browser supports Media Session.
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
    navigator.mediaSession.setActionHandler('seekbackward', (d) => audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)));
    navigator.mediaSession.setActionHandler('seekforward', (d) => audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (d.seekOffset || 10)));
  } catch {}
}

audio.addEventListener('loadedmetadata', updateProgress);
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('play', syncPlayUI);
audio.addEventListener('pause', syncPlayUI);
audio.addEventListener('volumechange', updateVolumeUI);
audio.addEventListener('ended', () => nextTrack(true));
audio.addEventListener('error', () => {
  tracks[currentIndex].available = false;
  renderQueue();
  renderReleases();
  updateTrackCards();
  toast(`Không tải được file ${tracks[currentIndex].src}`);
});

// Keyboard: Space play/pause, arrows seek, N/P next/previous, M mute.
document.addEventListener('keydown', (e) => {
  if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); toggleAudio(); }
  else if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  else if (e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 5);
  else if (e.key.toLowerCase() === 'n') nextTrack(false);
  else if (e.key.toLowerCase() === 'p') previousTrack();
  else if (e.key.toLowerCase() === 'm') { audio.muted = !audio.muted; updateVolumeUI(); }
});

const menu = document.getElementById('mobileMenu');
const menuBtn = document.getElementById('menuBtn');
menuBtn.onclick = () => menu.classList.toggle('open');
menu.querySelectorAll('a').forEach(a => a.onclick = () => menu.classList.remove('open'));

document.getElementById('emailForm').onsubmit = (e) => {
  e.preventDefault();
  toast('Cảm ơn bạn đã đăng ký theo dõi AI Sound Studio!');
  e.target.reset();
};

audio.volume = .85;
loadTrack(0, false);
updateVolumeUI();
syncPlayUI();
updateProgress();
detectAvailability();