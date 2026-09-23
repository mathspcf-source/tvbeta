/**
 * Camada de reprodução de vídeo (HLS via hls.js + fallback nativo).
 */

const Player = {
  video: null,
  hls: null,
  onLiveCallback: null,

  init(videoEl, onLive) {
    this.video = videoEl;
    this.onLiveCallback = onLive;

    this.video.addEventListener('playing', () => {
      if (this.onLiveCallback) this.onLiveCallback(true);
    });

    this.video.addEventListener('pause', () => {
      if (this.onLiveCallback) this.onLiveCallback(false);
    });

    this.video.addEventListener('error', () => {
      if (this.onLiveCallback) this.onLiveCallback(false);
    });
  },

  /**
   * Reproduz uma URL (já envelopada pelo proxy).
   * @param {string} url
   * @param {(msg:string)=>void} onError
   */
  play(url, onError) {
    this.stop();

    const isHls = /\.m3u8($|\?)/i.test(url) || url.includes('m3u8');

    if (isHls && window.Hls && Hls.isSupported()) {
      this._playHls(url, onError);
    } else if (isHls && this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS — HLS nativo
      this.video.src = url;
      this.video.play().catch(() => onError('Não foi possível iniciar a reprodução'));
    } else {
      // MP4, TS, etc.
      this.video.src = url;
      this.video.play().catch(() => onError('Formato não suportado ou stream indisponível'));
    }
  },

  _playHls(url, onError) {
    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });

    this.hls.loadSource(url);
    this.hls.attachMedia(this.video);

    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.video.play().catch(() => {}); // autoplay pode ser bloqueado
    });

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          onError('Erro de rede. Tentando reconectar...');
          this.hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          onError('Erro de mídia. Recuperando...');
          this.hls.recoverMediaError();
          break;
        default:
          onError('Não foi possível reproduzir este canal.');
          this.stop();
          break;
      }
    });
  },

  stop() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
  },
};
