/* ============================================================
   Lotofácil Casino Analytics — Nokia Lumia + Casino
   Baseado APENAS no arquivo Excel carregado pelo usuário.
   ============================================================ */

const CACHE_KEY = 'lotofacil_concursos_v5';
const CACHE_EXPIRA = 24 * 60 * 60 * 1000; // 24h

let concursos = [];
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ---------- Toast ---------- */
function toast(msg, dur = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

/* ---------- Badge ---------- */
function setBadge(text, on = false) {
  $('badgeText').textContent = text;
  $('badgeFonte').classList.toggle('on', on);
}

/* ============================================================
   EXTRAÇÃO — APENAS ARQUIVO
   ============================================================ */

async function processarArquivo(file) {
  setBadge('lendo…');
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Achar linha do cabeçalho
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const row = rows[i].map(c => String(c).toLowerCase());
      if (row.some(c => c.includes('concurso'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error('Cabeçalho não encontrado');

    const header = rows[headerIdx].map(c => String(c).toLowerCase().trim());
    const idxConcurso = header.findIndex(c => c.includes('concurso'));

    // Colunas das bolas
    const idxBolas = [];
    header.forEach((c, i) => {
      if (c.includes('bola') || c.includes('dezena') || c.includes('nº') || c.includes('num')) {
        idxBolas.push(i);
      }
    });
    if (idxBolas.length < 15) {
      idxBolas.length = 0;
      for (let i = idxConcurso + 1; i <= idxConcurso + 15; i++) idxBolas.push(i);
    }

    // Extrair concursos
    const lista = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const nums = idxBolas
        .map(j => parseInt(row[j]))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 25);
      if (nums.length === 15) {
        lista.push([...new Set(nums)].sort((a, b) => a - b));
      }
    }

    if (lista.length === 0) throw new Error('Nenhum concurso válido');

    // O arquivo vem do mais novo para o mais antigo — inverter
    lista.reverse();
    concursos = lista;

    salvarCache();
    setBadge(`${concursos.length} concursos`, true);
    renderTudo();
    toast(`✓ ${concursos.length} concursos carregados`);
  } catch (e) {
    console.error(e);
    setBadge('erro', false);
    toast(`✕ ${e.message}`);
  }
}

/* ---------- Cache ---------- */
function salvarCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      concursos
    }));
  } catch {}
}

function lerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.timestamp > CACHE_EXPIRA) return null;
    if (!obj.concursos || obj.concursos.length < 50) return null;
    return obj.concursos;
  } catch { return null; }
}

/* ============================================================
   VALIDAÇÃO
   ============================================================ */

function validarDados() {
  const problemas = [];
  const vistos = new Set();

  concursos.forEach((c, i) => {
    if (c.length !== 15) problemas.push(`#${i + 1}: ${c.length} números`);
    const unicos = new Set(c);
    if (unicos.size !== c.length) problemas.push(`#${i + 1}: números repetidos`);
    const chave = c.join('-');
    if (vistos.has(chave)) problemas.push(`#${i + 1}: duplicado`);
    else vistos.add(chave);
  });

  const el = $('validacao');
  const tile = $('tileValidacao');
  tile.classList.remove('hidden');

  if (problemas.length === 0) {
    el.innerHTML = `<span style="color:var(--green)">✓ ${concursos.length} concursos válidos</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--red)">⚠ ${problemas.length} problema(s):</span><br>` +
      problemas.slice(0, 8).map(p => `· ${p}`).join('<br>') +
      (problemas.length > 8 ? `<br>· +${problemas.length - 8} mais` : '');
  }
}

/* ============================================================
   HIPERGEOMÉTRICA
   ============================================================ */

function combinacao(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}

function hipergeometrica(k) {
  // N=25, K=15 (escolhidos), n=15 (sorteados)
  return combinacao(15, k) * combinacao(10, 15 - k) / combinacao(25, 15);
}

function renderTabelaProb() {
  const tbody = $('tabelaProb').querySelector('tbody');
  const linhas = [];
  for (let k = 15; k >= 11; k--) {
    const prob = hipergeometrica(k);
    const umEm = Math.round(1 / prob);
    linhas.push(`
      <tr>
        <td class="pts">${k}</td>
        <td class="val">1 em ${umEm.toLocaleString('pt-BR')}</td>
        <td class="custo">R$ 3,50</td>
      </tr>
    `);
  }
  tbody.innerHTML = linhas.join('');
}

/* ============================================================
   CÁLCULOS
   ============================================================ */

function calcFrequencia() {
  const freq = Array(26).fill(0);
  concursos.forEach(c => c.forEach(n => freq[n]++));
  return freq;
}

