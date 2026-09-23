/**
 * Inicialização e controle da UI.
 */

(() => {
  // ===== Elementos =====
  const els = {
    video:       document.getElementById('video'),
    placeholder: document.getElementById('placeholder'),
    errorBox:    document.getElementById('errorBox'),
    list:        document.getElementById('channelList'),
    search:      document.getElementById('searchInput'),
    nowPlaying:  document.getElementById('nowPlaying'),
    liveDot:     document.getElementById('liveDot'),
    spinner:     document.getElementById('spinner'),
    statusText:  document.getElementById('statusText'),
  };

  // ===== Estado =====
  const state = {
    allChannels: [],
    filtered:    [],
    currentIdx:  -1,
  };

  // ===== Erros =====
  function showError(msg) {
    els.errorBox.textContent = '⚠️ ' + msg;
    els.errorBox.classList.add('visible');
    clearTimeout(showError._t);
    showError._t = setTimeout(() => {
      els.errorBox.classList.remove('visible');
    }, 5000);
  }

  function setLive(on) {
    els.liveDot.classList.toggle('live', on);
  }

  // ===== Render =====
  function renderList() {
    els.list.innerHTML = '';

    if (state.filtered.length === 0) {
      els.list.innerHTML = '<div class="empty">Nenhum canal encontrado</div>';
      return;
    }

    const groups = Parser.groupByCategory(state.filtered);

    Object.keys(groups).sort().forEach(groupName => {
      const header = document.createElement('div');
      header.className = 'group-title';
      header.textContent = groupName;
      els.list.appendChild(header);

      for (const ch of groups[groupName]) {
        const globalIdx = state.allChannels.indexOf(ch);

        const el = document.createElement('div');
        el.className = 'channel-item';
        el.dataset.idx = globalIdx;

        if (globalIdx === state.currentIdx) el.classList.add('active');

        const logo = ch.logo
          ? `<img class="channel-item__logo" src="${escapeAttr(ch.logo)}" onerror="this.style.display='none'">`
          : '';

        el.innerHTML = `
          ${logo}
          <span class="channel-item__name">${escapeHtml(ch.name)}</span>
        `;

        el.addEventListener('click', () => playChannel(globalIdx));
        els.list.appendChild(el);
      }
    });
  }

  // ===== Tocar canal =====
  function playChannel(idx) {
    const ch = state.allChannels[idx];
    if (!ch) return;

    state.currentIdx = idx;

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.channel-item[data-idx="${idx}"]`)?.classList.add('active');

    els.nowPlaying.textContent = ch.name;
    els.placeholder.classList.add('hidden');
    els.errorBox.classList.remove('visible');

    const url = API.proxied(ch.url);
    Player.play(url, showError);
  }

  // ===== Busca =====
  els.search.addEventListener('input', () => {
    const q = els.search.value.toLowerCase().trim();
    state.filtered = q
      ? state.allChannels.filter(ch =>
          ch.name.toLowerCase().includes(q) ||
          ch.group.toLowerCase().includes(q)
        )
      : [...state.allChannels];
    renderList();
  });

  // ===== Carregamento inicial =====
  async function loadPlaylist() {
    els.spinner.classList.remove('hidden');
    els.statusText.textContent = 'Carregando canais...';

    try {
      const text = await API.fetchPlaylist();
      state.allChannels = Parser.parseM3U(text);
      state.filtered = [...state.allChannels];

      if (state.allChannels.length === 0) {
        els.list.innerHTML = '<div class="empty">Playlist vazia ou inválida</div>';
        els.statusText.textContent = 'Nenhum canal';
        return;
      }

      els.statusText.textContent = `${state.allChannels.length} canais`;
      renderList();
    } catch (err) {
      console.error(err);
      els.list.innerHTML = `<div class="empty">Erro: ${escapeHtml(err.message)}</div>`;
      els.statusText.textContent = 'Erro';
    } finally {
      els.spinner.classList.add('hidden');
    }
  }

  // ===== Helpers =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  function escapeAttr(text) {
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== Boot =====
  Player.init(els.video, setLive);
  loadPlaylist();
})();
