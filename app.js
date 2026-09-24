/* ============================================================
   LotoFácil Casino Analytics — Metro UI
   ============================================================ */

const CACHE_KEY = 'lotofacil_metro_v1';
const CACHE_EXPIRA = 24 * 60 * 60 * 1000;

let concursos = [];
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ---------- Relógio ---------- */
function atualizarRelogio() {
  const now = new Date();
  $('clock').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

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
   NAVEGAÇÃO COM TRANSIÇÃO METRO
   ============================================================ */

let telaAtual = 'home';

function navegarPara(nome) {
  if (nome === telaAtual) return;

  const atual = $('screen' + telaAtual.charAt(0).toUpperCase() + telaAtual.slice(1));
  const destino = $('screen' + nome.charAt(0).toUpperCase() + nome.slice(1));
  if (!destino) return;

  // Atualiza nav bar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === nome);
  });

  // Animação de saída
  if (atual) {
    atual.classList.add('exit');
    setTimeout(() => {
      atual.classList.remove('active', 'exit');
      destino.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
      telaAtual = nome;

      // Renderiza gráficos da tela ao entrar (lazy)
      renderTelaEspecifica(nome);
    }, 250);
  } else {
    destino.classList.add('active');
    telaAtual = nome;
    renderTelaEspecifica(nome);
  }
}

function renderTelaEspecifica(nome) {
  if (concursos.length === 0) {
    if (nome !== 'home' && nome !== 'upload') {
      // Sem dados: só renderiza o que não depende de dados
      if (nome === 'prob') renderTabelaProb();
    }
    return;
  }

  switch (nome) {
    case 'prob': renderTabelaProb(); break;
    case 'pares': renderDonut(); break;
    case 'freq': renderFreq(); break;
    case 'atraso': renderAtraso(); break;
    case 'faixas': renderFaixas(); break;
    case 'soma': renderSoma(); break;
    case 'repetidos': renderRepetidos(); break;
    case 'gerar': renderJogo(); break;
    case 'validacao': validarDados(); break;
  }
}

/* ============================================================
   EXTRAÇÃO — APENAS ARQUIVO
   ============================================================ */

async function processarArquivo(file) {
  setBadge('lendo…');
  toast('Lendo planilha…');
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const row = rows[i].map(c => String(c).toLowerCase());
      if (row.some(c => c.includes('concurso'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error('Cabeçalho não encontrado');

    const header = rows[headerIdx].map(c => String(c).toLowerCase().trim());
    const idxConcurso = header.findIndex(c => c.includes('concurso'));

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
    lista.reverse();
    concursos = lista;

    salvarCache();
    setBadge(`${concursos.length} concursos`, true);
    toast(`✓ ${concursos.length} concursos carregados`);

    // Volta para home e renderiza tudo
    navegarPara('home');
    renderTabelaProb();

  } catch (e) {
    console.error(e);
    setBadge('erro', false);
    toast(`✕ ${e.message}`);
  }
}

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
  if (concursos.length === 0) {
    el.innerHTML = '<span style="color:#a0a0a0">Carregue a planilha primeiro</span>';
    return;
  }

  if (problemas.length === 0) {
    el.innerHTML = `<span style="color:#7fba00">✓ ${concursos.length} concursos válidos</span>`;
  } else {
    el.innerHTML = `<span style="color:#d13438">⚠ ${problemas.length} problema(s):</span><br>` +
      problemas.slice(0, 12).map(p => `· ${p}`).join('<br>') +
      (problemas.length > 12 ? `<br>· +${problemas.length - 12} mais` : '');
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
   GRÁFICOS — estilo Metro
   ============================================================ */

const CORES = {
  red: '#d13438',
  green: '#107c10',
  blue: '#0078d7',
  cyan: '#00b7c3',
  purple: '#8764b8',
  orange: '#ff8c00',
  yellow: '#ffb900',
  magenta: '#e3008c',
  teal: '#008272',
  muted: '#a0a0a0',
  border: '#2b2b2b'
};

function configBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f1f1f',
        titleColor: '#ffb900',
        bodyColor: '#ffffff',
        borderColor: '#ffb900',
        borderWidth: 0,
        padding: 10,
        titleFont: { size: 11, weight: '400' },
        bodyFont: { size: 12, weight: '300' },
        displayColors: false,
        cornerRadius: 0
      }
    },
    scales: {
      x: {
        ticks: { color: CORES.muted, font: { size: 9, weight: '300' }, maxRotation: 0 },
        grid: { display: false },
        border: { color: CORES.border }
      },
      y: {
        ticks: { color: CORES.muted, font: { size: 9, weight: '300' } },
        grid: { color: CORES.border, drawBorder: false },
        border: { display: false }
      }
    }
  };
}

