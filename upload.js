const MUSIC_UPLOAD_WORKER = 'https://ai-sound-upload.buidoihn1990.workers.dev';
const LEGACY_UPLOADED_TRACKS_KEY = 'aiSoundStudioUploadedTracksV1';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const uploadForm = document.getElementById('musicUploadForm');
const uploadFile = document.getElementById('musicFile');
const uploadTitle = document.getElementById('uploadTitle');
const uploadArtist = document.getElementById('uploadArtist');
const uploadGenre = document.getElementById('uploadGenre');
const uploadPassword = document.getElementById('uploadPassword');
const uploadButton = document.getElementById('uploadMusicBtn');
const uploadProgressWrap = document.getElementById('uploadProgressWrap');
const uploadProgress = document.getElementById('uploadProgress');
const uploadPercent = document.getElementById('uploadPercent');
const uploadStatus = document.getElementById('uploadStatus');
const uploadHealth = document.getElementById('uploadHealth');
const uploadResult = document.getElementById('uploadResult');
const uploadResultLink = document.getElementById('uploadResultLink');
const playUploadedBtn = document.getElementById('playUploadedBtn');

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

function readAudioDurationSeconds(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement('audio');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const value = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
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

  // D1 là nguồn dữ liệu chung cho các bài người dùng tải lên.
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].uploadedFromD1 && !serverUrls.has(tracks[i].src)) {
      tracks.splice(i, 1);
    }
  }

  rows.forEach(row => {
    if (!row?.audio_url) return;
    const incoming = toPlayerTrack(row);
    const existingIndex = tracks.findIndex(track => track.src === incoming.src);

    if (existingIndex >= 0) {
      tracks[existingIndex] = { ...tracks[existingIndex], ...incoming };
    } else {
      tracks.push(incoming);
    }
  });

  refreshPlaylistUI();
}

async function syncTracksFromD1(showStatus = false) {
  if (showStatus && uploadHealth) {
    uploadHealth.textContent = 'Đang đồng bộ playlist từ Cloudflare D1...';
    uploadHealth.className = 'upload-health';
  }

  try {
    const response = await fetch(`${MUSIC_UPLOAD_WORKER}/tracks`, {
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.ok || !Array.isArray(data.tracks)) throw new Error('Dữ liệu playlist không hợp lệ');

    mergeD1Tracks(data.tracks);

    // Bỏ dữ liệu localStorage cũ để D1 trở thành nguồn chung duy nhất.
    try { localStorage.removeItem(LEGACY_UPLOADED_TRACKS_KEY); } catch {}

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

    const data = await response.json().catch(() => ({}));
    if (data.ok === false) throw new Error('health failed');

    uploadHealth.textContent = 'Máy chủ tải lên + R2 + D1 đang hoạt động';
    uploadHealth.className = 'upload-health online';
    await syncTracksFromD1(true);
  } catch {
    uploadHealth.textContent = 'Không kết nối được máy chủ tải lên';
    uploadHealth.className = 'upload-health offline';
  }
}

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

  const file = uploadFile.files?.[0];
  const secret = uploadPassword.value;
  const title = uploadTitle.value.trim() || (file ? titleFromFilename(file.name) : '');
  const artist = uploadArtist.value.trim() || 'AI Sound Studio';
  const genre = uploadGenre.value.trim() || 'AI Music';

  if (!file) return setUploadStatus('Hãy chọn một file MP3.', 'error');
  if (!file.name.toLowerCase().endsWith('.mp3')) return setUploadStatus('Hiện tại chỉ hỗ trợ file MP3.', 'error');
  if (file.size > MAX_UPLOAD_BYTES) return setUploadStatus('File lớn hơn 50 MB. Hãy chọn file nhỏ hơn.', 'error');
  if (!secret) return setUploadStatus('Hãy nhập mã tải lên.', 'error');
  if (!title) return setUploadStatus('Hãy nhập tên bài hát.', 'error');

  uploadButton.disabled = true;
  uploadButton.textContent = 'Đang tải lên...';
  uploadProgressWrap.classList.add('show');
  uploadProgress.value = 0;
  uploadPercent.textContent = '0%';
  uploadResult.classList.remove('show');
  setUploadStatus('Đang đọc thông tin bài hát...');

  const durationSeconds = await readAudioDurationSeconds(file);
  const durationHint = formatDuration(durationSeconds);

  const params = new URLSearchParams({
    name: file.name,
    title,
    artist,
    genre,
    duration: String(durationSeconds)
  });

  const xhr = new XMLHttpRequest();
  const endpoint = `${MUSIC_UPLOAD_WORKER}/upload?${params.toString()}`;

  xhr.open('PUT', endpoint);
  xhr.setRequestHeader('Authorization', `Bearer ${secret}`);
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
    uploadPassword.value = '';

    let data = null;
    try { data = JSON.parse(xhr.responseText); } catch {}

    if (xhr.status < 200 || xhr.status >= 300) {
      let message = data?.error || `Tải lên thất bại (${xhr.status}).`;
      if (xhr.status === 401) message = 'Mã tải lên không đúng.';
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
        durationHint: formatDuration(Number(data.durationSeconds || durationSeconds)) || durationHint,
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
    uploadPassword.value = '';
    setUploadStatus('Mất kết nối khi tải lên. Hãy kiểm tra Worker và thử lại.', 'error');
  };

  xhr.send(file);
});

playUploadedBtn?.addEventListener('click', () => {
  if (lastUploadedTrackIndex < 0) return;
  loadTrack(lastUploadedTrackIndex, true);
  document.getElementById('mainPlayer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

checkUploadServer();
