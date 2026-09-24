/* ============================================================
   Lotofácil Analytics — consumo da API free-apiloterias
   ============================================================ */

const API_BASE = 'https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil';

let concursos = [];
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ---------- Extração de dados da API ---------- */
async function buscarConcursoEspecifico(num) {
  const res = await fetch(`${API_BASE}/${num}.json`);
  if (!res.ok) throw new Error(`Concurso ${num} não encontrado`);
  return res.json();
}

async function buscarUltimoConcurso() {
  const res = await fetch(`${API_BASE}/_ultimo.json`);
  if (!res.ok) throw new Error('Falha ao buscar último concurso');
  return res.json();
}

async function buscarTodosConcursos() {
  // Estratégia: pega o último concurso, depois baixa em lotes paralelos
  const ultimo = await buscarUltimoConcurso();
  const numeroUltimo = ultimo.numero || ultimo.concurso || ultimo.numeroConcurso;
  if (!numeroUltimo) throw new Error('Não foi possível determinar o número do último concurso');

  $('status').innerHTML = `<span class="loading"></span>Baixando ${numeroUltimo} concursos da API…`;

  const concursosBaixados = [];
  const LOTE = 50;

  // Baixa em lotes paralelos para não sobrecarregar
  for (let inicio = 1; inicio <= numeroUltimo; inicio += LOTE) {
    const fim = Math.min(inicio + LOTE - 1, numeroUltimo);
    const promessas = [];
    for (let n = inicio; n <= fim; n++) {
      promessas.push(
        fetch(`${API_BASE}/${n}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      );
    }
    const resultados = await Promise.all(promessas);
    resultados.forEach(r => {
      if (!r) return;
      const dezenas = r.listaDezenas || r.dezenas || r.numeros;
      if (Array.isArray(dezenas) && dezenas.length === 15) {
        concursosBaixados.push(dezenas.map(Number).sort((a,b)=>a-b));
      }
    });
    $('status').innerHTML = `<span class="loading"></span>Baixados ${concursosBaixados.length} de ${numeroUltimo}…`;
  }

  // Ordena pelo número do concurso (assumindo que a ordem de download foi sequencial)
  return concursosBaixados;
}

/* ---------- Fallback: dados simulados ---------- */
function gerarDadosDemo(qtd = 500) {
  const lista = [];
  for (let i = 0; i < qtd; i++) {
    const nums = new Set();
    while (nums.size < 15) nums.add(Math.floor(Math.random()*25)+1);
    lista.push([...nums].sort((a,b)=>a-b));
  }
  return lista;
}

/* ---------- Cálculos estatísticos ---------- */
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

/* ---------- Gráficos ---------- */
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

/* ---------- Gerador ---------- */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function gerarJogo() {
  if (concursos.length === 0) return null;
  const ultimo = concursos[concursos.length - 1];
  const somas = calcSomas();
  const mediaSoma = somas.reduce((a,b)=>a+b,0)/somas.length;
  const desvioSoma = Math.sqrt(somas.reduce((a,b)=>a+(b-mediaSoma)**2,0)/somas.length);

  let tentativas = 0;
  while (tentativas++ < 10000) {
    const pares = [2,4,6,8,10,12,14,16,18,20,22,24];
    const impares = [1,3,5,7,9,11,13,15,17,19,21,23,25];
    shuffle(pares); shuffle(impares);
    const jogo = [...pares.slice(0,8), ...impares.slice(0,7)].sort((a,b)=>a-b);

    const soma = jogo.reduce((a,b)=>a+b,0);
    const repetidos = jogo.filter(n => ultimo.includes(n)).length;
    const faixas = [0,0,0,0,0];
    jogo.forEach(n => faixas[Math.floor((n-1)/5)]++);

    if (soma < mediaSoma - desvioSoma || soma > mediaSoma + desvioSoma) continue;
    if (repetidos < 8 || repetidos > 11) continue;
    if (faixas.some(f => f < 1)) continue;
    return jogo;
  }
  return null;
}

function renderJogo() {
  const jogo = gerarJogo();
  const el = $('jogoGerado');
  const info = $('jogoInfo');
  if (!jogo) {
    el.innerHTML = '<span style="color:var(--muted)">Não foi possível gerar com os filtros. Tente recarregar os dados.</span>';
    info.textContent = '';
    return;
  }
  el.innerHTML = jogo.map(n => `<div class="bola">${pad(n)}</div>`).join('');
  const soma = jogo.reduce((a,b)=>a+b,0);
  const repetidos = jogo.filter(n => concursos[concursos.length-1].includes(n)).length;
  info.innerHTML = `Soma: <b>${soma}</b> · Repetidos do último: <b>${repetidos}</b> · Pares: <b>8</b> · Ímpares: <b>7</b>`;
}

/* ---------- Conferidor ---------- */
function conferir() {
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

/* ---------- Render geral ---------- */
function renderTudo() {
  renderDonut();
  renderFreq();
  renderAtraso();
  renderFaixas();
  renderSoma();
  renderRepetidos();
  renderJogo();
}

/* ---------- Fluxo principal ---------- */
async function carregarDados() {
  $('status').innerHTML = '<span class="loading"></span>Conectando à API…';
  try {
    concursos = await buscarTodosConcursos();
    $('status').textContent = `✅ ${concursos.length} concursos reais carregados`;
    renderTudo();
  } catch (err) {
    console.warn('Falha na API, usando demo:', err);
    concursos = gerarDadosDemo(500);
    $('status').innerHTML = `⚠️ API indisponível. Usando ${concursos.length} concursos simulados.`;
    renderTudo();
  }
}

/* ---------- Eventos ---------- */
$('recarregarBtn').addEventListener('click', carregarDados);
$('gerarBtn').addEventListener('click', renderJogo);
$('conferirBtn').addEventListener('click', conferir);
$('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  if (concursos.length) renderTudo();
});

/* ---------- Início ---------- */
carregarDados();
