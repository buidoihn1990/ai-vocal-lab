(() => {
  let lastSignature = '';

  function addCommunityStyles() {
    if (document.getElementById('communityUploadStyles')) return;
    const style = document.createElement('style');
    style.id = 'communityUploadStyles';
    style.textContent = `
      .community-section{position:relative;overflow:hidden}
      .community-section:before{content:"";position:absolute;inset:auto -10% -35% auto;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,rgba(35,197,255,.10),transparent 68%);pointer-events:none}
      .community-copy{max-width:760px;color:var(--muted);line-height:1.7;margin:-8px 0 24px}
      .community-empty{grid-column:1/-1;padding:28px;border:1px dashed rgba(139,92,255,.28);border-radius:18px;background:rgba(139,92,255,.05);color:#8f8fa4;text-align:center}
      .community-card{position:relative;cursor:pointer}
      .community-card .community-badge{position:absolute;top:12px;right:12px;z-index:2;padding:6px 9px;border-radius:999px;background:rgba(10,10,18,.82);border:1px solid rgba(35,197,255,.24);color:#8de8ff;font-size:10px;font-weight:800;backdrop-filter:blur(8px)}
      .community-card .cover{display:flex;align-items:flex-end;justify-content:flex-start;padding:14px;overflow:hidden}
      .community-card .cover:after{content:"AI SOUND";font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.78)}
      .community-card .community-meta{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#85859b;font-size:11px}
      .community-card:hover{transform:translateY(-3px)}
    `;
    document.head.appendChild(style);
  }

  function getCommunityTracks() {
    try {
      return tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => track?.uploadedFromD1)
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  function renderCommunityUploads(force = false) {
    const list = document.getElementById('communityUploadList');
    if (!list) return;

    const rows = getCommunityTracks();
    const signature = rows.map(({ track }) => `${track.d1Id || ''}:${track.src}:${track.title}:${track.available}`).join('|');
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    list.innerHTML = '';

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'community-empty';
      empty.textContent = 'Chưa có bài hát cộng đồng nào. Bài mới tải lên qua tài khoản AI Sound Studio sẽ xuất hiện tại đây.';
      list.appendChild(empty);
      return;
    }

    rows.forEach(({ track, index }, order) => {
      const card = document.createElement('article');
      card.className = 'card community-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Phát ${track.title}`);

      const cover = document.createElement('div');
      cover.className = `cover c${(order % 4) + 1}`;
      if (track.cover) {
        cover.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35)),url("${track.cover.replace(/"/g, '%22')}")`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
      }

      const badge = document.createElement('span');
      badge.className = 'community-badge';
      badge.textContent = 'CỘNG ĐỒNG';
      cover.appendChild(badge);

      const title = document.createElement('h3');
      title.textContent = track.title || 'Không tên';

      const artist = document.createElement('p');
      artist.textContent = track.artist || 'AI Sound Studio';

      const meta = document.createElement('div');
      meta.className = 'community-meta';
      const genre = document.createElement('span');
      genre.textContent = track.genre || 'AI Music';
      const state = document.createElement('span');
      state.textContent = track.available === false ? 'Chưa sẵn sàng' : '▶ Phát ngay';
      meta.append(genre, state);

      const play = () => {
        if (track.available === false) {
          if (typeof toast === 'function') toast('Bài hát hiện chưa sẵn sàng.');
          return;
        }
        if (typeof loadTrack === 'function') {
          loadTrack(index, true);
          document.getElementById('mainPlayer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      card.addEventListener('click', play);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          play();
        }
      });

      card.append(cover, title, artist, meta);
      list.appendChild(card);
    });
  }

  addCommunityStyles();
  renderCommunityUploads(true);

  document.addEventListener('ai-auth-changed', () => setTimeout(() => renderCommunityUploads(true), 150));
  setInterval(() => renderCommunityUploads(false), 1200);
})();
