/* ============================================================
   Lotofácil Analytics — Extração Otimizada
   Concurso atual: 3787
   ============================================================ */

const API_BASE = 'https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil';
const CACHE_KEY = 'lotofacil_concursos_v1';
const CACHE_EXPIRA = 6 * 60 * 60 * 1000; // 6 horas

let concursos = [];
const charts = {};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

/* ---------- Cache ---------- */
function salvarCache(dados) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      concursos: dados
    }));
  } catch (e) {
    console.warn('Cache cheio, ignorando:', e);
  }
}

function lerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.timestamp > CACHE_EXPIRA) return null;
    return obj.concursos;
  } catch { return null; }
}

/* ---------- Extração ---------- */
async function buscarUltimoConcurso() {
  const res = await fetch(`${API_BASE}/_ultimo.json`);
  if (!res.ok) throw new Error('Falha ao buscar último concurso');
  return res.json();
}

async function buscarTodosConcursos() {
  // Tentativa 1: arquivo único com todos os concursos
  try {
    $('status').innerHTML = '<span class="loading"></span>Tentando baixar arquivo completo…';
    const res = await fetch(`${API_BASE}/_todos.json`);
    if (res.ok) {
      const data = await res.json();
      // O arquivo pode ser um objeto { "1": {...}, "2": {...} } ou um array
      const lista = Array.isArray(data) ? data : Object.values(data);
      const formatados = lista
        .map(c => {
          const dezenas = c.listaDezenas || c.dezenas || c.numeros;
          return Array.isArray(dezenas) && dezenas.length === 15
            ? dezenas.map(Number).sort((a,b)=>a-b)
            : null;
        })
        .filter(Boolean);
      
      if (formatados.length > 100) {
        console.log(`✅ Baixados ${formatados.length} concursos via _todos.json`);
        return formatados;
      }
    }
  } catch (e) {
    console.warn('_todos.json indisponível, usando método alternativo');
  }

  // Tentativa 2: baixar apenas os últimos 500 concursos (mais que suficiente para estatísticas)
  $('status').innerHTML = '<span class="loading"></span>Baixando últimos 500 concursos…';
  const ultimo = await buscarUltimoConcurso();
  const numeroUltimo = ultimo.numero || ultimo.concurso || ultimo.numeroConcurso;
  
  const inicio = Math.max(1, numeroUltimo - 499);
  const concursosBaixados = [];

  // Download sequencial (não paralelo) para não estourar rate limit
  for (let n = inicio; n <= numeroUltimo; n++) {
    try {
      const res = await fetch(`${API_BASE}/${n}.json`);
      if (res.ok) {
        const c = await res.json();
        const dezenas = c.listaDezenas || c.dezenas || c.numeros;
        if (Array.isArray(dezenas) && dezenas.length === 15) {
          concursosBaixados.push(dezenas.map(Number).sort((a,b)=>a-b));
        }
      }
    } catch (e) {
      // ignora falhas individuais
    }
    
    // Atualiza progresso a cada 25 concursos
    if ((n - inicio) % 25 === 0) {
      $('status').innerHTML = `<span class="loading"></span>Baixados ${concursosBaixados.length} de 500…`;
    }
  }

  return concursosBaixados;
}

/* ---------- Carregamento ---------- */
async function carregarDados() {
  // Tenta cache primeiro
  const cache = lerCache();
  if (cache && cache.length > 100) {
    concursos = cache;
    $('status').textContent = `✅ ${concursos.length} concursos (cache local)`;
    renderTudo();
    return;
  }

  // Senão, baixa da API
  $('status').innerHTML = '<span class="loading"></span>Conectando à API…';
  try {
    concursos = await buscarTodosConcursos();
    if (concursos.length < 100) throw new Error('Dados insuficientes');
    
    salvarCache(concursos);
    $('status').textContent = `✅ ${concursos.length} concursos reais carregados`;
    renderTudo();
  } catch (err) {
    console.error('Erro na extração:', err);
    concursos = gerarDadosDemo(500);
    $('status').innerHTML = `⚠️ API indisponível. Usando ${concursos.length} concursos simulados.`;
    renderTudo();
  }
}

/* ---------- Demo ---------- */
function gerarDadosDemo(qtd = 500) {
  const lista = [];
  for (let i = 0; i < qtd; i++) {
    const nums = new Set();
    while (nums.size < 15) nums.add(Math.floor(Math.random()*25)+1);
    lista.push([...nums].sort((a,b)=>a-b));
  }
  return lista;
}
