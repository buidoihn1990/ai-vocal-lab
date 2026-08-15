const MUSIC_UPLOAD_WORKER = 'https://ai-sound-upload.buidoihn1990.workers.dev';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const uploadForm = document.getElementById('musicUploadForm');
const uploadFile = document.getElementById('musicFile');
const uploadTitle = document.getElementById('uploadTitle');
const uploadArtist = document.getElementById('uploadArtist');
const uploadGenre = document.getElementById('uploadGenre');
const uploadButton = document.getElementById('uploadMusicBtn');
const uploadProgressWrap = document.getElementById('uploadProgressWrap');
const uploadProgress = document.getElementById('uploadProgress');
const uploadPercent = document.getElementById('uploadPercent');
const uploadStatus = document.getElementById('uploadStatus');
const uploadHealth = document.getElementById('uploadHealth');
const uploadResult = document.getElementById('uploadResult');
const uploadResultLink = document.getElementById('uploadResultLink');
const playUploadedBtn = document.getElementById('playUploadedBtn');
const uploadAuthBanner = document.getElementById('uploadAuthBanner');
const uploadAuthTitle = document.getElementById('uploadAuthTitle');
const uploadAuthText = document.getElementById('uploadAuthText');
const uploadLoginBtn = document.getElementById('uploadLoginBtn');

let lastUploadedTrackIndex = -1;

function setUploadStatus(message, type = '') {
  if (!uploadStatus) return;
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status${type ? ` ${type}` : ''}`;
}

function titleFromFilename(name) {
  return name.replace(/\.mp3$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function readAudioDuration(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement('audio');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const seconds = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve({ seconds, label: formatDuration(seconds) });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ seconds: 0, label: '--:--' });
    };
    probe.src = objectUrl;
  });
}

function refreshPlaylistUI() {
  renderQueue();
  renderReleases();
  updateTrackCards();
  availableCount.textContent = `${tracks.filter(t => t.available !== false).length}/${tracks.length} bài có MP3`;
}

function setUploadControlsEnabled(enabled) {
  uploadForm?.querySelectorAll('input, select, button[type="submit"]').forEach((element) => {
    element.disabled = !enabled;
  });
}

function applyAuthState(state = {}) {
  const authenticated = Boolean(state.authenticated || state.user);
  const permission = state.permission || null;
  const canUpload = Boolean(state.canUpload || permission?.canUpload);

  uploadAuthBanner?.classList.remove('allowed', 'pending');

  if (!authenticated) {
    if (uploadAuthTitle) uploadAuthTitle.textContent = 'Đăng nhập để tải nhạc';
    if (uploadAuthText) uploadAuthText.textContent = 'Bạn cần một tài khoản AI Sound Studio. Quyền tải lên được cấp riêng cho từng tài khoản.';
    if (uploadLoginBtn) {
      uploadLoginBtn.textContent = 'Đăng nhập';
      uploadLoginBtn.style.display = '';
    }
    setUploadControlsEnabled(false);
    return;
  }

  if (!permission?.workerReady) {
    uploadAuthBanner?.classList.add('pending');
    if (uploadAuthTitle) uploadAuthTitle.textContent = 'Đã đăng nhập • đang chờ kiểm tra quyền';
    if (uploadAuthText) uploadAuthText.textContent = 'Worker cần endpoint /me để xác minh tài khoản và quyền tải lên.';
    if (uploadLoginBtn) {
      uploadLoginBtn.textContent = 'Kiểm tra lại';
      uploadLoginBtn.style.display = '';
    }
    setUploadControlsEnabled(false);
    return;
  }

  if (!canUpload) {
    uploadAuthBanner?.classList.add('pending');
    if (uploadAuthTitle) uploadAuthTitle.textContent = 'Tài khoản chưa được cấp quyền tải lên';
    if (uploadAuthText) uploadAuthText.textContent = 'Bạn đã đăng nhập thành công. Quản trị viên cần bật quyền can_upload cho tài khoản này.';
    if (uploadLoginBtn) {
      uploadLoginBtn.textContent = 'Kiểm tra lại quyền';
      uploadLoginBtn.style.display = '';
    }
    setUploadControlsEnabled(false);
    return;
  }

  uploadAuthBanner?.classList.add('allowed');
  if (uploadAuthTitle) uploadAuthTitle.textContent = 'Tài khoản được phép tải nhạc';
  if (uploadAuthText) uploadAuthText.textContent = `Quyền: ${permission?.role || 'uploader'} • File MP3 lưu ở R2 và thông tin bài hát lưu ở D1.`;
  if (uploadLoginBtn) uploadLoginBtn.style.display = 'none';
  setUploadControlsEnabled(true);
}

function toPlayerTrack(row) {
  return {
    title: row.title || 'Không tên',
    artist: row.artist || 'AI Sound Studio',
    genre: row.genre || 'AI Music',
    src: row.audio_url,
    cover: row.cover_url || '',
    durationHint: formatDuration(Number(row.duration_seconds || 0)),
    available: true,
    uploadedFromD1: true,
    d1Id: row.id || null,
    r2Key: row.r2_key || ''
  };
}

function mergeD1Tracks(rows) {
  const serverUrls = new Set(rows.map(row => row.audio_url).filter(Boolean));
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].uploadedFromD1 && !serverUrls.has(tracks[i].src)) tracks.splice(i, 1);
  }

  rows.forEach(row => {
    if (!row?.audio_url) return;
    const incoming = toPlayerTrack(row);
    const existingIndex = tracks.findIndex(track => track.src === incoming.src);
    if (existingIndex >= 0) tracks[existingIndex] = { ...tracks[existingIndex], ...incoming };
    else tracks.push(incoming);
  });
  refreshPlaylistUI();
}

async function syncTracksFromD1(showStatus = false) {
  try {
    const response = await fetch(`${MUSIC_UPLOAD_WORKER}/tracks`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.tracks)) throw new Error('Dữ liệu playlist không hợp lệ');
    mergeD1Tracks(data.tracks);
    if (showStatus && uploadHealth) {
      uploadHealth.textContent = `Máy chủ hoạt động • Đã đồng bộ ${data.tracks.length} bài từ D1`;
      uploadHealth.className = 'upload-health online';
    }
    return true;
  } catch (error) {
    if (showStatus && uploadHealth) {
      uploadHealth.textContent = 'Máy chủ hoạt động nhưng chưa đồng bộ được playlist D1';
      uploadHealth.className = 'upload-health offline';
    }
    console.warn('Không đồng bộ được playlist D1:', error);
    return false;
  }
}

async function checkUploadServer() {
  if (!uploadHealth) return;
  uploadHealth.textContent = 'Đang kiểm tra máy chủ tải lên...';
  uploadHealth.className = 'upload-health';
  try {
    const response = await fetch(`${MUSIC_UPLOAD_WORKER}/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error('offline');
    uploadHealth.textContent = 'Máy chủ tải lên + R2 + D1 đang hoạt động';
    uploadHealth.className = 'upload-health online';
    await syncTracksFromD1(true);
  } catch {
    uploadHealth.textContent = 'Không kết nối được máy chủ tải lên';
    uploadHealth.className = 'upload-health offline';
  }
}

