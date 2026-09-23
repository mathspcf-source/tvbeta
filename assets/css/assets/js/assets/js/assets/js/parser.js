/**
 * Parser de arquivos M3U/M3U8 de IPTV (formato Xtream, m3u_plus).
 */

const Parser = {
  /**
   * Converte texto M3U em array de canais.
   * @param {string} text
   * @returns {Array<{name:string, logo:string, group:string, url:string}>}
   */
  parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let cur = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        cur = this._parseExtinf(line);
      } else if (line.startsWith('#')) {
        // outras tags (#EXTGRP:, #EXTVLCOPT:, ...) — ignorar por agora
        continue;
      } else {
        // linha de URL
        if (cur && cur.name) {
          cur.url = line;
          out.push(cur);
        }
        cur = null;
      }
    }

    return out;
  },

  /**
   * Parse de uma linha #EXTINF.
   */
  _parseExtinf(line) {
    const comma = line.lastIndexOf(',');
    const attrs = line.substring(8, comma);
    const name  = line.substring(comma + 1).trim() || 'Sem nome';

    return {
      name,
      logo:  this._attr(attrs, 'tvg-logo'),
      group: this._attr(attrs, 'group-title') || 'Geral',
    };
  },

  _attr(str, key) {
    const m = str.match(new RegExp(key + '="([^"]*)"', 'i'));
    return m ? m[1] : '';
  },

  /**
   * Agrupa canais por categoria.
   * @returns {Object<string, Array>}
   */
  groupByCategory(channels) {
    const groups = {};
    for (const ch of channels) {
      const g = ch.group || 'Geral';
      (groups[g] ||= []).push(ch);
    }
    return groups;
  },
};
