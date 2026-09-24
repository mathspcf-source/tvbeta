/* ============================================================
   Lotofácil Analytics — Sistema Probabilístico
   ============================================================ */

const API_BASE = 'https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil';
const CACHE_KEY = 'lotofacil_concursos_v3';
const CACHE_EXPIRA = 6 * 60 * 60 * 1000;

let concursos = [];
let fonteAtual = 'none';
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ============================================================
   1. EXTRAÇÃO DE DADOS — 3 FONTES
   ============================================================ */

async function processarArquivo(file) {
  $('status').innerHTML = '<span class="loading"></span>Lendo arquivo…';
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i].map(c => String(c).toLowerCase());
      if (row.some(c => c.includes('concurso'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error('Cabeçalho "Concurso" não encontrado');

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
        lista.push([...new Set(nums)].sort((a,b)=>a-b));
      }
    }

    if (lista.length === 0) throw new Error('Nenhum concurso válido encontrado');
    lista.reverse();
    concursos = lista;
    fonteAtual = 'arquivo';
    atualizarBadge();
    $('status').textContent = `✅ ${concursos.length} concursos carregados do arquivo`;
    renderTudo();
  } catch (e) {
    console.error(e);
    $('status').textContent = `❌ Erro ao ler arquivo: ${e.message}`;
  }
}

function parseLinha(line) {
  const nums = line.trim().split(/[\s,;]+/).map(Number).filter(n => n >= 1 && n <= 25);
  return nums.length === 15 ? [...new Set(nums)].sort((a,b)=>a-b) : null;
}

function processarTexto() {
  const txt = $('dataInput').value;
  const lista = txt.split('\n').map(parseLinha).filter(Boolean);
  if (lista.length === 0) {
    $('status').textContent = '⚠️ Nenhum concurso válido no texto.';
    return;
  }
  concursos = lista.reverse();
  fonteAtual = 'manual';
  atualizarBadge();
  $('status').textContent = `✅ ${concursos.length} concursos carregados manualmente`;
  renderTudo();
}

async function carregarAPI() {
  $('status').innerHTML = '<span class="loading"></span>Conectando à API…';
  try {
    const res = await fetch(`${API_BASE}/_todos.json`);
    if (!res.ok) throw new Error('API indisponível');
    const data = await res.json();
    const lista = Array.isArray(data) ? data : Object.values(data);
    const formatados = lista
      .map(c => {
        const dezenas = c.listaDezenas || c.dezenas || c.numeros;
        return Array.isArray(dezenas) && dezenas.length === 15
          ? dezenas.map(Number).sort((a,b)=>a-b)
          : null;
      })
      .filter(Boolean);

    if (formatados.length < 100) throw new Error('Dados insuficientes');
    concursos = formatados;
    fonteAtual = 'api';
    atualizarBadge();
    $('status').textContent = `✅ ${concursos.length} concursos carregados da API`;
    renderTudo();
  } catch (e) {
    console.error(e);
    $('status').textContent = `❌ Falha na API: ${e.message}. Use arquivo ou manual.`;
  }
}

function atualizarBadge() {
  const b = $('badgeFonte');
  b.className = 'badge on';
  b.textContent = `${concursos.length} concursos · ${fonteAtual}`;
}

/* ============================================================
   2. VALIDAÇÃO DE INTEGRIDADE
   ============================================================ */

function validarDados() {
  const problemas = [];
  const vistos = new Set();

  concursos.forEach((c, i) => {
    // Números fora do intervalo
    const fora = c.filter(n => n < 1 || n > 25);
    if (fora.length > 0) problemas.push(`Concurso ${i+1}: números fora do intervalo 1–25: ${fora.join(', ')}`);

    // Quantidade errada
    if (c.length !== 15) problemas.push(`Concurso ${i+1}: ${c.length} números (esperado 15)`);

    // Números repetidos dentro do concurso
    const unicos = new Set(c);
    if (unicos.size !== c.length) problemas.push(`Concurso ${i+1}: números repetidos dentro do próprio sorteio`);

    // Duplicidade entre concursos
    const chave = c.join('-');
    if (vistos.has(chave)) {
      problemas.push(`Concurso ${i+1}: mesmos 15 números de um concurso anterior`);
    } else {
      vistos.add(chave);
    }
  });

  const el = $('validacao');
  if (problemas.length === 0) {
    el.innerHTML = `<span style="color:var(--green)">✅ Nenhum problema encontrado em ${concursos.length} concursos.</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--red)">⚠️ ${problemas.length} problema(s) encontrado(s):</span><br>` +
      problemas.slice(0, 20).map(p => `• ${p}`).join('<br>') +
      (problemas.length > 20 ? `<br>... e mais ${problemas.length - 20}` : '');
  }
}