uploadLoginBtn?.addEventListener('click', async () => {
  const state = window.aiSoundAuth?.getState?.() || {};
  if (!state.user) return window.aiSoundAuth?.open?.('login');
  await window.aiSoundAuth?.refreshPermission?.();
});

uploadFile?.addEventListener('change', () => {
  const file = uploadFile.files?.[0];
  if (!file) return;
  if (!uploadTitle.value.trim()) uploadTitle.value = titleFromFilename(file.name);
  setUploadStatus(`${file.name} • ${(file.size / 1024 / 1024).toFixed(1)} MB`);
  uploadProgressWrap.classList.remove('show');
  uploadResult.classList.remove('show');
});

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const session = await window.aiSoundAuth?.getSession?.();
  if (!session?.access_token) {
    setUploadStatus('Hãy đăng nhập trước khi tải nhạc.', 'error');
    window.aiSoundAuth?.open?.('login');
    return;
  }

  const permission = await window.aiSoundAuth?.refreshPermission?.(session);
  if (!permission?.canUpload) return setUploadStatus('Tài khoản này chưa được cấp quyền tải nhạc.', 'error');

  const file = uploadFile.files?.[0];
  const title = uploadTitle.value.trim() || (file ? titleFromFilename(file.name) : '');
  const artist = uploadArtist.value.trim() || 'AI Sound Studio';
  const genre = uploadGenre.value.trim() || 'AI Music';

  if (!file) return setUploadStatus('Hãy chọn một file MP3.', 'error');
  if (!file.name.toLowerCase().endsWith('.mp3')) return setUploadStatus('Hiện tại chỉ hỗ trợ file MP3.', 'error');
  if (file.size > MAX_UPLOAD_BYTES) return setUploadStatus('File lớn hơn 50 MB. Hãy chọn file nhỏ hơn.', 'error');
  if (!title) return setUploadStatus('Hãy nhập tên bài hát.', 'error');

  uploadButton.disabled = true;
  uploadButton.textContent = 'Đang tải lên...';
  uploadProgressWrap.classList.add('show');
  uploadProgress.value = 0;
  uploadPercent.textContent = '0%';
  uploadResult.classList.remove('show');
  setUploadStatus('Đang chuẩn bị file...');

  const duration = await readAudioDuration(file);
  const params = new URLSearchParams({ name: file.name, title, artist, genre, duration: String(duration.seconds) });
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', `${MUSIC_UPLOAD_WORKER}/upload?${params.toString()}`);
  xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
  xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');

  xhr.upload.onprogress = (progressEvent) => {
    if (!progressEvent.lengthComputable) return;
    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    uploadProgress.value = percent;
    uploadPercent.textContent = `${percent}%`;
    setUploadStatus(`Đang tải ${file.name} lên R2...`);
  };

  xhr.onload = async () => {
    uploadButton.disabled = false;
    uploadButton.textContent = '🎵 Tải nhạc lên';
    let data = null;
    try { data = JSON.parse(xhr.responseText); } catch {}

    if (xhr.status < 200 || xhr.status >= 300) {
      let message = data?.error || `Tải lên thất bại (${xhr.status}).`;
      if (xhr.status === 401) message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
      else if (xhr.status === 403) message = 'Tài khoản chưa được cấp quyền tải nhạc.';
      else if (xhr.status === 413) message = 'File quá lớn.';
      else if (xhr.status === 415) message = 'File không phải MP3 hợp lệ.';
      setUploadStatus(message, 'error');
      return;
    }

    try {
      if (!data?.publicUrl) throw new Error('Missing public URL');
      const newTrack = {
        title: data.title || title,
        artist: data.artist || artist,
        genre: data.genre || genre,
        src: data.publicUrl,
        cover: '',
        durationHint: formatDuration(Number(data.durationSeconds) || duration.seconds),
        available: true,
        uploadedFromD1: true,
        d1Id: data.id || null,
        r2Key: data.key || ''
      };

      const existingIndex = tracks.findIndex(track => track.src === newTrack.src);
      if (existingIndex >= 0) {
        tracks[existingIndex] = { ...tracks[existingIndex], ...newTrack };
        lastUploadedTrackIndex = existingIndex;
      } else {
        tracks.push(newTrack);
        lastUploadedTrackIndex = tracks.length - 1;
      }

      refreshPlaylistUI();
      uploadProgress.value = 100;
      uploadPercent.textContent = '100%';
      uploadResultLink.href = data.publicUrl;
      uploadResultLink.textContent = data.publicUrl;
      uploadResult.classList.add('show');
      setUploadStatus(`Đã tải “${newTrack.title}” lên R2 và lưu vào D1. Mọi thiết bị sẽ thấy bài này.`, 'success');
      toast(`Đã xuất bản: ${newTrack.title}`);

      await syncTracksFromD1(false);
      const syncedIndex = tracks.findIndex(track => track.src === newTrack.src);
      if (syncedIndex >= 0) lastUploadedTrackIndex = syncedIndex;
    } catch (error) {
      console.error(error);
      setUploadStatus('File đã tải lên nhưng website không đọc được phản hồi của máy chủ.', 'error');
    }
  };

  xhr.onerror = () => {
    uploadButton.disabled = false;
    uploadButton.textContent = '🎵 Tải nhạc lên';
    setUploadStatus('Mất kết nối khi tải lên. Hãy kiểm tra Worker và thử lại.', 'error');
  };

  xhr.send(file);
});

playUploadedBtn?.addEventListener('click', () => {
  if (lastUploadedTrackIndex < 0) return;
  loadTrack(lastUploadedTrackIndex, true);
  document.getElementById('mainPlayer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.addEventListener('ai-auth-changed', (event) => applyAuthState(event.detail));
setTimeout(() => applyAuthState(window.aiSoundAuth?.getState?.() || {}), 0);
checkUploadServer();
