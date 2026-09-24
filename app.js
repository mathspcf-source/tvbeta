/* ============================================================
   Lotofácil Casino Analytics — Mobile First
   ============================================================ */

const API_BASE = 'https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil';
const CACHE_KEY = 'lotofacil_concursos_v4';
const CACHE_EXPIRA = 6 * 60 * 60 * 1000;

let concursos = [];
let fonteAtual = 'none';
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ---------- Toast ---------- */
function toast(msg, duracao = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duracao);
}

/* ============================================================
   1. EXTRAÇÃO — 3 FONTES
   ============================================================ */

async function processarArquivo(file) {
  $('badgeFonte').innerHTML = '<span class="loading"></span>Lendo…';
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
        lista.push([...new Set(nums)].sort((a,b)=>a-b));
      }
    }

    if (lista.length === 0) throw new Error('Nenhum concurso válido');
    lista.reverse();
    concursos = lista;
    fonteAtual = 'arquivo';
    atualizarBadge();
    salvarCache();
    renderTudo();
    toast(`✅ ${concursos.length} concursos carregados`);
  } catch (e) {
    console.error(e);
    $('badgeFonte').className = 'badge-mini off';
    $('badgeFonte').textContent = 'erro';
    toast(`❌ ${e.message}`);
  }
}

function parseLinha(line) {
  const nums = line.trim().split(/[\s,;]+/).map(Number).filter(n => n >= 1 && n <= 25);
  return nums.length === 15 ? [...new Set(nums)].sort((a,b)=>a-b) : null;
}

function processarTexto() {
  const txt = $('dataInput').value;
  const lista = txt.split('\n').map(parseLinha).filter(Boolean);
  if (lista.length === 0) { toast('⚠️ Nenhum concurso válido'); return; }
  concursos = lista.reverse();
  fonteAtual = 'manual';
  atualizarBadge();
  salvarCache();
  renderTudo();
  toast(`✅ ${concursos.length} concursos carregados`);
}

async function carregarAPI() {
  $('badgeFonte').innerHTML = '<span class="loading"></span>API…';
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
    salvarCache();
    renderTudo();
    toast(`✅ ${concursos.length} concursos da API`);
  } catch (e) {
    $('badgeFonte').className = 'badge-mini off';
    $('badgeFonte').textContent = 'erro';
    toast(`❌ ${e.message}`);
  }
}

function atualizarBadge() {
  const b = $('badgeFonte');
  b.className = 'badge-mini';
  b.textContent = `${concursos.length} · ${fonteAtual}`;
}

function salvarCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      concursos
    }));
  } catch {}
}

/* ============================================================
   2. VALIDAÇÃO
   ============================================================ */

function validarDados() {
  const problemas = [];
  const vistos = new Set();
  concursos.forEach((c, i) => {
    const fora = c.filter(n => n < 1 || n > 25);
    if (fora.length > 0) problemas.push(`Concurso ${i+1}: números fora do intervalo`);
    if (c.length !== 15) problemas.push(`Concurso ${i+1}: ${c.length} números`);
    const unicos = new Set(c);
    if (unicos.size !== c.length) problemas.push(`Concurso ${i+1}: números repetidos`);
    const chave = c.join('-');
    if (vistos.has(chave)) problemas.push(`Concurso ${i+1}: duplicado`);
    else vistos.add(chave);
  });

  const el = $('validacao');
  if (problemas.length === 0) {
    el.innerHTML = `<span style="color:var(--green)">✅ ${concursos.length} concursos válidos</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--red)">⚠️ ${problemas.length} problema(s):</span><br>` +
      problemas.slice(0, 10).map(p => `• ${p}`).join('<br>') +
      (problemas.length > 10 ? `<br>... +${problemas.length - 10}` : '');
  }
}

/* ============================================================
   3. HIPERGEOMÉTRICA
   ============================================================ */

function combinacao(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}

function hipergeometrica(k, N, K, n) {
  return combinacao(K, k) * combinacao(N - K, n - k) / combinacao(N, n);
}

function renderTabelaProb() {
  const tbody = $('tabelaProb').querySelector('tbody');
  const linhas = [];
  for (let k = 15; k >= 11; k--) {
    const prob = hipergeometrica(k, 25, 15, 15);
    const umEm = Math.round(1 / prob);
    linhas.push(`
      <tr>
        <td>${k} acertos</td>
        <td class="val">1 em ${umEm.toLocaleString('pt-BR')}</td>
        <td>R$ 3,50</td>
      </tr>
    `);
  }
  tbody.innerHTML = linhas.join('');
}

/* ============================================================
   4. CÁLCULOS
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
  const dist