function calcAtraso() {
  const atraso = Array(26).fill(0);
  for (let n = 1; n <= 25; n++) {
    for (let i = concursos.length - 1; i >= 0; i--) {
      if (concursos[i].includes(n)) break;
      atraso[n]++;
    }
  }
  return atraso;
}

function calcParesImpares() {
  const dist = {};
  concursos.forEach(c => {
    const p = c.filter(n => n % 2 === 0).length;
    dist[p] = (dist[p] || 0) + 1;
  });
  return dist;
}

function calcFaixas() {
  const faixas = [0, 0, 0, 0, 0];
  concursos.forEach(c => {
    c.forEach(n => { faixas[Math.floor((n - 1) / 5)]++; });
  });
  return faixas.map(v => v / concursos.length);
}

function calcSomas() {
  return concursos.map(c => c.reduce((a, b) => a + b, 0));
}

function calcRepetidos() {
  const rep = [];
  for (let i = 1; i < concursos.length; i++) {
    const ant = new Set(concursos[i - 1]);
    rep.push(concursos[i].filter(n => ant.has(n)).length);
  }
  return rep;
}

function histograma(valores, min, max) {
  const bins = Array(max - min + 1).fill(0);
  valores.forEach(v => { if (v >= min && v <= max) bins[v - min]++; });
  return bins;
}

/* ============================================================
   GRÁFICOS — Estilo Lumia (limpo, flat)
   ============================================================ */

const CORES = {
  gold: '#d4af37',
  green: '#2ecc71',
  red: '#e63946',
  blue: '#3498db',
  purple: '#9b59b6',
  orange: '#e67e22',
  cyan: '#1abc9c',
  muted: '#8a8a8a',
  border: '#2a2a2a'
};

const corVar = nome => getComputedStyle(document.body).getPropertyValue(nome).trim();

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function configBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0a0a',
        titleColor: '#d4af37',
        bodyColor: '#ffffff',
        borderColor: '#d4af37',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 11, weight: '400' },
        bodyFont: { size: 12, weight: '300' },
        displayColors: false,
        cornerRadius: 0
      }
    },
    scales: {
      x: {
        ticks: {
          color: CORES.muted,
          font: { size: 9, weight: '300' },
          maxRotation: 0
        },
        grid: { display: false },
        border: { color: CORES.border }
      },
      y: {
        ticks: {
          color: CORES.muted,
          font: { size: 9, weight: '300' }
        },
        grid: { color: CORES.border, drawBorder: false },
        border: { display: false }
      }
    }
  };
}

/* ---------- Donut ---------- */
function renderDonut() {
  destroyChart('donut');
  const dist = calcParesImpares();
  const chaves = Object.keys(dist).map(Number).sort((a, b) => a - b);
  const labels = chaves.map(k => `${k}P · ${15 - k}I`);
  const data = chaves.map(k => dist[k]);

  // Cores estilo Lumia: quentes para extremos, frias para o centro
  const cores = chaves.map(k => {
    if (k === 7 || k === 8) return CORES.gold;
    if (k === 6 || k === 9) return CORES.blue;
    if (k === 5 || k === 10) return CORES.purple;
    return CORES.red;
  });

  charts.donut = new Chart($('donutPares'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: cores,
        borderColor: '#0a0a0a',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8a8a8a',
            font: { size: 10, weight: '300' },
            padding: 12,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          backgroundColor: '#0a0a0a',
          titleColor: '#d4af37',
          bodyColor: '#ffffff',
          borderColor: '#d4af37',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          cornerRadius: 0,
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = (ctx.parsed / total * 100).toFixed(1);
              return `${ctx.label} — ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ---------- Frequência ---------- */
function renderFreq() {
  destroyChart('freq');
  const freq = calcFrequencia();
  const labels = Array.from({ length: 25 }, (_, i) => pad(i + 1));
  const data = freq.slice(1);
  const max = Math.max(...data);
  const min = Math.min(...data);

  charts.freq = new Chart($('chartFreq'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v => {
          const t = (v - min) / (max - min || 1);
          // Gradiente de opacidade do gold
          return `rgba(212, 175, 55, ${0.25 + t * 0.75})`;
        }),
        borderWidth: 0,
        barPercentage: 0.85,
        categoryPercentage: 0.9
      }]
    },
    options: {
      ...configBase(),
      plugins: {
        ...configBase().plugins,
        tooltip: {
          ...configBase().plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.parsed.y} aparições`
          }
        }
      }
    }
  });
}

