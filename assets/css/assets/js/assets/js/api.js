/**
 * Camada de comunicação com o backend (Supabase Edge Functions).
 */

const API = {
  /**
   * Baixa o conteúdo M3U da playlist.
   * @returns {Promise<string>} texto bruto do M3U
   */
  async fetchPlaylist() {
    if (CONFIG.USE_MOCK) {
      await new Promise(r => setTimeout(r, 300));
      return CONFIG.MOCK_M3U;
    }

    const res = await fetch(CONFIG.PLAYLIST_ENDPOINT);
    if (!res.ok) {
      throw new Error(`Playlist: HTTP ${res.status}`);
    }
    return res.text();
  },

  /**
   * Envolve uma URL de stream com o proxy do Supabase
   * (contorna CORS e adiciona User-Agent de player).
   */
  proxied(url) {
    if (CONFIG.USE_MOCK) return url; // mock vai direto
    return CONFIG.PROXY_ENDPOINT + '?url=' + encodeURIComponent(url);
  },
};