/* ============================================================
   3. DISTRIBUIÇÃO HIPERGEOMÉTRICA
   ============================================================ */

function combinacao(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = result * (n - k + i) / i;
  }
  return result;
}

function hipergeometrica(k, N, K, n) {
  // k = acertos desejados
  // N = população total (25)
  // K = números escolhidos (15)
  // n = números sorteados (15)
  return combinacao(K, k) * combinacao(N - K, n - k) / combinacao(N, n);
}

function renderTabelaProb() {
  const N = 25, K = 15, n = 15;
  const tbody = $('tabelaProb').querySelector('tbody');
  const linhas = [];
  for (let k = 11; k <= 15; k++) {
    const prob = hipergeometrica(k, N, K, n);
    const umEm = Math.round(1 / prob);
    linhas.push(`
      <tr>
        <td><b>${k} acertos</b></td>
        <td class="val">1 em ${umEm.toLocaleString('pt-BR')}</td>
        <td class="custo">R$ 3,50</td>
      </tr>
    `);
  }
  tbody.innerHTML = linhas.join('');
}

/* ============================================================
   4. CÁLCULOS ESTATÍSTICOS
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
  const faixas = [0,0,0,0,0];
  concursos.forEach(c => {
    c.forEach(n => { faixas[Math.floor((n-1)/5)]++; });
  });
  return faixas.map(v => v / concursos.length);
}

function calcSomas() {
  return concursos.map(c => c.reduce((a,b)=>a+b, 0));
}

function calcRepetidos() {
  const rep = [];
  for (let i = 1; i < concursos.length; i++) {
    const ant = new Set(concursos[i-1]);
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
   5. GRÁFICOS
   ============================================================ */

const corVar = nome => getComputedStyle(document.body).getPropertyValue(nome).trim();

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function renderDonut() {
  destroyChart('donut');
  const dist = calcParesImpares();
  const chaves = Object.keys(dist).map(Number).sort((a,b)=>a-b);
  const labels = chaves.map(k => `${k}P × ${15-k}I`);
  const data = chaves.map(k => dist[k]);
  const cores = ['#f87171','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa','#f472b6','#22d3ee'];

  charts.donut = new Chart($('donutPares'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: cores.slice(0, chaves.length),
        borderColor: corVar('--card'),
        borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: corVar('--text'), font:{size:11} } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
              const pct = (ctx.parsed / total * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const ordenado = Object.entries(dist).sort((a,b)=>b[1]-a[1]).slice(0,3);
  $('donutLegend').innerHTML = ordenado.map(([k,v], i) =>
    `<span style="color:${corVar('--text')}"><span style="background:${cores[i]}"></span>${k}P×${15-k}I: <b>${(v/concursos.length*100).toFixed(1)}%</b></span>`
  ).join('');
}

function renderFreq() {
  destroyChart('freq');
  const freq = calcFrequencia();
  const labels = Array.from({length:25}, (_,i)=>pad(i+1));
  const data = freq.slice(1);

  charts.freq = new Chart($('chartFreq'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Aparições',
        data,
        backgroundColor: data.map(v => {
          const max = Math.max(...data), min = Math.min(...data);
          const t = (v - min) / (max - min || 1);
          return `rgba(250, 204, 21, ${0.35 + t*0.65})`;
        }),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} aparições` } }
      },
      scales: {
        x: { ticks: { color: corVar('--muted'), font:{size:10} }, grid:{display:false} },
        y: { ticks: { color: corVar('--muted'), font:{size:10} }, grid:{color:corVar('--border')} }
      }
    }
  });
}

function renderAtraso() {
  destroyChart('atraso');
  const atraso = calcAtraso();
  const labels = Array.from({length:25}, (_,i)=>pad(i+1));
  const data = atraso.slice(1);

  charts.atraso = new Chart($('chartAtraso'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Concursos sem sair',
        data,
        backgroundColor: data.map(v => v === 0 ? '#4ade80' : v > 8 ? '#f87171' : '#38bdf8'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} concursos sem sair` } }
      },
      scales: {
        x: { ticks: { color: corVar('--muted'), font:{size:10} }, grid:{display:false} },
        y: { ticks: { color: corVar('--muted'), font:{size:10} }, grid:{color:corVar('--border')} }
      }
    }
  });
}