/* ---------- Atraso ---------- */
function renderAtraso() {
  destroyChart('atraso');
  const atraso = calcAtraso();
  const labels = Array.from({ length: 25 }, (_, i) => pad(i + 1));
  const data = atraso.slice(1);

  charts.atraso = new Chart($('chartAtraso'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v => v === 0 ? CORES.green : v > 8 ? CORES.red : CORES.blue),
        borderWidth: 0,
        barPercentage: 0.85,
        categoryPercentage: 0.9
      }]
    },
    options: {
      ...configBase(),
      plugins: {
        ...configBase().plugins,
        tooltip: {
          ...configBase().plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.parsed.y} concursos sem sair`
          }
        }
      }
    }
  });
}

/* ---------- Faixas ---------- */
function renderFaixas() {
  destroyChart('faixa');
  const medias = calcFaixas();
  const labels = ['01–05', '06–10', '11–15', '16–20', '21–25'];
  const cores = [CORES.red, CORES.orange, CORES.gold, CORES.green, CORES.blue];

  charts.faixa = new Chart($('chartFaixa'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: medias,
        backgroundColor: cores,
        borderWidth: 0,
        barPercentage: 0.8,
        categoryPercentage: 0.85
      }]
    },
    options: {
      ...configBase(),
      plugins: {
        ...configBase().plugins,
        tooltip: {
          ...configBase().plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.parsed.y.toFixed(2)} números/concurso`
          }
        }
      }
    }
  });
}

/* ---------- Soma ---------- */
function renderSoma() {
  destroyChart('soma');
  const somas = calcSomas();
  const media = somas.reduce((a, b) => a + b, 0) / somas.length;
  const desvio = Math.sqrt(somas.reduce((a, b) => a + (b - media) ** 2, 0) / somas.length);
  const min = Math.floor(media - 3 * desvio);
  const max = Math.ceil(media + 3 * desvio);
  const bins = histograma(somas, min, max);
  const labels = bins.map((_, i) => min + i);

  charts.soma = new Chart($('chartSoma'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: bins,
        backgroundColor: CORES.blue,
        borderWidth: 0,
        barPercentage: 0.95,
        categoryPercentage: 1
      }]
    },
    options: {
      ...configBase(),
      plugins: {
        ...configBase().plugins,
        tooltip: {
          ...configBase().plugins.tooltip,
          callbacks: {
            title: ctx => `Soma ${ctx[0].label}`,
            label: ctx => `${ctx.parsed.y} concursos`
          }
        }
      },
      scales: {
        ...configBase().scales,
        x: {
          ...configBase().scales.x,
          ticks: { ...configBase().scales.x.ticks, maxTicksLimit: 8 }
        }
      }
    }
  });

  $('somaStats').innerHTML = `
    <div class="stat"><div class="l">Média</div><div class="v">${media.toFixed(0)}</div></div>
    <div class="stat"><div class="l">Desvio</div><div class="v">${desvio.toFixed(0)}</div></div>
    <div class="stat"><div class="l">Mín</div><div class="v">${Math.min(...somas)}</div></div>
    <div class="stat"><div class="l">Máx</div><div class="v">${Math.max(...somas)}</div></div>
  `;
}

