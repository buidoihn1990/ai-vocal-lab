const MUSIC_UPLOAD_WORKER = 'https://ai-sound-upload.buidoihn1990.workers.dev';
const UPLOADED_TRACKS_KEY = 'aiSoundStudioUploadedTracksV1';
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
      const value = probe.duration;
      URL.revokeObjectURL(objectUrl);
      resolve(formatDuration(value));
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('--:--');
    };
    probe.src = objectUrl;
  });
}

function saveUploadedTracks() {
  try {
    const uploaded = tracks.filter(track => track.uploadedFromR2).map(track => ({
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      src: track.src,
      cover: track.cover || '',
      durationHint: track.durationHint || '--:--',
      uploadedFromR2: true
    }));
    localStorage.setItem(UPLOADED_TRACKS_KEY, JSON.stringify(uploaded));
  } catch {}
}

function restoreUploadedTracks() {
  try {
    const saved = JSON.parse(localStorage.getItem(UPLOADED_TRACKS_KEY) || '[]');
    if (!Array.isArray(saved)) return;
    saved.forEach(track => {
      if (!track?.src || tracks.some(existing => existing.src === track.src)) return;
      tracks.push({ ...track, available: true });
    });
    if (saved.length) {
      renderQueue();
      renderReleases();
      availableCount.textContent = `${tracks.filter(t => t.available !== false).length}/${tracks.length} bài có MP3`;
      detectAvailability();
    }
  } catch {}
}

async function checkUploadServer() {
  uploadHealth.textContent = 'Đang kiểm tra máy chủ tải lên...';
  uploadHealth.className = 'upload-health';
  try {
    const response = await fetch(`${MUSIC_UPLOAD_WORKER}/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error('offline');
    uploadHealth.textContent = 'Máy chủ tải lên đang hoạt động';
    uploadHealth.className = 'upload-health online';
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
  setUploadStatus('Đang chuẩn bị file...');

  const durationHint = await readAudioDuration(file);
  const xhr = new XMLHttpRequest();
  const endpoint = `${MUSIC_UPLOAD_WORKER}/upload?name=${encodeURIComponent(file.name)}`;

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

  xhr.onload = () => {
    uploadButton.disabled = false;
    uploadButton.textContent = '🎵 Tải nhạc lên';
    uploadPassword.value = '';

    if (xhr.status < 200 || xhr.status >= 300) {
      let message = `Tải lên thất bại (${xhr.status}).`;
      if (xhr.status === 401) message = 'Mã tải lên không đúng.';
      else if (xhr.status === 413) message = 'File quá lớn.';
      else if (xhr.status === 415) message = 'File không phải MP3 hợp lệ.';
      else if (xhr.responseText) message += ` ${xhr.responseText}`;
      setUploadStatus(message, 'error');
      return;
    }

    try {
      const data = JSON.parse(xhr.responseText);
      if (!data.publicUrl) throw new Error('Missing public URL');

      const newTrack = {
        title,
        artist,
        genre,
        src: data.publicUrl,
        cover: '',
        durationHint,
        available: true,
        uploadedFromR2: true
      };

      const existingIndex = tracks.findIndex(track => track.src === newTrack.src);
      if (existingIndex >= 0) {
        tracks[existingIndex] = newTrack;
        lastUploadedTrackIndex = existingIndex;
      } else {
        tracks.push(newTrack);
        lastUploadedTrackIndex = tracks.length - 1;
      }

      saveUploadedTracks();
      renderQueue();
      renderReleases();
      availableCount.textContent = `${tracks.filter(t => t.available !== false).length}/${tracks.length} bài có MP3`;

      uploadProgress.value = 100;
      uploadPercent.textContent = '100%';
      uploadResultLink.href = data.publicUrl;
      uploadResultLink.textContent = data.publicUrl;
      uploadResult.classList.add('show');
      setUploadStatus(`Đã tải “${title}” lên Cloudflare R2 và thêm vào playlist trên trình duyệt này.`, 'success');
      toast(`Đã tải lên: ${title}`);
    } catch {
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

restoreUploadedTracks();
checkUploadServer();