function renderFaixas() {
  destroyChart('faixa');
  const medias = calcFaixas();
  const labels = ['01–05','06–10','11–15','16–20','21–25'];

  charts.faixa = new Chart($('chartFaixa'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Média de números por concurso',
        data: medias,
        backgroundColor: ['#f87171','#fb923c','#facc15','#4ade80','#38bdf8'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} números/concurso` } }
      },
      scales: {
        x: { ticks: { color: corVar('--muted') }, grid:{display:false} },
        y: { ticks: { color: corVar('--muted') }, grid:{color:corVar('--border')} }
      }
    }
  });
}

function renderSoma() {
  destroyChart('soma');
  const somas = calcSomas();
  const media = somas.reduce((a,b)=>a+b,0) / somas.length;
  const desvio = Math.sqrt(somas.reduce((a,b)=>a+(b-media)**2,0)/somas.length);
  const min = Math.floor(media - 3*desvio), max = Math.ceil(media + 3*desvio);
  const bins = histograma(somas, min, max);
  const labels = bins.map((_,i)=>min+i);

  charts.soma = new Chart($('chartSoma'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frequência',
        data: bins,
        backgroundColor: '#38bdf8',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: corVar('--muted'), maxTicksLimit: 12 }, grid:{display:false} },
        y: { ticks: { color: corVar('--muted') }, grid:{color:corVar('--border')} }
      }
    }
  });

  $('somaStats').innerHTML = `
    <div class="stat"><div class="l">Média</div><div class="v">${media.toFixed(1)}</div></div>
    <div class="stat"><div class="l">Desvio</div><div class="v">${desvio.toFixed(1)}</div></div>
    <div class="stat"><div class="l">Mín</div><div class="v">${Math.min(...somas)}</div></div>
    <div class="stat"><div class="l">Máx</div><div class="v">${Math.max(...somas)}</div></div>
  `;
}

function renderRepetidos() {
  destroyChart('rep');
  const rep = calcRepetidos();
  if (rep.length === 0) return;
  const media = rep.reduce((a,b)=>a+b,0)/rep.length;
  const bins = histograma(rep, 5, 15);
  const labels = bins.map((_,i)=>5+i);

  charts.rep = new Chart($('chartRepetidos'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frequência',
        data: bins,
        backgroundColor: '#a78bfa',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: corVar('--muted') }, grid:{display:false} },
        y: { ticks: { color: corVar('--muted') }, grid:{color:corVar('--border')} }
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
   6. GERADOR COM FILTROS PROBABILÍSTICOS
   ============================================================ */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function temSequenciaLonga(jogo, maxSeq = 4) {
  let seq = 1;
  for (let i = 1; i < jogo.length; i++) {
    if (jogo[i] === jogo[i-1] + 1) {
      seq++;
      if (seq > maxSeq) return true;
    } else {
      seq = 1;
    }
  }
  return false;
}

function gerarJogoComFiltros(usarFiltros) {
  if (concursos.length === 0) return null;

  const ultimo = concursos[concursos.length - 1];
  const somas = calcSomas();
  const mediaSoma = somas.reduce((a,b)=>a+b,0) / somas.length;
  const desvioSoma = Math.sqrt(somas.reduce((a,b)=>a+(b-mediaSoma)**2,0)/somas.length);

  let tentativas = 0;
  while (tentativas++ < 20000) {
    // 1. Escolher 8 pares + 7 ímpares (ou 7 + 8)
    const pares = [2,4,6,8,10,12,14,16,18,20,22,24];
    const impares = [1,3,5,7,9,11,13,15,17,19,21,23,25];
    shuffle(pares); shuffle(impares);
    const qtdPares = Math.random() < 0.5 ? 8 : 7;
    const jogo = [...pares.slice(0, qtdPares), ...impares.slice(0, 15 - qtdPares)].sort((a,b)=>a-b);

    if (!usarFiltros) return jogo;

    // 2. Soma dentro de 1 desvio-padrão
    const soma = jogo.reduce((a,b)=>a+b,0);
    if (soma < mediaSoma - desvioSoma || soma > mediaSoma + desvioSoma) continue;

    // 3. Repetidos do último concurso entre 7 e 11
    const repetidos = jogo.filter(n => ultimo.includes(n)).length;
    if (repetidos < 7 || repetidos > 11) continue;

    // 4. Ao menos 1 número por faixa
    const faixas = [0,0,0,0,0];
    jogo.forEach(n => faixas[Math.floor((n-1)/5)]++);
    if (faixas.some(f => f < 1)) continue;

    // 5. Sem sequências longas
    if (temSequenciaLonga(jogo, 4)) continue;

    return jogo;
  }
  return null;
}

function renderJogo() {
  const usarFiltros = $('chkFiltros').checked;
  const jogo = gerarJogoComFiltros(usarFiltros);
  const el = $('jogoGerado');
  const info = $('jogoInfo');
  if (!jogo) {
    el.innerHTML = '<span style="color:var(--muted)">Não foi possível gerar com os filtros. Tente novamente.</span>';
    info.textContent = '';
    return;
  }
  el.innerHTML = jogo.map(n => `<div class="bola">${pad(n)}</div>`).join('');
  const soma = jogo.reduce((a,b)=>a+b,0);
  const repetidos = jogo.filter(n => concursos[concursos.length-1].includes(n)).length;
  const pares = jogo.filter(n => n % 2 === 0).length;
  info.innerHTML = `Soma: <b>${soma}</b> · Repetidos: <b>${repetidos}</b> · Pares: <b>${pares}</b> · Ímpares: <b>${15-pares}</b>`;
}

function renderJogosMultiplos() {
  const usarFiltros = $('chkFiltros').checked;
  const el = $('jogosMultiplos');
  const jogos = [];
  for (let i = 0; i < 5; i++) {
    const j = gerarJogoComFiltros(usarFiltros);
    if (j) jogos.push(j);
  }
  if (jogos.length === 0) {
    el.innerHTML = '<span style="color:var(--muted)">Não foi possível gerar.</span>';
    return;
  }
  el.innerHTML = jogos.map((j, i) => {
    const soma = j.reduce((a,b)=>a+b,0);
    const rep = j.filter(n => concursos[concursos.length-1].includes(n)).length;
    return `
      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
        <div style="font-size:.8rem; color:var(--muted); margin-bottom:6px;">
          Jogo ${i+1} · Soma: ${soma} · Repetidos: ${rep}
        </div>
        <div class="jogo">${j.map(n => `<div class="bola">${pad(n)}</div>`).join('')}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   7. CONFERIDOR
   ============================================================ */

function conferir() {
  if (concursos.length === 0) {
    $('conferirResult').innerHTML = '<span style="color:var(--red)">Carregue dados primeiro.</span>';
    return;
  }
  const nums = $('conferirInput').value.trim().split(/[\s,;]+/).map(Number).filter(n=>n>=1&&n<=25);
  if (nums.length !== 15) {
    $('conferirResult').innerHTML = '<span style="color:var(--red)">Digite exatamente 15 números.</span>';
    return;
  }
  const set = new Set(nums);
  const dist = {};
  concursos.forEach(c => {
    const acertos = c.filter(n => set.has(n)).length;
    dist[acertos] = (dist[acertos] || 0) + 1;
  });
  const linhas = Object.keys(dist).sort((a,b)=>b-a).map(k =>
    `<div>${k} acertos: <b>${dist[k]}</b> concursos (${(dist[k]/concursos.length*100).toFixed(1)}%)</div>`
  ).join('');
  $('conferirResult').innerHTML = linhas;
}

/* ============================================================
   8. RENDER GERAL
   ============================================================ */

function renderTudo() {
  validarDados();
  renderTabelaProb();
  renderDonut();
  renderFreq();
  renderAtraso();
  renderFaixas();
  renderSoma();
  renderRepetidos();
  renderJogo();
}

/* ============================================================
   9. EVENTOS
   ============================================================ */

$('processBtn').addEventListener('click', processarTexto);
$('limparBtn').addEventListener('click', () => {
  $('dataInput').value = '';
  $('status').textContent = 'Aguardando dados…';
});
$('apiBtn').addEventListener('click', carregarAPI);
$('gerarBtn').addEventListener('click', renderJogo);
$('gerarMultiplosBtn').addEventListener('click', renderJogosMultiplos);
$('conferirBtn').addEventListener('click', conferir);

$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) processarArquivo(file);
});

$('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  if (concursos.length) renderTudo();
});

/* ============================================================
   10. INÍCIO
   ============================================================ */

(function init() {
  renderTabelaProb();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Date.now() - obj.timestamp < CACHE_EXPIRA && obj.concursos?.length > 100) {
        concursos = obj.concursos;
        fonteAtual = 'cache';
        atualizarBadge();
        $('status').textContent = `✅ ${concursos.length} concursos carregados do cache`;
        renderTudo();
        return;
      }
    }
  } catch {}
  $('status').textContent = 'Carregue um arquivo, cole os números ou clique em 📡 API.';
})();