/* ---------- Repetidos ---------- */
function renderRepetidos() {
  destroyChart('rep');
  const rep = calcRepetidos();
  if (rep.length === 0) return;
  const media = rep.reduce((a, b) => a + b, 0) / rep.length;
  const bins = histograma(rep, 5, 15);
  const labels = bins.map((_, i) => 5 + i);

  charts.rep = new Chart($('chartRepetidos'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: bins,
        backgroundColor: CORES.purple,
        borderWidth: 0,
        barPercentage: 0.85,
        categoryPercentage: 0.9
      }]
    },
    options: {
      ...configBase(),
      plugins: {
        ...configBase().plugins,
        tooltip: {
          ...configBase().plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.parsed.y} concursos`
          }
        }
      }
    }
  });

  $('repStats').innerHTML = `
    <div class="stat"><div class="l">Média</div><div class="v">${media.toFixed(1)}</div></div>
    <div class="stat"><div class="l">Mín</div><div class="v">${Math.min(...rep)}</div></div>
    <div class="stat"><div class="l">Máx</div><div class="v">${Math.max(...rep)}</div></div>
  `;
}

/* ============================================================
   GERADOR COM FILTROS PROBABILÍSTICOS
   ============================================================ */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function temSequenciaLonga(jogo, maxSeq = 4) {
  let seq = 1;
  for (let i = 1; i < jogo.length; i++) {
    if (jogo[i] === jogo[i - 1] + 1) {
      seq++;
      if (seq > maxSeq) return true;
    } else seq = 1;
  }
  return false;
}

function gerarJogo() {
  if (concursos.length === 0) return null;

  const ultimo = concursos[concursos.length - 1];
  const somas = calcSomas();
  const mediaSoma = somas.reduce((a, b) => a + b, 0) / somas.length;
  const desvioSoma = Math.sqrt(somas.reduce((a, b) => a + (b - mediaSoma) ** 2, 0) / somas.length);

  let tentativas = 0;
  while (tentativas++ < 20000) {
    const pares = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    const impares = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
    shuffle(pares); shuffle(impares);

    const qtdPares = Math.random() < 0.5 ? 8 : 7;
    const jogo = [...pares.slice(0, qtdPares), ...impares.slice(0, 15 - qtdPares)]
      .sort((a, b) => a - b);

    const soma = jogo.reduce((a, b) => a + b, 0);
    if (soma < mediaSoma - desvioSoma || soma > mediaSoma + desvioSoma) continue;

    const repetidos = jogo.filter(n => ultimo.includes(n)).length;
    if (repetidos < 7 || repetidos > 11) continue;

    const faixas = [0, 0, 0, 0, 0];
    jogo.forEach(n => faixas[Math.floor((n - 1) / 5)]++);
    if (faixas.some(f => f < 1)) continue;

    if (temSequenciaLonga(jogo, 4)) continue;

    return jogo;
  }
  return null;
}

function renderJogo() {
  const jogo = gerarJogo();
  const el = $('jogoGerado');
  const info = $('jogoInfo');

  if (!jogo) {
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--muted); font-size:.8rem; padding:20px;">Carregue a planilha para gerar</div>';
    info.textContent = '';
    return;
  }

  el.innerHTML = jogo.map((n, i) =>
    `<div class="bola" style="animation-delay:${i * 30}ms">${pad(n)}</div>`
  ).join('');

  const soma = jogo.reduce((a, b) => a + b, 0);
  const repetidos = jogo.filter(n => concursos[concursos.length - 1].includes(n)).length;
  const pares = jogo.filter(n => n % 2 === 0).length;

  info.innerHTML = `Soma <b>${soma}</b> · Repetidos <b>${repetidos}</b> · Pares <b>${pares}</b> · Ímpares <b>${15 - pares}</b>`;
}

/* ============================================================
   CONFERIDOR
   ============================================================ */

function conferir() {
  if (concursos.length === 0) {
    $('conferirResult').innerHTML = '<span style="color:var(--red)">Carregue a planilha primeiro</span>';
    return;
  }

  const nums = $('conferirInput').value.trim()
    .split(/[\s,;]+/).map(Number).filter(n => n >= 1 && n <= 25);

  if (nums.length !== 15) {
    $('conferirResult').innerHTML = '<span style="color:var(--red)">Digite exatamente 15 números</span>';
    return;
  }

  const set = new Set(nums);
  const dist = {};
  concursos.forEach(c => {
    const acertos = c.filter(n => set.has(n)).length;
    dist[acertos] = (dist[acertos] || 0) + 1;
  });

  const linhas = Object.keys(dist).sort((a, b) => b - a).map(k => {
    const pct = (dist[k] / concursos.length * 100).toFixed(1);
    const cor = k >= 14 ? 'var(--gold)' : k >= 12 ? 'var(--green)' : 'var(--muted)';
    return `<div style="display:flex; justify-content:space-between; padding:4px 0;">
      <span style="color:${cor}">${k} acertos</span>
      <span><b>${dist[k]}</b> <span style="color:var(--muted)">(${pct}%)</span></span>
    </div>`;
  }).join('');

  $('conferirResult').innerHTML = linhas;
}

/* ============================================================
   RENDER GERAL
   ============================================================ */

function renderTudo() {
  validarDados();
  renderDonut();
  renderFreq();
  renderAtraso();
  renderFaixas();
  renderSoma();
  renderRepetidos();
  renderJogo();
}

/* ============================================================
   EVENTOS
   ============================================================ */

$('uploadZone').addEventListener('click', () => $('fileInput').click());

$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) processarArquivo(file);
});

$('fabGerar').addEventListener('click', renderJogo);
$('conferirBtn').addEventListener('click', conferir);
$('limparBtn').addEventListener('click', () => {
  $('conferirInput').value = '';
  $('conferirResult').innerHTML = '';
});

/* ============================================================
   INÍCIO
   ============================================================ */

(function init() {
  renderTabelaProb();

  const cache = lerCache();
  if (cache) {
    concursos = cache;
    setBadge(`${concursos.length} concursos`, true);
    renderTudo();
    toast('✓ Dados restaurados');
  } else {
    setBadge('aguardando arquivo');
  }
})();