function renderDonut() {
  if (charts.donut) { charts.donut.destroy(); delete charts.donut; }
  const dist = calcParesImpares();
  const chaves = Object.keys(dist).map(Number).sort((a, b) => a - b);
  const labels = chaves.map(k => `${k}P · ${15 - k}I`);
  const data = chaves.map(k => dist[k]);

  const cores = chaves.map(k => {
    if (k === 7 || k === 8) return CORES.yellow;
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
        borderColor: '#000',
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
            color: '#a0a0a0',
            font: { size: 10, weight: '300' },
            padding: 10,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          backgroundColor: '#1f1f1f',
          titleColor: '#ffb900',
          bodyColor: '#fff',
          padding: 10,
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

function renderFreq() {
  if (charts.freq) { charts.freq.destroy(); delete charts.freq; }
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
          return `rgba(255, 185, 0, ${0.25 + t * 0.75})`;
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
          callbacks: { label: ctx => `${ctx.parsed.y} aparições` }
        }
      }
    }
  });
}

function renderAtraso() {
  if (charts.atraso) { charts.atraso.destroy(); delete charts.atraso; }
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
          callbacks: { label: ctx => `${ctx.parsed.y} concursos sem sair` }
        }
      }
    }
  });
}

function renderFaixas() {
  if (charts.faixa) { charts.faixa.destroy(); delete charts.faixa; }
  const medias = calcFaixas();
  const labels = ['01–05', '06–10', '11–15', '16–20', '21–25'];
  const cores = [CORES.red, CORES.orange, CORES.yellow, CORES.green, CORES.blue];

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
          callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} números/concurso` }
        }
      }
    }
  });
}

function renderSoma() {
  if (charts.soma) { charts.soma.destroy(); delete charts.soma; }
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
        x: { ...configBase().scales.x, ticks: { ...configBase().scales.x.ticks, maxTicksLimit: 8 } }
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

function renderRepetidos() {
  if (charts.rep) { charts.rep.destroy(); delete charts.rep; }
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
        backgroundColor: CORES.magenta,
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
          callbacks: { label: ctx => `${ctx.parsed.y} concursos` }
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
   GERADOR
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
  const el = $('jogoGerado');
  const info = $('jogoInfo');

  if (concursos.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#a0a0a0; font-size:.8rem; padding:20px;">Carregue a planilha primeiro</div>';
    info.textContent = '';
    return;
  }

  const jogo = gerarJogo();
  if (!jogo) {
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#a0a0a0; font-size:.8rem; padding:20px;">Não foi possível gerar</div>';
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
    $('conferirResult').innerHTML = '<span style="color:#d13438">Carregue a planilha primeiro</span>';
    return;
  }

  const nums = $('conferirInput').value.trim()
    .split(/[\s,;]+/).map(Number).filter(n => n >= 1 && n <= 25);

  if (nums.length !== 15) {
    $('conferirResult').innerHTML = '<span style="color:#d13438">Digite exatamente 15 números</span>';
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
    const cor = k >= 14 ? '#ffb900' : k >= 12 ? '#107c10' : '#a0a0a0';
    return `<div style="display:flex; justify-content:space-between; padding:4px 0;">
      <span style="color:${cor}">${k} acertos</span>
      <span><b>${dist[k]}</b> <span style="color:#a0a0a0">(${pct}%)</span></span>
    </div>`;
  }).join('');

  $('conferirResult').innerHTML = linhas;
}

/* ============================================================
   EVENTOS
   ============================================================ */

// Navegação por tiles
document.querySelectorAll('[data-screen]').forEach(el => {
  el.addEventListener('click', () => navegarPara(el.dataset.screen));
});

// Botões voltar
document.querySelectorAll('[data-back]').forEach(el => {
  el.addEventListener('click', () => navegarPara('home'));
});

// Upload
$('uploadZone').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) processarArquivo(file);
});

// Ações
$('gerarNovamente').addEventListener('click', renderJogo);
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
    toast(`✓ ${concursos.length} concursos restaurados`);
  } else {
    setBadge('aguardando');
  }
})();
