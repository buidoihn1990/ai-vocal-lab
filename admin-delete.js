(() => {
  const ADMIN_WORKER_URL = 'https://ai-sound-upload.buidoihn1990.workers.dev';
  let adminRows = [];

  function addAdminStyles() {
    if (document.getElementById('adminTrackManagerStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminTrackManagerStyles';
    style.textContent = `
      .admin-track-manager{grid-column:1/-1;display:none;margin-top:4px;padding:22px;border-radius:24px;background:linear-gradient(180deg,rgba(22,22,36,.98),rgba(11,11,20,.98));border:1px solid rgba(255,93,124,.22);box-shadow:0 26px 70px rgba(0,0,0,.28)}
      .admin-track-manager.show{display:block}
      .admin-manager-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}
      .admin-manager-head h3{margin:0 0 6px;font-size:20px}
      .admin-manager-head p{margin:0;color:#9292a7;font-size:12px;line-height:1.55}
      .admin-manager-badge{padding:7px 10px;border-radius:999px;background:rgba(255,93,124,.1);border:1px solid rgba(255,93,124,.2);color:#ff9cae;font-size:11px;font-weight:800;white-space:nowrap}
      .admin-track-list{display:flex;flex-direction:column;gap:9px}
      .admin-track-row{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(110px,.8fr) 78px 88px;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:#10101a;border:1px solid rgba(255,255,255,.06)}
      .admin-track-main{min-width:0}
      .admin-track-main strong,.admin-track-main span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .admin-track-main strong{font-size:13px;color:#fff}
      .admin-track-main span,.admin-track-meta{margin-top:4px;font-size:11px;color:#85859b}
      .admin-track-play{border:0;border-radius:10px;padding:9px 11px;background:#181827;color:#8de8ff;cursor:pointer;font-weight:700}
      .admin-track-delete{border:1px solid rgba(255,93,124,.32);border-radius:10px;padding:9px 11px;background:rgba(255,93,124,.09);color:#ff9cae;cursor:pointer;font-weight:800}
      .admin-track-delete:hover{background:rgba(255,93,124,.16)}
      .admin-track-delete:disabled{opacity:.5;cursor:not-allowed}
      .admin-manager-empty{padding:18px;border-radius:14px;background:#10101a;color:#85859b;font-size:12px;text-align:center}
      @media(max-width:700px){.admin-track-row{grid-template-columns:1fr auto}.admin-track-meta{display:none}.admin-track-play{display:none}.admin-manager-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = document.getElementById('adminTrackManager');
    if (panel) return panel;

    const form = document.getElementById('musicUploadForm');
    if (!form) return null;

    panel = document.createElement('section');
    panel.id = 'adminTrackManager';
    panel.className = 'admin-track-manager';
    panel.innerHTML = `
      <div class="admin-manager-head">
        <div>
          <h3>Quản lý bài đã tải lên</h3>
          <p>Chỉ tài khoản Admin mới thấy khu vực này. Xóa sẽ gỡ bài khỏi D1 và xóa file MP3 tương ứng trong R2.</p>
        </div>
        <span class="admin-manager-badge">ADMIN • XÓA BÀI</span>
      </div>
      <div class="admin-track-list" id="adminTrackList"></div>
    `;
    form.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function isAdmin() {
    const state = window.aiSoundAuth?.getState?.() || {};
    return state.permission?.role === 'admin';
  }

  function formatAdminDate(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString('vi-VN'); } catch { return ''; }
  }

  function renderRows() {
    const panel = ensurePanel();
    if (!panel) return;
    const list = panel.querySelector('#adminTrackList');
    const admin = isAdmin();
    panel.classList.toggle('show', admin);
    if (!admin) return;

    if (!adminRows.length) {
      list.innerHTML = '<div class="admin-manager-empty">Chưa có bài nào trong Cloudflare D1 để xóa.</div>';
      return;
    }

    list.innerHTML = '';
    adminRows.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'admin-track-row';

      const main = document.createElement('div');
      main.className = 'admin-track-main';
      const title = document.createElement('strong');
      title.textContent = row.title || 'Không tên';
      const sub = document.createElement('span');
      sub.textContent = `${row.artist || 'AI Sound Studio'} • ${row.genre || 'AI Music'}`;
      main.append(title, sub);

      const meta = document.createElement('div');
      meta.className = 'admin-track-meta';
      meta.textContent = `ID ${row.id}${formatAdminDate(row.created_at) ? ` • ${formatAdminDate(row.created_at)}` : ''}`;

      const play = document.createElement('button');
      play.className = 'admin-track-play';
      play.type = 'button';
      play.textContent = '▶ Phát';
      play.onclick = () => {
        const index = typeof tracks !== 'undefined' ? tracks.findIndex((track) => track.src === row.audio_url) : -1;
        if (index >= 0 && typeof loadTrack === 'function') loadTrack(index, true);
        else if (row.audio_url) window.open(row.audio_url, '_blank', 'noopener');
      };

      const del = document.createElement('button');
      del.className = 'admin-track-delete';
      del.type = 'button';
      del.textContent = '🗑 Xóa';
      del.onclick = () => deleteTrack(row, del);

      item.append(main, meta, play, del);
      list.appendChild(item);
    });
  }

  async function loadAdminTracks() {
    if (!isAdmin()) {
      renderRows();
      return;
    }
    try {
      const response = await fetch(`${ADMIN_WORKER_URL}/tracks`, { cache: 'no-store' });
      const data = await response.json();
      adminRows = response.ok && data.ok && Array.isArray(data.tracks) ? data.tracks : [];
    } catch {
      adminRows = [];
    }
    renderRows();
  }

  async function deleteTrack(row, button) {
    if (!isAdmin()) return;
    if (!row?.id) return alert('Bài này không có ID D1 nên chưa thể xóa.');
    const accepted = confirm(`Xóa “${row.title || 'bài hát này'}”?\n\nFile MP3 trong R2 và dữ liệu trong D1 sẽ bị xóa.`);
    if (!accepted) return;

    const session = await window.aiSoundAuth?.getSession?.();
    if (!session?.access_token) {
      alert('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Đang xóa...';

    try {
      const response = await fetch(`${ADMIN_WORKER_URL}/tracks/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      let data = null;
      try { data = await response.json(); } catch {}

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Không xóa được bài (HTTP ${response.status}).`);
      }

      if (typeof audio !== 'undefined' && row.audio_url && (audio.currentSrc === row.audio_url || audio.src === row.audio_url)) {
        audio.pause();
      }

      if (typeof syncTracksFromD1 === 'function') await syncTracksFromD1(true);
      if (typeof toast === 'function') toast(`Đã xóa: ${row.title || 'bài hát'}`);
      await loadAdminTracks();
    } catch (error) {
      alert(error?.message || 'Không thể xóa bài hát.');
      button.disabled = false;
      button.textContent = '🗑 Xóa';
    }
  }

  addAdminStyles();
  ensurePanel();
  document.addEventListener('ai-auth-changed', () => loadAdminTracks());
  setTimeout(loadAdminTracks, 250);
})();
