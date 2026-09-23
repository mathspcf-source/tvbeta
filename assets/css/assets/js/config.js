/**
 * Configurações globais do player.
 * Ajuste aqui sem mexer no resto do código.
 */
const CONFIG = {
  // Supabase (será usado nas próximas fases)
  SUPABASE_URL: 'https://xemkgbrkafhemrcqveve.supabase.co',
  EDGE_PLAYLIST: '/functions/v1/playlist',
  EDGE_PROXY:    '/functions/v1/proxy',

  // Modo de desenvolvimento: se true, usa uma playlist de exemplo
  // para testar o player antes do backend estar pronto.
  USE_MOCK: true,
  MOCK_M3U: `
#EXTM3U
#EXTINF:-1 tvg-logo="https://i.imgur.com/8Q5k6nK.png" group-title="Testes",Mux Test Stream
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Testes",Big Buck Bunny
https://test-streams.mux.dev/pts_shift/master.m3u8
  `.trim(),
};

// Helpers derivados
CONFIG.PLAYLIST_ENDPOINT = CONFIG.SUPABASE_URL + CONFIG.EDGE_PLAYLIST;
CONFIG.PROXY_ENDPOINT    = CONFIG.SUPABASE_URL + CONFIG.EDGE_PROXY;
