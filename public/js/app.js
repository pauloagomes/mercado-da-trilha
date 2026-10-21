// Mercado da Trilha — interface.
// Jogar sozinho usa o motor (engine.js) direto no navegador.
// Nas salas, o servidor é a fonte da verdade: o celular só envia jogadas e desenha o estado recebido.
import * as E from './engine.js';
import * as R from './rivais.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const ic = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fichaSrc = (id) => `img/fichas/${encodeURIComponent(id || 'f01')}.svg`;
const fichaNome = (id) => E.FICHAS.find((f) => f.id === id)?.nome || 'Ficha';
const bc = (v) => `<span class="bc">${v} BC</span>`;
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const linkHub = (slot, texto) => `<a href="/r/${slot}" target="_blank" rel="noopener">${texto}</a>`;

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } },
};

const DICAS = [
  'Cada item do kit protege de um revés: Lona da chuva, Corda da ponte, Lanterna do Perdido, Kit primeiros socorros do curativo.',
  'A Bússola dá um dado duplo de graça.',
  'Nas últimas rodadas é noite no acampamento: créditos e cartas certas valem em dobro.',
  'Passou pela Partida? Mais 30 BC de mesada na conta.',
  'Na Agência BadenCoin você recebe 40 BC, mas a conta nunca passa de 300 BC.',
  'Confira o aviso de gasto depois de cada compra: é assim que se pega um valor errado.',
  'No acampamento de verdade, a carteira do Trilha HUB avisa cada gasto no WhatsApp.',
  'Cada item do kit vale 10 pts, e o kit completo dá mais 20.',
  'O que sobra na conta no fim também conta: 1 pt a cada 10 BC.',
  'Dado duplo custa 5 BC: você rola dois dados e fica com o que preferir.',
  'Ajudar no acampamento não anda, mas põe 15 BC na sua conta.',
  'Acertou uma carta de Tempestade? Você evita o revés.',
];

// ---------- Dia, identificador, insígnias e fila de envio ----------
// O dia do desafio é o dia civil de São Paulo (toISOString viraria "amanhã" das 21h à meia-noite).
const diaSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const ORDEM = { eu: 0, r1: 1, r2: 2, r3: 3 };
const GLIFOS = { contador: '✓', kit8: '8', poupador: 'P', guardiao: 'G', semrecusa: '0', fogueiro: 'F', cofre: '$', leiloeiro: 'C', equipado: 'E', missao: '★', dados: '2', campeao: '1' };
const COR_SELO = ['partida', 'agencia', 'util', 'exp', 'enf', 'pedagio', 'bussola', 'tempestade', 'perdido', 'fogo'];
const seloHtml = (id, off = false) => {
  const i = E.INSIGNIAS.find((x) => x.id === id); if (!i) return '';
  return `<span class="selo${off ? ' off' : ''}" style="--c:var(--c-${COR_SELO[E.INSIGNIAS.indexOf(i) % COR_SELO.length]})" title="${esc(i.nome)}: ${esc(i.desc)}" aria-label="${esc(i.nome)}">${GLIFOS[id]}</span>`;
};

const S = {
  tela: 'entrada',
  perfil: ls.get('mt-perfil', { apelido: '', ficha: 'f01' }),
  rodadas: ls.get('mt-rodadas', E.RODADAS_PADRAO),
  online: false, registrado: false,
  modo: null,            // 'solo' | 'sala'
  solo: null,            // estado do motor no jogo solo (o que se vê é S.eu, uma cópia)
  sala: null, eu: null, placar: [], mural: [], fila: null, pontes: {},
  erro: '', carrinho: {}, offset: 0, confirmarEncerrar: false,
  aguardando: false,     // clicou e espera a resposta (e a animação) para clicar de novo
  cenasN: null,          // última cena já mostrada (null = ainda não sei, não anime o passado)
  soloN: 0, peaoPos: {}, // peaoPos: ordem -> casa onde o peão está desenhado
  som: ls.get('mt-som', true), reacaoLivreEm: 0,
  insignias: Object.keys(ls.get('mt-insignias', {})),   // todas as que o jogador já ganhou (aparelho + servidor)
  resultado: null, trilha: null, ranking: null, soloSala: false,
  setas: {}, delta: {},  // C5: quem subiu ou desceu no placar e os pontos ganhos na última jogada
};

// ---------- Utilidades de tela ----------
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
}
function ir(tela) { S.tela = tela; S.erro = ''; if (tela !== 'jogo') S.verTab = false; render(); window.scrollTo({ top: 0 }); }
const eu = () => S.eu;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Som e vibração (D5): tudo gerado no navegador, sem arquivo para baixar ----------
let ac = null;
function audio() {
  if (!S.som) return null;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { return null; }
  return ac;
}
function tom(f, dur, { tipo = 'sine', vol = 0.1, atraso = 0, ate } = {}) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + atraso, o = a.createOscillator(), g = a.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t0);
  if (ate) o.frequency.exponentialRampToValueAtTime(ate, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function ruido(dur, { vol = 0.08, atraso = 0, filtro = 1800 } = {}) {
  const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = filtro; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination); src.start(a.currentTime + atraso);
}
const SONS = {
  dado: () => { for (let i = 0; i < 5; i++) ruido(0.05, { atraso: i * 0.1, vol: 0.07, filtro: 900 + i * 300 }); },
  passo: () => tom(520, 0.05, { tipo: 'triangle', vol: 0.05 }),
  moeda: () => { tom(988, 0.09, { tipo: 'square', vol: 0.04 }); tom(1319, 0.2, { tipo: 'square', vol: 0.04, atraso: 0.08 }); },
  gasto: () => tom(330, 0.14, { tipo: 'triangle', vol: 0.1, ate: 220 }),
  recusa: () => tom(160, 0.3, { tipo: 'sawtooth', vol: 0.06, ate: 110 }),
  certa: () => [523, 659, 784].forEach((f, i) => tom(f, 0.14, { tipo: 'triangle', vol: 0.08, atraso: i * 0.09 })),
  errada: () => tom(260, 0.25, { tipo: 'triangle', vol: 0.08, ate: 170 }),
  fogo: () => { ruido(1.2, { vol: 0.1, filtro: 700 }); [262, 330, 392, 523].forEach((f, i) => tom(f, 0.4, { tipo: 'triangle', vol: 0.06, atraso: 0.1 + i * 0.12 })); },
  reacao: () => tom(700, 0.07, { vol: 0.05, ate: 940 }),
};
function som(nome, vibra) {
  if (!S.som) return;
  SONS[nome]?.();
  if (vibra) { try { navigator.vibrate?.(vibra); } catch { /* sem vibração */ } }
}
function alternarSom() {
  S.som = !S.som; ls.set('mt-som', S.som);
  if (S.som) som('moeda');
  document.querySelectorAll('.btn-som').forEach((b) => { b.setAttribute('aria-pressed', S.som); b.innerHTML = botaoSomHtml(); });
}
const botaoSomHtml = () => `${ic(S.som ? 'som' : 'mudo')}<span>Som ${S.som ? 'ligado' : 'desligado'}</span>`;
const botaoSom = () => `<button class="btn sm btn-som" aria-pressed="${S.som}" title="Ligar ou desligar o som">${botaoSomHtml()}</button>`;
document.addEventListener('click', (e) => { if (e.target.closest('.btn-som')) alternarSom(); });

// ---------- Servidor ----------
async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Não foi possível falar com o servidor.');
  return j;
}

async function iniciar() {
  try {
    const r = await api('/api/eu');
    S.online = true;
    if (r.jogador) {
      S.registrado = true;
      if (!S.perfil.apelido) S.perfil = { ...r.jogador };
      mesclarInsignias(r.insignias || []);
    }
    enviarPendentes();
    carregarRanking();
    const sala = ls.get('mt-sala', null);
    if (sala && S.registrado) { S.modo = 'sala'; S.tela = 'jogo'; S.cenasN = null; await conectar(); enviar({ t: 'entrar', codigo: sala }); }
  } catch { S.online = false; }
  render();
}

async function registrar() {
  const apelido = S.perfil.apelido.trim();
  if (apelido.length < 2) throw new Error('Escreva um apelido com pelo menos 2 letras.');
  ls.set('mt-perfil', S.perfil);
  if (!S.online) return;
  await api('/api/eu', { apelido, ficha: S.perfil.ficha });
  S.registrado = true;
}

let ws = null, tentativas = 0, jaConectou = false;
function conectar() {
  return new Promise((ok, falha) => {
    if (ws && ws.readyState === 1) return ok();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/ws`);
    ws = sock;
    sock.onopen = () => {
      const reconexao = jaConectou;
      jaConectou = true; tentativas = 0;
      if (reconexao) {
        const c = ls.get('mt-sala', null);
        if (S.modo === 'sala' && c) enviar({ t: 'entrar', codigo: c });
        else if (S.tela === 'fila') enviar({ t: 'fila_entrar' });
      }
      ok();
    };
    sock.onmessage = (e) => { try { receber(JSON.parse(e.data)); } catch { /* mensagem inválida */ } };
    sock.onerror = () => falha(new Error('Sem conexão com o servidor.'));
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (S.modo === 'sala' || S.tela === 'fila') {
        setTimeout(() => conectar().catch(() => {}), Math.min(8000, 500 * 2 ** tentativas++));
      }
    };
  });
}
function enviar(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else toast('Reconectando ao servidor…'); }

function receber(m) {
  if (m.t === 'estado') {
    empilhar(m);
  } else if (m.t === 'partida') {
    S.modo = 'sala'; ls.set('mt-sala', m.codigo); S.fila = null; S.cenasN = null; S.eu = null; S.peaoPos = {};
    if (S.tela !== 'resultado' || m.nova) { S.tela = 'jogo'; S.verTab = false; S.resultado = null; S.confetou = false; S.setas = {}; S.delta = {}; S.placar = []; }
  } else if (m.t === 'fila') {
    S.fila = m; S.offset = m.agora - Date.now();
    if (S.tela === 'fila') render();
  } else if (m.t === 'fila_saiu') {
    toast(m.msg); S.fila = null; ir('entrada');
  } else if (m.t === 'erro') {
    S.aguardando = false;
    if (S.tela === 'jogo' && eu()?.pend?.tipo === 'loja') { S.erro = m.msg; atualizarJogo(); } else { toast(m.msg); atualizarJogo(); }
    if (/não encontrada|encerrada|já começou/.test(m.msg) && S.tela !== 'resultado') { ls.del('mt-sala'); S.modo = null; ir('entrada'); }
  } else if (m.t === 'reacao') {
    mostrarReacao(m);
  } else if (m.t === 'revanche_sala') {
    if (!m.proprio) toast(`${m.de} reabriu a sala: vamos de revanche!`);
    entrarNaRevanche(m.codigo);
  }
}

// ---------- Fila de animações (D0) ----------
// Cada estado recebido espera a animação anterior terminar. Se a fila atrasar (celular lento,
// aba escondida), as animações são puladas e o estado mais novo aparece direto.
const pendentes = [];
let animando = false;
function empilhar(m) {
  pendentes.push(m);
  if (!animando) drenar();
}
async function drenar() {
  animando = true;
  while (pendentes.length) {
    const m = pendentes.shift();
    try { await aplicar(m, !reduzir && !document.hidden && pendentes.length < 3); } catch (e) { console.error(e); }
  }
  animando = false;
}

const minhaOrdem = (m) => m.placar.find((p) => p.eu)?.ordem;

async function aplicar(m, animar) {
  const novas = (m.cenas || []).filter((c) => S.cenasN != null && c.n > S.cenasN);
  if (m.cenas?.length) S.cenasN = Math.max(S.cenasN ?? 0, ...m.cenas.map((c) => c.n));
  else if (S.cenasN == null) S.cenasN = 0;
  if (animar && novas.length && novas.length <= (S.modo === 'solo' ? 12 : 4) && S.tela === 'jogo' && $('#board')) {
    S.cenaEmCurso = true;
    try { for (const c of novas) await animarCena(c, m); } finally { S.cenaEmCurso = false; }
  } else if (novas.length) {
    // sem animar, os avisos que mereciam toast ainda aparecem
    for (const c of novas) for (const ev of c.cena) if (ev.t === 'sala' && c.ordem === minhaOrdem(m)) toast(`${ev.de} tirou "${ev.carta}"`);
  }
  const antes = S.eu;
  atualizarRanking(m.placar);
  S.sala = m.sala; S.eu = m.eu; S.placar = m.placar; S.mural = m.mural; S.pontes = m.pontes || {};
  if (m.sala) S.offset = m.sala.agora - Date.now();
  if (m.eu && antes && antes.pend?.tipo === 'loja' && !m.eu.pend) S.carrinho = {};
  if (S.modo === 'sala' && (m.sala.status === 'encerrada' || m.eu?.fim) && S.tela === 'jogo' && !S.verTab) S.tela = 'resultado';
  if (S.tela === 'entrada' || S.tela === 'fila') S.tela = 'jogo';
  if (S.modo === 'solo' && m.eu?.fim && S.tela === 'jogo') setTimeout(() => ir('resultado'), 900);
  S.erro = ''; S.aguardando = false;
  render();
}

// C5: setas de subida e descida, "+N pts" da última jogada e aviso de "Virada!" quando o líder muda.
function atualizarRanking(novo) {
  const ant = S.placar;
  if (!ant.length || ant.length !== novo.length || novo.length < 2) { S.setas = {}; S.delta = {}; return; }
  const rank = (l) => Object.fromEntries(l.map((p, i) => [p.ordem, i]));
  const ra = rank(ant), rn = rank(novo);
  let mexeu = false;
  for (const p of novo) {
    if (ra[p.ordem] != null && rn[p.ordem] !== ra[p.ordem]) S.setas[p.ordem] = rn[p.ordem] < ra[p.ordem] ? 'up' : 'down';
    const antes = ant.find((x) => x.ordem === p.ordem);
    if (antes && p.pontos > antes.pontos) { S.delta[p.ordem] = { v: p.pontos - antes.pontos, ate: Date.now() + 2600 }; mexeu = true; }
  }
  if (ant[0].ordem !== novo[0].ordem && ant[0].pontos > 0) {
    banner(`Virada! ${novo[0].apelido} assumiu a liderança`, 'virada'); som('certa');
  }
  if (mexeu) setTimeout(atualizarPlacar, 2700);
}
function atualizarPlacar() { const el = $('#placar'); if (el) el.innerHTML = placarHtml(); }

// ---------- Avisos na tela ----------
function banner(texto, cls = '') {
  const el = document.createElement('div');
  el.className = `banner-jogo ${cls}`; el.textContent = texto;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
// D4: o aviso de gasto desce do topo no formato da mensagem do Trilha HUB.
function notificar(texto) {
  const el = document.createElement('div');
  el.className = 'notif'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="notif-topo"><b>Trilha HUB</b><span>agora</span></div><div>${esc(texto)}</div>`;
  document.body.appendChild(el);
  if (reduzir) { setTimeout(() => el.remove(), 3000); return; }
  const a = el.animate([{ transform: 'translate(-50%, -120%)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.12 },
    { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%, -120%)', opacity: 0 }], { duration: 3200 });
  a.finished.then(() => el.remove()).catch(() => el.remove());
}
// D6: confete para o kit completo e para o Canivete.
function confete() {
  if (reduzir) return;
  const cores = ['#E3A21A', '#2F7A42', '#C2415D', '#2B6FA3', '#7A4FB0', '#D2541B'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('i');
    el.className = 'confete'; el.style.background = cores[i % cores.length];
    document.body.appendChild(el);
    const x = Math.random() * innerWidth, dx = (Math.random() - 0.5) * 240, giro = Math.random() * 720 - 360;
    const a = el.animate([{ transform: `translate(${x}px, -20px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${innerHeight + 20}px) rotate(${giro}deg)`, opacity: 0.9 }],
      { duration: 1400 + Math.random() * 900, delay: Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' });
    a.finished.then(() => el.remove()).catch(() => el.remove());
  }
}

// ---------- Cenas: o que aconteceu em cada jogada ----------
async function animarCena(c, m) {
  const meu = c.ordem === minhaOrdem(m);
  for (const ev of c.cena) {
    const f = CENAS[ev.t];
    if (f) await f(ev, c.ordem, meu, m);
  }
}

const celula = (i) => $(`#board [data-casa="${i}"]`);
const peao = (o) => $(`#peoes [data-o="${o}"]`);

function pintarDado(el, v) { el.querySelectorAll('i').forEach((p, k) => p.classList.toggle('on', PIPS[v].includes(k))); }
const dadoHtml = (v, extra = '') => `<div class="dado${extra}" aria-label="Dado: ${v}">${[...Array(9)].map((_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;

// Posiciona cada peão na casa onde está desenhado; vários na mesma casa dividem o espaço.
function layoutPeoes() {
  const porCasa = {};
  for (const [o, pos] of Object.entries(S.peaoPos)) (porCasa[pos] ||= []).push(Number(o));
  for (const [pos, lista] of Object.entries(porCasa)) {
    const c = celula(pos); if (!c) continue;
    lista.sort((a, b) => a - b);
    const w = c.offsetWidth, h = c.offsetHeight, n = lista.length;
    lista.forEach((o, k) => {
      const el = peao(o); if (!el) return;
      const tam = Math.round(Math.min(w, h) * (el.classList.contains('eu') ? 0.38 : 0.3));
      const passo = n > 1 ? Math.min(tam + 2, (w - tam - 4) / (n - 1)) : 0;
      const x = c.offsetLeft + (w - tam - passo * (n - 1)) / 2 + passo * k;
      const y = c.offsetTop + h - tam - 3;
      el.style.width = el.style.height = `${tam}px`;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
  }
}

function sincronizarPeoes(placar) {
  const lay = $('#peoes'); if (!lay) return;
  const ordens = new Set(placar.map((p) => String(p.ordem)));
  for (const el of [...lay.children]) if (!ordens.has(el.dataset.o)) { el.remove(); delete S.peaoPos[el.dataset.o]; }
  for (const p of placar) {
    let el = peao(p.ordem);
    if (!el) { el = document.createElement('div'); el.dataset.o = p.ordem; el.innerHTML = '<img alt="">'; lay.appendChild(el); }
    el.className = `peao2${p.eu ? ' eu' : ''}`;
    el.style.setProperty('--pc', p.cor);
    el.title = p.apelido;
    const img = el.firstChild, src = fichaSrc(p.ficha);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    S.peaoPos[p.ordem] = p.pos;
  }
  layoutPeoes();
}

// Texto ou moeda que sobe e some sobre um elemento (só transform e opacity).
function flutuar(alvo, texto, cls = '') {
  const board = $('#board'); if (!alvo || !board || reduzir) return;
  const b = board.getBoundingClientRect(), r = alvo.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `flut ${cls}`; el.textContent = texto;
  el.style.left = `${r.left - b.left + r.width / 2}px`; el.style.top = `${r.top - b.top}px`;
  board.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// D3: moedas voam da casa até o saldo, e o número conta até o valor novo.
function contarSaldo(ate, ms = 420) {
  const el = $('#saldoNum'); if (!el) return Promise.resolve();
  const de = Number(el.textContent) || 0;
  if (reduzir || de === ate) { el.textContent = ate; return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise((ok) => {
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = Math.round(de + (ate - de) * p);
      if (p < 1) requestAnimationFrame(passo); else ok();
    };
    requestAnimationFrame(passo);
  });
}
function moedasAteSaldo(ordem, qtd) {
  const origem = peao(ordem), alvo = $('#saldoNum');
  if (!origem || !alvo || reduzir) return Promise.resolve();
  const o = origem.getBoundingClientRect(), d = alvo.getBoundingClientRect();
  const anims = [];
  for (let i = 0; i < qtd; i++) {
    const el = document.createElement('div');
    el.className = 'moeda-voa'; document.body.appendChild(el);
    const dx = d.left + d.width / 2 - (o.left + o.width / 2), dy = d.top + d.height / 2 - (o.top + o.height / 2);
    const a = el.animate(
      [{ transform: `translate(${o.left + o.width / 2}px, ${o.top}px) scale(.6)`, opacity: 0 },
       { transform: `translate(${o.left + o.width / 2}px, ${o.top - 14}px) scale(1)`, opacity: 1, offset: 0.2 },
       { transform: `translate(${o.left + o.width / 2 + dx}px, ${o.top + dy}px) scale(.7)`, opacity: 1 }],
      { duration: 560, delay: i * 70, easing: 'ease-in', fill: 'backwards' });
    a.finished.then(() => el.remove()).catch(() => el.remove());
    anims.push(a.finished.catch(() => {}));
  }
  return Promise.all(anims);
}
function piscar(sel, cor) {
  const el = $(sel); if (!el || reduzir) return;
  el.animate([{ opacity: 1 }, { opacity: 0.25, color: cor }, { opacity: 1 }], { duration: 320 });
}

const CENAS = {
  async dado(ev, ordem, meu) {
    if (!meu) return;
    const box = $('#dados'); if (!box) return;
    const n = ev.v.length;
    box.innerHTML = ev.v.map(() => dadoHtml(1)).join('');
    box.classList.add('rolando'); som('dado', 15);
    const t0 = performance.now();
    while (performance.now() - t0 < 600) {
      box.querySelectorAll('.dado').forEach((d) => pintarDado(d, 1 + Math.floor(Math.random() * 6)));
      await sleep(90);
    }
    box.classList.remove('rolando');
    box.innerHTML = ev.v.map((v) => dadoHtml(v)).join('');
    if (n === 1) { const dest = celula((S.peaoPos[ordem] + ev.v[0]) % E.TABULEIRO.length); dest?.classList.add('destino'); setTimeout(() => dest?.classList.remove('destino'), 900); }
  },
  async escolheu(ev, ordem, meu) {
    if (!meu) return;
    const box = $('#dados'); if (!box) return;
    box.innerHTML = dadoHtml(ev.v);
    const dest = celula((S.peaoPos[ordem] + ev.v) % E.TABULEIRO.length);
    dest?.classList.add('destino'); setTimeout(() => dest?.classList.remove('destino'), 900);
    await sleep(160);
  },
  async andou(ev, ordem) {
    const el = peao(ordem); if (!el) return;
    const dir = ev.passos < 0 ? -1 : 1, n = Math.abs(ev.passos);
    let pos = ev.de;
    S.peaoPos[ordem] = pos; layoutPeoes();
    for (let k = 0; k < n; k++) {
      pos = (pos + dir + E.TABULEIRO.length) % E.TABULEIRO.length;
      S.peaoPos[ordem] = pos; layoutPeoes();
      el.firstChild.classList.remove('pulo'); void el.offsetWidth; el.firstChild.classList.add('pulo');
      som('passo');
      if (dir > 0 && pos === 0 && ev.cruzou) flutuar(celula(0), `+${E.MESADA} BC`, 'bom');
      await sleep(reduzir ? 0 : 120);
    }
  },
  async credito(ev, ordem, meu) {
    if (!meu) return;
    som('moeda');
    await moedasAteSaldo(ordem, Math.min(5, Math.max(1, Math.round(ev.v / 10))));
    await contarSaldo(ev.saldo);
  },
  async gasto(ev, ordem, meu) {
    if (!meu) return;
    som('gasto', 25); piscar('#saldoNum', 'var(--bad)');
    notificar(`Gasto de ${ev.v} BC: ${ev.d}. Saldo: ${ev.saldo} BC.`);
    await contarSaldo(ev.saldo);
  },
  async recusa(ev, ordem, meu) {
    if (!meu) return;
    som('recusa', [60, 40, 60]);
    $('#conta')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 280 });
    await sleep(200);
  },
  async fogo(ev, ordem, meu, m) {
    if (meu) chamas(); else toast(`${m.placar.find((p) => p.ordem === ordem)?.apelido || 'Alguém'} chegou ao Fogo de Conselho!`);
    som('fogo', [30, 30, 60]);
  },
  async carta(ev, ordem, meu) {
    if (!meu) return;
    som(ev.ok ? 'certa' : 'errada');
  },
  async arriscou(ev, ordem, meu) {
    if (!meu) return;
    const box = $('#dados'); if (!box) return;
    box.innerHTML = dadoHtml(ev.v); som('dado', 15);
    await sleep(500);
  },
  async ponte(ev, ordem, meu, m) {
    const quem = m.placar.find((p) => p.ordem === ordem);
    flutuar(celula(ev.pos), meu ? 'Sua ponte' : `Ponte de ${quem?.apelido || ''}`, 'info');
    S.pontes = { ...S.pontes, [ev.pos]: ordem };
    atualizarPontes(m.placar);
  },
  async gratificacao(ev, ordem, meu) {
    flutuar(peao(ordem), `+${E.GRATIFICACAO} BC`, 'bom');
    if (meu) { await moedasAteSaldo(ordem, 1); }
  },
  async sala(ev, ordem, meu) {
    if (meu) toast(`${ev.de} tirou a carta de sala "${ev.carta}"`);
  },
  async perdeu(ev, ordem, meu) {
    if (meu) { som('errada'); toast('Rodada perdida: ela passou sozinha.'); }
  },
  async kit(ev, ordem, meu) {
    if (!meu) return;
    confete(); som('certa', [40, 30, 80]); banner('Kit de Acampamento completo!', 'virada');
  },
  async canivete(ev, ordem, meu) {
    if (!meu) return;
    confete(); som('fogo'); banner(`Canivete! +${E.CANIVETE_PTS} pts`, 'virada');
  },
  async evento(ev, ordem, meu) {
    if (!meu) return;
    const loja = ev.loja ? ` · ${E.CASAS[ev.loja].nome}` : '';
    banner(`${E.EVENTOS[ev.tipo].nome}!${loja}`, 'evento'); som('moeda');
    await sleep(350);
  },
  async anuncio(ev, ordem, meu) {
    if (meu) toast(`Na próxima rodada: ${E.descreverEvento(ev)}`);
  },
  async noite(ev, ordem, meu) {
    if (meu) { banner('Noite no acampamento! Créditos e cartas certas valem em dobro', 'noite'); await sleep(300); }
  },
  async protegeu(ev, ordem, meu) {
    if (!meu) return;
    flutuar(peao(ordem), `${E.ITENS.find((i) => i.id === ev.item).nome} protegeu`, 'info'); som('certa');
  },
};

// A3: a reação aparece sobre o peão de quem reagiu e no mural.
function mostrarReacao(m) {
  if (!$('#board')) return;
  const el = peao(m.ordem);
  if (el && !reduzir) {
    const r = el.getBoundingClientRect(), b = $('#board').getBoundingClientRect();
    const bal = document.createElement('div');
    bal.className = 'reacao-bolha'; bal.textContent = E.REACOES[m.i];
    bal.style.left = `${r.left - b.left + r.width / 2}px`; bal.style.top = `${r.top - b.top}px`;
    $('#board').appendChild(bal);
    bal.addEventListener('animationend', () => bal.remove());
  }
  som('reacao');
  S.mural = [...S.mural, { texto: m.texto, cor: m.cor, em: Date.now() }].slice(-15);
  atualizarMural();
}

// ---------- Insígnias, histórico e envio dos resultados ----------
function mesclarInsignias(ids) {
  const locais = ls.get('mt-insignias', {});
  for (const id of ids) if (!locais[id]) locais[id] = new Date().toISOString();
  ls.set('mt-insignias', locais);
  S.insignias = [...new Set([...S.insignias, ...ids])];
}

// O jogo sozinho funciona sem internet: o resultado fica numa fila no aparelho e sobe quando der.
let enviando = false;
async function enviarPendentes() {
  const fila = ls.get('mt-envios', []);
  if (enviando || !fila.length || !S.online) return;
  enviando = true;
  try {
    if (!S.registrado) await registrar();
    const resto = [];
    for (const it of fila) {
      try {
        const r = await fetch(it.tipo === 'solo' ? '/api/solo' : '/api/desafio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(it.corpo) });
        if (r.status >= 500) resto.push(it);
        else if (r.ok) { const j = await r.json().catch(() => ({})); if (j.insignias) mesclarInsignias(j.insignias); if (it.tipo === 'desafio' && S.resultado) S.resultado.valeu = j.valeu; }
      } catch { resto.push(it); }
    }
    ls.set('mt-envios', resto);
  } catch { /* sem apelido ou sem rede: fica na fila */ } finally { enviando = false; }
}
addEventListener('online', () => { S.online = true; enviarPendentes(); });

async function carregarRanking() {
  if (!S.online) return;
  try { S.ranking = await api(`/api/desafio/ranking?dia=${diaSP()}`); if (S.tela === 'entrada' || S.tela === 'resultado') render(); } catch { /* sem placar do dia */ }
}

// ---------- Jogo sozinho (com rivais) e desafio do dia ----------
const COR_SOLO = '#D69712';
const corDe = (id) => (id === 'eu' ? COR_SOLO : R.RIVAIS.find((r) => r.id === id).cor);

// Cada jogador do contexto guarda o que aconteceu na jogada; aqui vira uma "cena" por jogador, como no servidor.
function coletarCenas(ctx) {
  const cenas = [];
  for (const [id, st] of ctx.estados) {
    const cena = E.esvaziarCena(st);
    st.saida = [];
    if (cena.length) cenas.push({ n: ++S.soloN, ordem: ORDEM[id], cena });
  }
  return cenas;
}

function salvarSolo() {
  const { modo, uuid: id, dia, acoes, treino, ctx } = S.solo;
  ls.set('mt-solo', { v: E.VERSAO_ESTADO, modo, uuid: id, dia, acoes, treino, pontes: ctx.pontes, estados: Object.fromEntries(ctx.estados) });
}
function carregarSolo() {
  const d = ls.get('mt-solo', null);
  if (!d || d.v !== E.VERSAO_ESTADO || !d.estados?.eu) { ls.del('mt-solo'); return null; }
  const ctx = E.novoContexto(d.modo === 'solo' ? d.pontes || {} : null);
  for (const [id, st] of Object.entries(d.estados)) { st.saida = []; st.cena = []; ctx.estados.set(id, st); }
  return { modo: d.modo, uuid: d.uuid, dia: d.dia, acoes: d.acoes || [], treino: !!d.treino, ctx };
}

// No jogo sozinho o motor roda aqui; a tela recebe uma cópia, no mesmo formato que o servidor manda.
function publicarSolo(cenas = []) {
  const { ctx } = S.solo, st = ctx.estados.get('eu');
  const snap = structuredClone(E.visaoPropria(st));
  snap.cor = COR_SOLO; snap.ordem = 0;
  if (snap.pend?.guardiao) snap.pend = { ...snap.pend, guardiaoApelido: ctx.estados.get(snap.pend.guardiao)?.apelido || null, guardiao: undefined };
  const placar = [...ctx.estados].map(([id, s]) => ({ ...E.resumoPublico(s), cor: corDe(id), ordem: ORDEM[id], eu: id === 'eu', patrulha: null, insignias: [] })).sort(E.compararPlacar);
  const pontes = {};
  for (const [pos, id] of Object.entries(ctx.pontes || {})) pontes[pos] = ORDEM[id];
  empilhar({ t: 'estado', sala: null, eu: snap, placar, mural: [], pontes, cenas });
}

function acao(t, extra = {}) {
  if (S.aguardando) return;
  if (S.modo === 'sala') {
    S.aguardando = true; atualizarPainel();
    clearTimeout(S.aguardandoT); S.aguardandoT = setTimeout(() => { if (S.aguardando) { S.aguardando = false; atualizarPainel(); } }, 4000);
    enviar({ t, ...extra });
    return;
  }
  const { ctx, modo } = S.solo, st = ctx.estados.get('eu'), msg = { t, ...extra };
  for (const x of ctx.estados.values()) E.esvaziarCena(x);
  const r = modo === 'desafio' ? E.passoDoDesafio(ctx, msg) : E.agirNaSala(ctx, 'eu', msg);
  if (r.erro) {
    for (const x of ctx.estados.values()) E.esvaziarCena(x);
    if (st.pend?.tipo === 'loja') S.erro = r.erro; else toast(r.erro);
    atualizarJogo(); return;
  }
  S.erro = '';
  let cenas = coletarCenas(ctx);
  if (modo === 'desafio') S.solo.acoes.push(msg);
  else if (st.feito) {
    // A rodada do jogador acabou: ela fecha, as perdidas passam sozinhas e os rivais jogam a deles.
    E.fecharRodada(st); E.passarRodadasPerdidas(st); cenas.push(...coletarCenas(ctx));
    R.rivaisJogam(ctx, Math.random); cenas.push(...coletarCenas(ctx));
  }
  if (!st.pend) S.carrinho = {};
  salvarSolo();
  if (st.fim) finalizarSolo();
  S.aguardando = true; atualizarPainel();
  publicarSolo(cenas);
}

// Fim da partida do jogo sozinho ou do desafio: recorde, insígnias, histórico e envio.
function finalizarSolo() {
  const { ctx, modo, uuid: id, dia, acoes, treino } = S.solo, st = ctx.estados.get('eu');
  const mesa = [...ctx.estados].map(([k, x]) => ({ k, ...E.resumoPublico(x) })).sort(E.compararPlacar);
  const pos = modo === 'solo' ? mesa.findIndex((x) => x.k === 'eu') + 1 : 0;
  const novas = E.insigniasDaPartida(st, { pos, total: modo === 'solo' ? mesa.length : 1 });
  const pts = E.pontuacao(st).total;
  S.resultado = { modo, pos, novas, pontos: pts, treino, dia, valeu: null };
  mesclarInsignias(novas);
  const chave = modo === 'desafio' ? 'mt-recorde-desafio' : 'mt-recorde', rec = ls.get(chave, null);
  S.novoRecorde = !rec || pts > rec.pontos;
  if (S.novoRecorde) ls.set(chave, { pontos: pts, em: Date.now() });
  ls.set('mt-historico', [{ modo, pontos: pts, saldo: st.saldo, quando: new Date().toISOString() }, ...ls.get('mt-historico', [])].slice(0, 20));
  ls.set('mt-vistas', [...ls.get('mt-vistas', []), ...st.sacadas].slice(-24));
  ls.del('mt-solo');
  const fila = ls.get('mt-envios', []);
  if (modo === 'solo') fila.push({ tipo: 'solo', corpo: { id, pontos: pts, saldo: st.saldo, acertos: st.acertos, kit: st.kit.length, rodadas: st.rodadas, posicao: pos, insignias: novas } });
  else if (!treino) { ls.set(`mt-desafio-${dia}`, { pontos: pts }); fila.push({ tipo: 'desafio', corpo: { dia, acoes } }); }
  ls.set('mt-envios', fila);
  enviarPendentes().then(() => { if (modo === 'desafio') carregarRanking(); });
}

async function jogarSozinho(continuar, modo = 'solo') {
  try { await registrarLocal(); } catch (e) { toast(e.message); return; }
  S.modo = 'solo';
  let salvo = continuar ? carregarSolo() : null;
  if (continuar && !salvo) toast('O jogo foi atualizado: a partida salva foi descartada.');
  if (!salvo) {
    const apelido = S.perfil.apelido.trim(), ficha = S.perfil.ficha;
    if (modo === 'desafio') {
      const dia = diaSP();
      salvo = { modo, uuid: uuid(), dia, acoes: [], treino: !!ls.get(`mt-desafio-${dia}`, null), ctx: E.novoDesafio(dia, { apelido, ficha }) };
    } else {
      salvo = { modo, uuid: uuid(), acoes: [], ctx: R.novoJogoSolo({ apelido, ficha, rodadas: S.rodadas, seed: Math.floor(Math.random() * 2 ** 31), vistas: ls.get('mt-vistas', []) }) };
    }
  }
  S.solo = salvo; salvarSolo();
  S.cenasN = null; S.aguardando = false; S.peaoPos = {}; S.resultado = null; S.confetou = false; S.setas = {}; S.delta = {}; S.placar = []; pendentes.length = 0;
  S.eu = null;
  publicarSolo();
  ir('jogo');
}
const jogarDesafio = () => jogarSozinho(false, 'desafio');
async function registrarLocal() {
  const a = S.perfil.apelido.trim();
  if (a.length < 2) throw new Error('Escreva um apelido com pelo menos 2 letras.');
  ls.set('mt-perfil', S.perfil); ls.set('mt-rodadas', S.rodadas);
}

async function preparoOnline() {
  if (!S.online) throw new Error('Salas indisponíveis: sem conexão com o servidor. Você pode jogar sozinho.');
  await registrarLocal();
  await registrar();
  await conectar();
}

async function entrarComCodigo(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(codigo)) { toast('O código tem 5 letras ou números.'); return; }
  try { await preparoOnline(); } catch (e) { toast(e.message); return; }
  S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; S.peaoPos = {}; S.eu = null;
  enviar({ t: 'entrar', codigo });
}
// E4: o anfitrião reabriu a sala com código; todos os que estavam no resultado são levados juntos.
function entrarNaRevanche(codigo) {
  S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; S.peaoPos = {}; S.eu = null; S.placar = [];
  S.verTab = false; S.resultado = null; S.setas = {}; S.delta = {};
  S.tela = 'jogo'; render();
  enviar({ t: 'entrar', codigo });
}
async function criarSala() {
  try {
    await preparoOnline();
    const { codigo } = await api('/api/salas', { rodadas: S.rodadas });
    S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; S.peaoPos = {}; S.eu = null;
    enviar({ t: 'entrar', codigo });
  } catch (e) { toast(e.message); }
}
async function entrarNaFila() {
  try { await preparoOnline(); } catch (e) { toast(e.message); return; }
  S.fila = null; S.modo = null; ls.del('mt-sala');
  ir('fila');
  enviar({ t: 'fila_entrar' });
}
function sairDaFila() { enviar({ t: 'fila_sair' }); S.fila = null; ir('entrada'); }
function sairDoJogo() {
  if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); }
  S.modo = null; S.sala = null; S.eu = null; S.placar = []; S.mural = []; S.pontes = {}; S.peaoPos = {}; pendentes.length = 0;
  ir('entrada');
}

// ---------- Chamas do Fogo de Conselho ----------
function chamas() {
  const banner = document.createElement('div');
  banner.className = 'fogo-banner'; banner.textContent = 'Fogo de Conselho! +20 BC';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2600);
  if (reduzir) return;
  const cv = $('#chamas'); const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.hidden = false;
  const W = cv.width, H = cv.height, parts = [];
  const t0 = performance.now(), dur = 2600;
  function frame(t) {
    const p = (t - t0) / dur;
    const intens = p < 0.15 ? p / 0.15 : p > 0.75 ? Math.max(0, (1 - p) / 0.25) : 1;
    for (let i = 0; i < 26 * intens; i++) {
      parts.push({ x: W * (0.15 + Math.random() * 0.7), y: H + 10, vx: (Math.random() - 0.5) * 1.6 * dpr,
        vy: -(4 + Math.random() * 6) * dpr, r: (14 + Math.random() * 26) * dpr, vida: 1 });
    }
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.x += q.vx + Math.sin((t + i) / 160) * 0.6 * dpr; q.y += q.vy; q.vida -= 0.012; q.r *= 0.985;
      if (q.vida <= 0) { parts.splice(i, 1); continue; }
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
      const a = q.vida * 0.55;
      g.addColorStop(0, `rgba(255,240,180,${a})`);
      g.addColorStop(0.4, `rgba(255,140,30,${a * 0.8})`);
      g.addColorStop(1, 'rgba(200,40,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (p < 1 || parts.length) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); cv.hidden = true; }
  }
  requestAnimationFrame(frame);
}

// ---------- Telas ----------
function topo(extra = '') {
  return `<header class="top"><div class="wrap"><span class="logo">${ic('moeda')}Mercado da <span>Trilha</span></span>${extra}</div></header>`;
}

function telaEntrada() {
  const p = S.perfil, bruto = ls.get('mt-solo', null), rec = ls.get('mt-recorde', null);
  const salvo = bruto && bruto.v === E.VERSAO_ESTADO && bruto.estados?.eu && !bruto.estados.eu.fim ? bruto : null;
  const dia = diaSP(), jogouHoje = ls.get(`mt-desafio-${dia}`, null) || S.ranking?.jogou;
  const top = S.ranking?.top?.slice(0, 3) || [];
  const casas = [
    ['partida', 'Ao passar, +30 BC de mesada.'], ['agencia', 'Depósito de 40 BC, se a conta não passar de 300 BC.'],
    ['util', 'Corda, lona e panela.'], ['exp', 'Mapa, bússola e lanterna.'], ['enf', 'Kit primeiros socorros.'],
    ['pedagio', 'De 2 a 12 BC para o caixa do evento. Em sala, quem para primeiro vira guardião da ponte e ganha 3 BC por pedágio pago ali.'], ['bussola', 'Carta de sorte com uma pergunta.'],
    ['tempestade', 'Carta de revés com uma pergunta.'], ['perdido', 'Pague 10 BC ou arrisque o dado: de 4 a 6 acha a trilha de graça.'],
    ['fogo', 'Mais 20 BC e uma fogueira na tela.'],
  ];
  return `
  <section class="hero"><div class="wrap">
    <div class="row" style="justify-content:space-between"><div class="eyebrow" style="color:var(--sun)">Jogo de treino da conta digital</div>${botaoSom()}</div>
    <h1>Mercado da <span>Trilha</span></h1>
    <p>Monte o Kit de Acampamento gastando BadenCoin (BC) nas barracas. Confira cada gasto, acerte as cartas e termine com o maior número de pontos.</p>
  </div></section>
  <div class="wrap entrada">
    <div class="box">
      <h2>Quem vai jogar?</h2>
      <label class="f">Apelido<input type="text" id="apelido" maxlength="20" autocomplete="nickname" placeholder="Ex.: Lobo Veloz" value="${esc(p.apelido)}"></label>
      <div class="stack" style="gap:6px"><span class="f" style="font-weight:600;font-size:.9rem">Escolha a sua ficha</span>
        <div class="fichas" role="radiogroup" aria-label="Fichas">${E.FICHAS.map((f) => `<button type="button" class="ficha-op" role="radio" aria-checked="${p.ficha === f.id}" data-ficha="${f.id}" title="${esc(f.nome)}"><img src="${fichaSrc(f.id)}" alt="${esc(f.nome)}"></button>`).join('')}</div>
        <span class="note" id="fichaNome">${esc(fichaNome(p.ficha))}</span>
      </div>
      <label class="f" style="max-width:340px">Duração (jogo sozinho e sala com código)<select id="rodadas">${E.RODADAS_OPCOES.map((n) => `<option value="${n}" ${n === S.rodadas ? 'selected' : ''}>${n} rodadas${n === E.RODADAS_PADRAO ? ' (padrão)' : ''}</option>`).join('')}</select></label>
    </div>
    <div class="modos">
      <div class="modo" style="--t:var(--c-util)"><h3>Jogar sozinho</h3><p class="note">Contra 3 rivais virtuais, na hora. Funciona mesmo sem internet depois de aberto.</p>
        <button class="btn big primary" id="solo">Jogar sozinho</button>
        ${salvo ? `<button class="btn" id="continuar" data-modo="${salvo.modo}">${salvo.modo === 'desafio' ? 'Continuar o desafio do dia' : `Continuar partida (rodada ${E.rodadaAtual(salvo.estados.eu)} de ${salvo.estados.eu.rodadas})`}</button>` : ''}</div>
      <div class="modo" style="--t:var(--c-agencia)"><h3>Desafio do dia</h3><p class="note">A mesma partida para todo mundo hoje (${dia.split('-').reverse().join('/')}). A primeira tentativa vale para o placar do dia.</p>
        <button class="btn big primary" id="desafio">${jogouHoje ? 'Treinar o desafio de hoje' : 'Jogar o desafio de hoje'}</button>
        ${top.length ? `<p class="note">Placar de hoje: ${top.map((x, i) => `${i + 1}º ${esc(x.apelido)} (${x.pontos})`).join(' · ')}</p>` : ''}</div>
      <div class="modo" style="--t:var(--c-bussola)"><h3>Entrar com código</h3><p class="note">Alguém criou a sala e passou o código de 5 letras.</p>
        <div class="row"><input type="text" id="codigo" maxlength="5" placeholder="Código" style="text-transform:uppercase;flex:1;min-width:7em" autocapitalize="characters" ${S.online ? '' : 'disabled'}><button class="btn primary" id="entrarCod" ${S.online ? '' : 'disabled'}>Entrar</button></div>
        <button class="btn sm" id="criar" ${S.online ? '' : 'disabled'}>Criar uma sala e receber o código</button></div>
      <div class="modo" style="--t:var(--c-fogo)"><h3>Sala de espera</h3><p class="note">Entre na fila e jogue com quem estiver esperando: até 8 jogadores, 12 rodadas, todos juntos.</p>
        <button class="btn big primary" id="fila" ${S.online ? '' : 'disabled'}>Entrar na fila</button></div>
    </div>
    ${S.online ? '' : '<p class="note">Sem conexão com o servidor: as salas ficam indisponíveis, mas você pode jogar sozinho.</p>'}
    ${rec ? `<p class="note">Seu recorde jogando sozinho: <b>${rec.pontos} pts</b>.</p>` : ''}
    <div class="row minhas"><b>Minhas insígnias</b> ${S.insignias.length ? S.insignias.slice(0, 12).map((i) => seloHtml(i)).join('') : '<span class="note">Nenhuma ainda: jogue uma partida até o fim.</span>'}<button class="btn sm" id="trilha">Minha trilha</button></div>
    <details><summary>Como funciona cada casa</summary>
      <div class="casas">${casas.map(([k, t]) => `<div class="casa-info" style="--t:var(--c-${k})">${ic(k)}<b>${E.CASAS[k].nome}</b><span>${t}</span></div>`).join('')}</div>
      <p class="note" style="margin-top:10px">Pontos: 10 por item do kit, +20 pelo kit completo, +10 por carta acertada, 1 pt a cada 10 BC que sobrarem, o bônus da meta secreta e o Canivete do leilão. A cada 3 rodadas há um evento, anunciado antes; cada item do kit protege de um revés, e nas últimas rodadas créditos e cartas certas valem em dobro. Antes de rolar, você escolhe: rolar de graça, pagar 5 BC pelo dado duplo ou ajudar no acampamento e ganhar 15 BC. Acertar uma carta de Tempestade evita o revés. Desempate: saldo final, depois cartas acertadas.</p>
    </details>
  </div>
  <footer class="wrap rodape"><span class="tb">Um jogo do Trilha HUB</span>${linkHub('entrada', 'Conheça o Trilha HUB')}</footer>`;
}

function ligarEntrada() {
  $('#apelido').addEventListener('input', (e) => { S.perfil.apelido = e.target.value; });
  app.querySelectorAll('[data-ficha]').forEach((b) => b.addEventListener('click', () => {
    S.perfil.ficha = b.dataset.ficha;
    app.querySelectorAll('[data-ficha]').forEach((x) => x.setAttribute('aria-checked', x === b));
    $('#fichaNome').textContent = fichaNome(S.perfil.ficha);
  }));
  $('#rodadas').addEventListener('change', (e) => { S.rodadas = Number(e.target.value); });
  $('#solo').addEventListener('click', () => jogarSozinho(false));
  $('#continuar')?.addEventListener('click', (e) => jogarSozinho(true, e.currentTarget.dataset.modo));
  $('#desafio').addEventListener('click', jogarDesafio);
  $('#trilha').addEventListener('click', abrirTrilha);
  $('#entrarCod').addEventListener('click', () => entrarComCodigo($('#codigo').value));
  $('#codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarComCodigo(e.target.value); });
  $('#criar').addEventListener('click', criarSala);
  $('#fila').addEventListener('click', entrarNaFila);
}

// ---------- Minha trilha (E3) ----------
const MODOS = { solo: 'Sozinho', desafio: 'Desafio do dia', espera: 'Sala de espera', codigo: 'Sala com código' };
async function abrirTrilha() {
  S.trilha = null; ir('trilha');
  try {
    S.trilha = await api('/api/minha-trilha');
    mesclarInsignias(S.trilha.insignias.map((i) => i.id));
  } catch {
    // sem rede ou sem apelido no servidor: mostra o que está guardado no aparelho
    S.trilha = { offline: true, partidas: ls.get('mt-historico', []),
      recordes: { solo: ls.get('mt-recorde', null)?.pontos, desafio: ls.get('mt-recorde-desafio', null)?.pontos }, insignias: [] };
  }
  render();
}
function telaTrilha() {
  const t = S.trilha, ganhas = new Set(S.insignias);
  const corpo = !t ? '<p class="muted">Carregando…</p>' : `
    <div class="box"><div class="eyebrow">Recordes</div><div class="recordes">${Object.entries(MODOS).map(([k, nome]) => `<div class="recorde-c"><span class="note">${nome}</span><b>${t.recordes?.[k] != null ? `${t.recordes[k]} pts` : '—'}</b></div>`).join('')}</div></div>
    <div class="box"><div class="eyebrow">Insígnias · ${E.INSIGNIAS.filter((i) => ganhas.has(i.id)).length} de ${E.INSIGNIAS.length}</div>
      <div class="insignias">${E.INSIGNIAS.map((i) => `<div class="insignia${ganhas.has(i.id) ? '' : ' off'}">${seloHtml(i.id, !ganhas.has(i.id))}<div><b>${esc(i.nome)}</b><span class="note">${esc(i.desc)}</span></div></div>`).join('')}</div></div>
    <div class="box"><div class="eyebrow">Últimas partidas</div>${t.partidas.length ? `<table class="extrato">${t.partidas.map((p) => `<tr><td>${MODOS[p.modo] || p.modo}</td><td class="v">${p.pontos} pts</td><td class="v muted">${p.saldo} BC</td><td class="v muted">${new Date(p.quando).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</table>` : '<p class="note">Nenhuma partida terminada ainda.</p>'}
      ${t.offline ? '<p class="note">Sem conexão: mostrando só o que está neste aparelho.</p>' : ''}</div>`;
  return `${topo(`<span class="chip">Minha trilha</span><span class="sp"></span>${botaoSom()}<button class="btn sm" id="voltarTrilha">Voltar</button>`)}
  <div class="wrap trilha stack">${corpo}</div>`;
}
function ligarTrilha() { $('#voltarTrilha')?.addEventListener('click', () => { S.trilha = null; ir('entrada'); }); }

function telaFila() {
  const f = S.fila, js = f?.jogadores || [], max = f?.max || 8;
  const vagas = Math.max(0, Math.min(max, Math.max(2, js.length + 1)) - js.length);
  return `${topo(`<span class="chip">Sala de espera</span><span class="sp"></span>${botaoSom()}<button class="btn sm" id="sairFila">Sair da fila</button>`)}
  <div class="wrap fila">
    <div class="eyebrow">Sala de espera</div>
    <h2>${f?.inicioEm ? 'A partida começa em' : 'Esperando mais um jogador'}</h2>
    ${f?.inicioEm ? '<div class="contagem" id="contagem">--</div>' : '<p class="muted">Com 2 jogadores na fila começa uma contagem de 80 s. Com 8, a partida começa na hora.</p>'}
    <div class="fila-jogs">${js.map((j) => `<div class="fila-j"><img src="${fichaSrc(j.ficha)}" alt="${esc(fichaNome(j.ficha))}">${esc(j.apelido)}${j.eu ? ' (você)' : ''}</div>`).join('')}${'<div class="fila-j vazio"><div class="vaga"></div>vaga</div>'.repeat(vagas)}</div>
    <p class="note">${js.length} de ${max} na fila. Partida de 12 rodadas, com 45 s por rodada.</p>
    <div class="dica" id="dica">${DICAS[Math.floor(Date.now() / 7000) % DICAS.length]}</div>
    <div class="row"><button class="btn" id="filaSolo">Cansou de esperar? Jogar sozinho</button></div>
  </div>`;
}

function ligarFila() {
  $('#sairFila').addEventListener('click', sairDaFila);
  $('#filaSolo').addEventListener('click', () => { enviar({ t: 'fila_sair' }); jogarSozinho(false); });
}

// Tabuleiro: 20 casas no perímetro de uma grade 6×6, sentido horário a partir do canto inferior direito.
function posCasa(i) {
  if (i <= 5) return [6, 6 - i];
  if (i <= 10) return [6 - (i - 5), 1];
  if (i <= 15) return [1, 1 + (i - 10)];
  return [1 + (i - 15), 6];
}

// D0: o tabuleiro e os peões são montados uma vez; depois só os painéis são redesenhados.
function montarTabuleiro() {
  const cells = E.TABULEIRO.map((k, i) => {
    const [r, c] = posCasa(i);
    return `<div class="cell" data-casa="${i}" style="grid-row:${r};grid-column:${c};--t:var(--c-${k})" title="${E.CASAS[k].nome}">${ic(k)}<span class="lbl">${E.CASAS[k].nome}</span><span class="guardiao" hidden></span><span class="farol"></span></div>`;
  }).join('');
  return `<div class="board" id="board" aria-label="Tabuleiro">${cells}
    <div class="centro"><div class="nome">Mercado<br>da <span>Trilha</span></div>
      <div class="dados" id="dados"></div>
      <p class="note" id="nota"></p></div>
    <div id="peoes" class="peoes-camada" aria-hidden="true"></div></div>`;
}

// Casas fechadas, feira, casa atual e guardião das pontes mudam sem refazer o tabuleiro.
function atualizarCasas(st) {
  E.TABULEIRO.forEach((k, i) => {
    const c = celula(i); if (!c) return;
    c.classList.toggle('fechada', !!(E.CASAS[k].loja && E.lojaFechada(st, k)));
    c.classList.toggle('feira', !!(E.CASAS[k].loja && E.descontoFeira(st, k)));
    c.classList.toggle('aqui', st.pos === i);
  });
  $('#board')?.classList.toggle('noite', !st.fim && E.noite(st));
}
function atualizarPontes(placar = S.placar) {
  E.TABULEIRO.forEach((k, i) => {
    const c = celula(i); if (!c || k !== 'pedagio') return;
    const g = c.querySelector('.guardiao'), dono = placar.find((p) => p.ordem === S.pontes[i]);
    g.hidden = !dono;
    if (dono) {
      g.style.setProperty('--pc', dono.cor);
      g.title = `Guardião da ponte: ${dono.apelido}`;
      const src = fichaSrc(dono.ficha);
      if (g.firstChild?.getAttribute?.('src') !== src) g.innerHTML = `<img src="${src}" alt="Guardião: ${esc(dono.apelido)}">`;
    }
  });
}
function atualizarCentro(st) {
  const box = $('#dados'), nota = $('#nota');
  if (nota) nota.textContent = st.ultimo || 'Escolha como jogar a rodada.';
  if (!box || box.classList.contains('rolando')) return;
  const dados = st.pend?.tipo === 'dado' ? st.pend.dados : st.dado ? [st.dado] : [5];
  box.innerHTML = dados.map((v) => dadoHtml(v)).join('');
}

function blocoUltimo(st) {
  if (!st.resposta) return st.ultimo ? `<p>${esc(st.ultimo)}</p>` : '';
  const c = E.cartaMostrada(st, st.resposta.carta);
  const titulo = st.resposta.ok ? `Acertou! +${E.PTS_CARTA} pts.${st.resposta.evitou ? ' Você evitou o revés.' : ''}` : 'Não foi dessa vez.';
  return `<div class="${st.resposta.ok ? 'okmsg brilho' : 'erro'}"><b>${titulo}</b> ${esc(c.porque)}</div>
    ${c.app ? `<p class="app-linha">${esc(c.app)} ${linkHub('carta', 'Conheça')}</p>` : ''}`;
}

function painel(st) {
  const espera = S.modo === 'sala' && S.sala?.tipo === 'espera', trava = S.aguardando ? 'disabled' : '';
  if (st.fim) {
    return `<div class="painel" style="--t:var(--sun)"><div class="tag">Fim do mercado</div><h3>Você completou as ${st.rodadas} rodadas</h3><p>${E.pontuacao(st).total} pts.</p><button class="btn primary" id="verRes">Ver resultado</button></div>`;
  }
  if (st.pend) {
    const k = st.pend.tipo === 'loja' ? st.pend.loja : st.pend.tipo === 'carta' ? E.cartaPorId(st.pend.carta).tipo : st.pend.tipo === 'dado' ? 'partida' : st.pend.tipo;
    let corpo = '', titulo = '';
    if (st.pend.tipo === 'dado') {
      const [a, b] = st.pend.dados;
      titulo = 'Dado duplo';
      corpo = `<p>Saiu <b>${a}</b> e <b>${b}</b>. Com qual dado você quer andar?</p>
        <div class="duplo">${[a, b].map((v, i) => `<button class="btn dado-esc" data-esc="${i}" ${trava}>${dadoHtml(v)}<span>Andar ${v} ${v === 1 ? 'casa' : 'casas'}</span></button>`).join('')}</div>`;
    } else if (st.pend.tipo === 'loja') {
      titulo = E.CASAS[st.pend.loja].nome;
      const itens = E.ITENS.filter((i) => i.loja === st.pend.loja);
      const sel = Object.keys(S.carrinho).filter((id) => S.carrinho[id]);
      const { total } = E.totalCompra(st, sel);
      const feira = E.descontoFeira(st, st.pend.loja);
      corpo = `${feira ? `<div class="okmsg">Feira! ${feira} BC de desconto em cada item.</div>` : ''}
        ${st.desconto ? `<div class="okmsg">Promoção: ${st.desconto} BC de desconto nesta compra.</div>` : ''}
        ${st.extra ? `<div class="alerta">O lojista está distraído: a compra vai custar ${st.extra} BC a mais. Confira o aviso de gasto.</div>` : ''}
        <div class="itens">${itens.map((i) => { const tem = st.kit.includes(i.id), pr = E.precoItem(st, i);
          return `<label class="item${tem ? ' tem' : ''}"><span class="row"><input type="checkbox" data-item="${i.id}" ${tem ? 'disabled checked' : S.carrinho[i.id] ? 'checked' : ''}>${i.nome}${tem ? ' · já no kit' : ''}</span><span>${pr !== i.preco ? `<s>${i.preco}</s> ` : ''}${bc(pr)}</span></label>`; }).join('')}</div>
        <div class="total"><span>Total · saldo ${bc(st.saldo)}</span><b>${bc(total)}</b></div>
        ${S.erro ? `<div class="erro">${esc(S.erro)}</div>` : ''}
        <div class="row"><button class="btn primary" id="pagarLoja" ${sel.length && !S.aguardando ? '' : 'disabled'}>Pagar ${bc(total)}</button><button class="btn" id="sairLoja" ${trava}>Sair sem comprar</button></div>`;
    } else if (st.pend.tipo === 'carta') {
      const c = E.cartaMostrada(st, st.pend.carta);
      titulo = E.CASAS[c.tipo].nome;
      corpo = `<div class="carta" style="--t:var(--c-${c.tipo})"><span class="tag">Carta ${E.CASAS[c.tipo].nome}${c.sala ? ' · vale para a sala toda' : ''}</span><strong>${esc(c.titulo)}</strong><span>${esc(c.historia)}</span></div>
        <p><b>${esc(c.pergunta)}</b></p>
        ${c.tipo === 'tempestade' ? '<p class="note">Acertar a pergunta evita o revés.</p>' : ''}
        <div class="opcoes">${c.opcoes.map((o, i) => `<button class="opcao" data-resp="${i}" ${trava}>${esc(o)}</button>`).join('')}</div>`;
    } else if (st.pend.tipo === 'pedagio') {
      titulo = E.CASAS.pedagio.nome;
      const g = st.pend.guardiaoApelido;
      corpo = `<p>O pedágio hoje custa <b>${bc(st.pend.valor)}</b> e vai para o caixa do evento.</p>
        ${S.modo === 'sala' ? `<p class="note">${g ? `Você tirou a ponte de ${esc(g)}, que ganha ${E.GRATIFICACAO} BC por este pedágio. ` : ''}Agora você é o guardião desta ponte e ganha ${E.GRATIFICACAO} BC de quem pagar aqui.</p>` : ''}
        ${st.saldo < st.pend.valor ? `<div class="alerta">Seu saldo (${st.saldo} BC) não cobre: o pagamento será recusado e você perde a próxima rodada.</div>` : ''}
        <div class="row"><button class="btn primary" id="pagar" ${trava}>Pagar ${bc(st.pend.valor)}</button></div>`;
    } else if (st.pend.tipo === 'perdido') {
      titulo = E.CASAS.perdido.nome;
      corpo = `<p>Você se perdeu. Pague <b>${bc(st.pend.valor)}</b> e siga em frente, ou arrisque: role o dado.</p>
        <p class="note">De 4 a 6 você acha a trilha de graça. De 1 a 3 você perde a próxima rodada.</p>
        <div class="row"><button class="btn primary" id="pagar" ${st.saldo < st.pend.valor || S.aguardando ? 'disabled' : ''}>Pagar ${bc(st.pend.valor)}</button><button class="btn" id="arriscar" ${trava}>${ic('dado')} Arriscar</button></div>`;
    }
    return `<div class="painel" style="--t:var(--c-${k})"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas}${st.dado ? ` · tirou ${st.dado}` : ''}</div>
      <div class="ptitulo">${ic(k)}<h3>${titulo}</h3></div>${corpo}</div>`;
  }
  if (espera && st.rolou) {
    const prontos = S.placar.filter((p) => p.feito || p.fim).length;
    return `<div class="painel" style="--t:var(--sun)"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas}</div>${blocoUltimo(st)}
      <div class="espera-msg"><span class="pulso"></span><span>Aguardando os outros jogadores (${prontos} de ${S.placar.length} prontos).</span></div></div>`;
  }
  const op = E.opcoesDaRodada(st);
  return `<div class="painel" style="--t:var(--sun)"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas}${espera ? ' · aberta para todos' : ''}</div>
    ${blocoUltimo(st)}
    ${st.skip ? '<p class="note">Você está parado: esta rodada só passa.</p>' : '<p><b>Como você quer jogar esta rodada?</b></p>'}
    <div class="escolhas">
      <button class="btn big primary" id="rolar" ${trava}><span>${ic('dado')}Rolar o dado</span><small>Grátis</small></button>
      ${st.skip ? '' : `<button class="btn big" id="duplo" ${op.duplo && !S.aguardando ? '' : 'disabled'}>Dado duplo<small>${st.duploGratis > 0 ? 'Grátis, graças à Bússola' : `Custa ${E.DADO_DUPLO_CUSTO} BC`} · rola dois e fica com um</small></button>
      <button class="btn big" id="ajudar" ${op.ajudar && !S.aguardando ? '' : 'disabled'}>Ajudar no acampamento<small>Não anda · ganha ${E.AJUDA_GANHO} BC</small></button>`}
    </div></div>`;
}

function conta(st, cor) {
  const avisos = st.avisos.slice().reverse().slice(0, 8);
  const meta = E.METAS.find((m) => m.id === st.meta);
  return `<div class="conta" id="conta"><header style="--pc:${cor}"><img src="${fichaSrc(st.ficha)}" alt="${esc(fichaNome(st.ficha))}"><span class="nm">${esc(st.apelido)}<span class="sub">Conta BadenCoin · inspirada no Trilha HUB</span></span><span class="bc muted">${E.pontuacao(st).total} pts</span></header>
    <div class="saldo">${ic('moeda')}<b id="saldoNum">${st.saldo}</b><span>BC</span></div>
    <div class="cbody">
      <div><div class="eyebrow" style="margin-bottom:6px">Kit de Acampamento · ${st.kit.length}/7</div><div class="kitrow">${E.ITENS.map((i) => `<span class="kit${st.kit.includes(i.id) ? ' on' : ''}" style="--t:var(--c-${i.loja})">${i.nome}</span>`).join('')}</div></div>
      ${meta ? `<div class="meta-card"><div class="eyebrow">Sua meta secreta</div><div><b>${esc(meta.nome)}</b> <span class="muted">· +${meta.pts} pts no fim</span></div><span class="note">Só você vê. Os outros descobrem no fim da partida.</span></div>` : ''}
      <div><div class="eyebrow" style="margin-bottom:6px">Avisos da conta</div><div class="avisos">${avisos.map((a) => `<div class="aviso ${a.tipo}">${esc(a.texto)}</div>`).join('')}</div></div>
      <details><summary>Extrato (últimas 10)</summary><table class="extrato">${st.extrato.slice().reverse().map((x) => `<tr><td>${esc(x.d)}</td><td class="v">${x.v > 0 ? '+' : ''}${x.v} BC</td><td class="v muted">${x.s} BC</td></tr>`).join('')}</table></details>
    </div></div>`;
}

function placarHtml() {
  const agora = Date.now();
  return `<div class="placar">${S.placar.map((p, i) => {
    const seta = S.setas[p.ordem], d = S.delta[p.ordem];
    return `<div class="pl${p.eu ? ' eu' : ''}" style="--pc:${p.cor}"><span class="pos">${i + 1}${seta ? `<span class="seta ${seta}" aria-label="${seta === 'up' ? 'subiu' : 'desceu'}">${seta === 'up' ? '▲' : '▼'}</span>` : ''}</span><img src="${fichaSrc(p.ficha)}" alt="${esc(fichaNome(p.ficha))}"><div><div class="nm">${esc(p.apelido)}${p.eu ? ' (você)' : ''} ${(p.insignias || []).slice(0, 3).map((i) => seloHtml(i)).join('')}</div><div class="meta">${p.patrulha != null ? `${esc(S.sala?.patrulhas?.find((x) => x.n === p.patrulha)?.nome || '')} · ` : ''}Kit ${p.kit}/7 · rodada ${Math.min(p.rodada + (p.fim ? 0 : 1), eu()?.rodadas || 12)}${p.fim ? ' · terminou' : ''}${S.sala?.tipo === 'espera' && p.feito && !p.fim ? ' · pronto' : ''} · ${p.saldo} BC</div></div><span class="pts">${d && d.ate > agora ? `<span class="delta">+${d.v}</span>` : ''}${p.pontos} pts</span></div>`;
  }).join('')}</div>`;
}

function patrulhasHtml() {
  const ps = S.sala?.patrulhas;
  if (!ps) return '';
  return `<div class="eyebrow">Patrulhas · média de pontos</div><div class="placar">${ps.map((x, i) => `<div class="pl"><span class="pos">${i + 1}</span><b>${esc(x.nome)}</b><span class="note">${x.membros} jogador(es)</span><span class="pts">${x.media} pts</span></div>`).join('')}</div>`;
}

function anfitriao() {
  const s = S.sala;
  if (!s || s.tipo !== 'codigo' || !s.souAnfitriao) return '';
  return `<div class="painel anfitriao" style="--t:var(--c-bussola)"><div class="tag">Painel do anfitrião</div>
    <div class="row" style="justify-content:space-between"><span class="codigo">${esc(s.codigo)}</span><button class="btn sm" id="copiar">Copiar código</button></div>
    <p class="note">Mande este código pelo grupo. ${s.jogando} jogando, ${s.terminaram} terminaram, ${s.total} de ${s.max} na sala.</p>
    ${s.status === 'aberta' ? `<div class="mestre"><div class="eyebrow">Mestre do mercado</div><div class="row">${E.MESTRE_EVENTOS.map((t) => `<button class="btn sm" data-mestre="${t}">${E.EVENTOS[t].nome}</button>`).join('')}</div><p class="note">Chama o evento para a sala toda agora, na rodada em que cada um estiver.</p></div>
    <div class="mestre"><div class="eyebrow">Patrulhas</div><div class="row"><select id="nPatrulhas" aria-label="Número de patrulhas">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === (S.nPatrulhas || 2) ? 'selected' : ''}>${n} patrulhas</option>`).join('')}</select><button class="btn sm" id="sortear">${s.patrulhas ? 'Sortear de novo' : 'Sortear'}</button></div><p class="note">O sistema sorteia quem fica em cada uma. O placar mostra a média de pontos por patrulha.</p></div>` : ''}
    ${s.podeLeilao ? `<div class="row"><button class="btn sm" id="abrirLeilao">Abrir o leilão do Canivete</button></div><p class="note">Todos dão um lance fechado por 10 s; o Canivete vale +${E.CANIVETE_PTS} pts. Só uma vez por sala.</p>` : ''}
    ${s.status === 'aberta' ? `<div class="row"><button class="btn sm danger" id="encerrar">${S.confirmarEncerrar ? 'Confirmar: encerrar a sala' : 'Encerrar sala'}</button>${S.confirmarEncerrar ? '<button class="btn sm" id="cancelarEnc">Cancelar</button>' : ''}</div>` : '<p class="note">Sala encerrada.</p>'}
    <div class="promo"><b>Leve o Trilha HUB para o seu grupo</b><span class="note">A carteira de evento de verdade: recarga por Pix, pagamento por QR ou pulseira e avisos de gasto no WhatsApp dos responsáveis.</span>${linkHub('anfitriao', 'Ver como funciona')}</div></div>`;
}

function muralHtml() {
  return S.mural.slice().reverse().map((m) => `<li><span class="dot" style="--pc:${m.cor}"></span><span>${esc(m.texto)}</span></li>`).join('') || '<li>Nada ainda.</li>';
}

function barraTopo(st) {
  const s = S.sala, espera = S.modo === 'sala' && s?.tipo === 'espera';
  const modoChip = S.modo === 'solo' ? '<span class="chip">Sozinho</span>' : espera ? '<span class="chip">Sala de espera</span>' : `<span class="chip">Sala <b>${esc(s?.codigo)}</b></span>`;
  return topo(`${modoChip}<span class="chip">Rodada <b>${E.rodadaAtual(st)}/${st.rodadas}</b></span><span class="sp"></span>${botaoSom()}<button class="btn sm" id="sair">${S.modo === 'solo' ? 'Pausar' : 'Sair'}</button>${espera && s.status === 'em_jogo' ? '<div class="timer" id="timer"><i></i></div><div class="pend-top" id="pend"></div>' : ''}`);
}

function reacoesHtml() {
  return `<div class="reacoes" id="reacoes" role="group" aria-label="Reações rápidas">${E.REACOES.map((r, i) => `<button class="btn sm" data-reacao="${i}">${r}</button>`).join('')}</div>`;
}

function montarJogo() {
  const sala = S.modo === 'sala', contraRivais = S.modo === 'solo' && S.solo?.modo === 'solo';
  return `<div id="topo-jogo"></div>
  <div class="wrap jogo">
    <div class="j-main">
      <div class="boardbox">${montarTabuleiro()}${sala ? reacoesHtml() : ''}</div>
      <div class="side"><div id="painel"></div><div id="conta-box"></div></div>
    </div>
    ${sala ? `<div class="dois"><div class="stack"><div class="eyebrow">Placar da sala</div><div id="placar"></div><div id="patrulhas"></div><div id="anfitriao"></div></div>
      <div class="stack"><div class="eyebrow">Mural</div><ul class="mural" id="mural"></ul></div></div>` : ''}
    ${contraRivais ? '<div class="stack"><div class="eyebrow">Placar contra os rivais</div><div id="placar"></div></div>' : ''}
  </div>`;
}

// A5 e C3: votação do próximo evento e leilão do Canivete, abertos por 10 s.
// Na sala de espera ocupam o lugar do painel da rodada; nas salas com código vão por cima dele.
function painelJanela() {
  const s = S.sala, st = eu();
  if (!s || (!s.voto && !s.leilao) || !st || st.fim) return { html: '', exclusivo: false };
  let html = '';
  if (s.voto) {
    const v = s.voto;
    html += `<div class="painel janela" style="--t:var(--c-fogo)"><div class="tag">Votação do próximo evento · <span data-fim="${v.fimEm}"></span></div>
      <p><b>Qual evento vem na rodada ${v.rodada}?</b></p>
      <div class="opcoes">${v.opcoes.map((o, i) => `<button class="opcao${v.meuVoto === i ? ' escolhida' : ''}" data-voto="${i}"><b>${esc(o.nome)}</b><br><span class="note">${esc(o.texto)}</span></button>`).join('')}</div>
      <p class="note">${v.meuVoto != null ? 'Voto registrado. Você pode trocar até o tempo acabar. ' : ''}${v.votaram} voto(s). Empate sorteia.</p></div>`;
  }
  if (s.leilao) {
    const l = s.leilao;
    html += `<div class="painel janela" style="--t:var(--c-partida)"><div class="tag">Leilão do Canivete · <span data-fim="${l.fimEm}"></span></div>
      <p><b>Canivete: +${l.pts} pts no fim.</b> Um lance só, fechado. Ganha o maior; no empate, quem tem menos saldo.</p>
      <div class="lances">${l.lances.map((v) => `<button class="btn${l.meuLance === v ? ' primary' : ''}" data-lance="${v}" ${v > st.saldo ? 'disabled' : ''}>${v} BC</button>`).join('')}</div>
      <p class="note">${l.meuLance != null ? `Seu lance: ${l.meuLance} BC. Você só paga se ganhar. ` : 'Você só paga se ganhar, e não dá para oferecer mais do que o saldo. '}${l.deram} lance(s).</p></div>`;
  }
  return { html, exclusivo: s.tipo === 'espera' };
}

function atualizarPainel() {
  const st = eu(); const el = $('#painel'); if (!st || !el) return;
  const j = painelJanela();
  el.innerHTML = j.html + (j.exclusivo ? '' : painel(st)); ligarPainel(); tique();
}
function atualizarMural() { const el = $('#mural'); if (el) el.innerHTML = muralHtml(); }

// Redesenha só os painéis; o tabuleiro e os peões continuam na tela.
function atualizarJogo() {
  const st = eu();
  if (S.tela !== 'jogo' || !st) return;
  const nova = !$('#board');
  if (nova) { app.innerHTML = montarJogo(); S.peaoPos = {}; ligarFixos(); }
  const topoEl = $('#topo-jogo'); topoEl.innerHTML = barraTopo(st); $('#sair')?.addEventListener('click', sairDoJogo);
  const cor = S.modo === 'sala' ? (S.eu?.cor || COR_SOLO) : COR_SOLO;
  $('#conta-box').innerHTML = conta(st, cor);
  atualizarPainel();
  if (S.modo === 'sala') {
    atualizarPlacar(); $('#patrulhas').innerHTML = patrulhasHtml(); $('#anfitriao').innerHTML = anfitriao(); atualizarMural(); ligarAnfitriao();
  } else atualizarPlacar();
  atualizarCasas(st); atualizarCentro(st); atualizarPontes();
  if (nova || !S.cenaEmCurso) sincronizarPeoes(S.placar);
  tique();
}

function telaJogo() {
  if (!eu()) return `${topo('<span class="sp"></span><button class="btn sm" id="sair">Sair</button>')}<div class="wrap jogo"><p class="muted">Carregando a sala…</p></div>`;
  return null;
}

// Ligações que valem para o jogo todo (tabuleiro e reações): feitas uma vez, quando o tabuleiro nasce.
function ligarFixos() {
  app.querySelectorAll('[data-reacao]').forEach((b) => b.addEventListener('click', () => {
    if (Date.now() < S.reacaoLivreEm) return;
    S.reacaoLivreEm = Date.now() + E.REACAO_INTERVALO_MS;
    enviar({ t: 'reagir', i: Number(b.dataset.reacao) });
    const todos = app.querySelectorAll('[data-reacao]');
    todos.forEach((x) => { x.disabled = true; });
    setTimeout(() => todos.forEach((x) => { x.disabled = false; }), E.REACAO_INTERVALO_MS);
  }));
  if (window.ResizeObserver) new ResizeObserver(() => layoutPeoes()).observe($('#board'));
}

function ligarPainel() {
  $('#rolar')?.addEventListener('click', () => acao('rolar'));
  $('#duplo')?.addEventListener('click', () => acao('dado_duplo'));
  $('#ajudar')?.addEventListener('click', () => acao('ajudar'));
  app.querySelectorAll('[data-esc]').forEach((b) => b.addEventListener('click', () => acao('escolher_dado', { i: Number(b.dataset.esc) })));
  $('#verRes')?.addEventListener('click', () => { S.verTab = false; ir('resultado'); });
  app.querySelectorAll('[data-item]').forEach((c) => c.addEventListener('change', () => { S.carrinho[c.dataset.item] = c.checked; S.erro = ''; atualizarPainel(); }));
  $('#pagarLoja')?.addEventListener('click', () => acao('comprar', { itens: Object.keys(S.carrinho).filter((k) => S.carrinho[k]) }));
  $('#sairLoja')?.addEventListener('click', () => acao('sair_loja'));
  app.querySelectorAll('[data-resp]').forEach((b) => b.addEventListener('click', () => acao('responder', { i: Number(b.dataset.resp) })));
  $('#pagar')?.addEventListener('click', () => acao('pagar'));
  $('#arriscar')?.addEventListener('click', () => acao('arriscar'));
  app.querySelectorAll('[data-voto]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'votar_evento', i: Number(b.dataset.voto) })));
  app.querySelectorAll('[data-lance]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'dar_lance', valor: Number(b.dataset.lance) })));
}

function ligarAnfitriao() {
  app.querySelectorAll('[data-mestre]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'mestre', tipo: b.dataset.mestre })));
  $('#nPatrulhas')?.addEventListener('change', (e) => { S.nPatrulhas = Number(e.target.value); });
  $('#sortear')?.addEventListener('click', () => enviar({ t: 'patrulhas', n: Number($('#nPatrulhas').value) }));
  $('#abrirLeilao')?.addEventListener('click', () => enviar({ t: 'abrir_leilao' }));
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(S.sala.codigo); toast('Código copiado.'); } catch { toast(`Código: ${S.sala.codigo}`); }
  });
  $('#encerrar')?.addEventListener('click', () => {
    if (!S.confirmarEncerrar) { S.confirmarEncerrar = true; atualizarJogo(); return; }
    S.confirmarEncerrar = false; enviar({ t: 'encerrar' });
  });
  $('#cancelarEnc')?.addEventListener('click', () => { S.confirmarEncerrar = false; atualizarJogo(); });
}

// E4: revanche. Na sala de espera, quem aceitar em 20 s joga de novo; na sala com código, o anfitrião reabre.
function revancheHtml() {
  const s = S.sala;
  if (S.modo !== 'sala' || !s) return '';
  if (s.tipo === 'espera') {
    const r = s.revanche;
    return `<div class="box"><div class="eyebrow">Revanche</div>${r ? `<p><b>${r.aceitaram}</b> jogador(es) aceitaram · <span data-fim="${r.fimEm}"></span></p>` : '<p class="note">Jogue de novo com os mesmos jogadores: entra quem aceitar em 20 s.</p>'}
      <div class="row"><button class="btn primary" id="revanche" ${r?.euAceitei ? 'disabled' : ''}>${r?.euAceitei ? 'Você aceitou' : 'Revanche'}</button></div></div>`;
  }
  if (s.revancheCodigo) {
    return `<div class="box"><div class="eyebrow">Revanche</div><p>O anfitrião reabriu a sala.</p><div class="row"><button class="btn primary" id="entrarRevanche" data-cod="${esc(s.revancheCodigo)}">Entrar na revanche</button></div></div>`;
  }
  if (s.souAnfitriao) {
    return `<div class="box"><div class="eyebrow">Revanche</div><p class="note">Reabra a sala: todos os que ainda estão no resultado são levados juntos.</p><div class="row"><button class="btn primary" id="revanche">Reabrir a sala (revanche)</button></div></div>`;
  }
  return '';
}

function telaResultado() {
  const st = eu();
  if (!st) { S.tela = 'entrada'; return telaEntrada(); }
  const p = E.pontuacao(st), sala = S.modo === 'sala', r = S.resultado, desafio = !sala && r?.modo === 'desafio';
  const pos = sala ? S.placar.findIndex((x) => x.eu) + 1 : r?.pos || 0;
  const aindaJogando = sala ? S.placar.filter((x) => !x.fim).length : 0;
  const meta = E.METAS.find((m) => m.id === st.meta), cumpriu = E.metaCumprida(st);
  const metasMesa = S.placar.filter((x) => x.meta && !x.eu).map((x) => {
    const m = E.METAS.find((k) => k.id === x.meta.id);
    return `<li><b>${esc(x.apelido)}</b>: ${esc(m?.nome || '')} · ${x.meta.ok ? `cumpriu (+${m.pts})` : 'não cumpriu'}</li>`;
  }).join('');
  const novas = sala ? (st.insignias || []) : (r?.novas || []);
  const titulo = desafio ? 'Desafio do dia' : sala ? `Você ficou em ${pos}º de ${S.placar.length}` : S.novoRecorde ? '<span class="recorde">Novo recorde!</span>' : `Você ficou em ${pos}º de ${S.placar.length}`;
  const top = S.ranking?.top || [];
  return `${topo(`<span class="sp"></span>${botaoSom()}<button class="btn sm" id="inicio">Voltar ao início</button>`)}
  <div class="wrap resultado">
    <div class="eyebrow">Fim do mercado${desafio ? (r.treino ? ' · treino' : ' · primeira tentativa do dia') : ''}</div>
    <h2>${titulo}</h2>
    ${desafio ? `<p class="note">${r.treino ? 'Você já tinha jogado o desafio de hoje: esta partida foi treino e não entra no placar do dia.' : 'Esta é a sua primeira tentativa de hoje: ela vale para o placar do dia.'}</p>` : ''}
    <div class="box pontos">
      <div class="pt"><span>Itens do kit (${st.kit.length} × 10)</span><b>${p.itens}</b></div>
      <div class="pt"><span>Kit completo</span><b>${p.kitCompleto}</b></div>
      <div class="pt"><span>Cartas acertadas (${st.acertos + st.acertosNoite} × ${E.PTS_CARTA})</span><b>${p.cartas}</b></div>
      <div class="pt"><span>Saldo final (${st.saldo} BC ÷ 10)</span><b>${p.saldo}</b></div>
      <div class="pt"><span>Meta secreta: ${esc(meta?.nome || '')} · ${cumpriu ? 'cumprida' : 'não cumprida'}</span><b>${p.meta}</b></div>
      ${p.canivete ? `<div class="pt"><span>Canivete do leilão</span><b>${p.canivete}</b></div>` : ''}
      <div class="pt total"><span>Total</span><b>${p.total} pts</b></div>
    </div>
    <div class="box"><div class="eyebrow">Insígnias desta partida</div>
      ${novas.length ? `<div class="insignias">${novas.map((i) => `<div class="insignia">${seloHtml(i)}<div><b>${esc(E.INSIGNIAS.find((x) => x.id === i).nome)}</b><span class="note">${esc(E.INSIGNIAS.find((x) => x.id === i).desc)}</span></div></div>`).join('')}</div>` : '<p class="note">Nenhuma insígnia desta vez. Veja como ganhar cada uma em Minha trilha.</p>'}
      <div class="row"><button class="btn sm" id="trilha">Minha trilha</button></div></div>
    ${metasMesa ? `<div class="box"><div class="eyebrow">Metas dos outros jogadores</div><ul class="metas-sala">${metasMesa}</ul></div>` : ''}
    ${S.placar.length > 1 ? `<div class="stack"><div class="eyebrow">Placar${aindaJogando ? ` · ${aindaJogando} ainda jogando` : ''}</div>${placarHtml()}${sala ? patrulhasHtml() : ''}</div>` : ''}
    ${desafio && top.length ? `<div class="box"><div class="eyebrow">Placar do dia · ${S.ranking.total} jogador(es)</div><table class="extrato">${top.slice(0, 5).map((x, i) => `<tr><td>${i + 1}º ${esc(x.apelido)}${x.eu ? ' (você)' : ''}</td><td class="v">${x.pontos} pts</td></tr>`).join('')}</table>${r.valeu === false ? '<p class="note">A sua primeira tentativa de hoje já estava no placar.</p>' : ''}</div>` : ''}
    ${revancheHtml()}
    <div class="promo"><b>Para chefes e responsáveis</b><span>No próximo acampamento, o grupo pode usar a carteira de evento do Trilha HUB: os jovens pagam com QR ou pulseira e os responsáveis acompanham cada gasto pelo WhatsApp.</span>${linkHub('resultado', 'Saiba mais sobre o Trilha HUB')}</div>
    <div class="row"><button class="btn primary" id="denovo">${sala && S.sala?.tipo === 'espera' ? 'Entrar na fila de novo' : desafio ? 'Treinar de novo' : 'Jogar de novo'}</button><button class="btn" id="inicio2">Voltar ao início</button>${sala ? '<button class="btn" id="verTab">Ver o tabuleiro</button>' : ''}</div>
  </div>`;
}

function ligarResultado() {
  const voltar = () => { if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); } S.modo = null; S.peaoPos = {}; S.eu = null; S.resultado = null; S.confetou = false; ir('entrada'); };
  $('#inicio')?.addEventListener('click', voltar);
  $('#inicio2')?.addEventListener('click', voltar);
  $('#trilha')?.addEventListener('click', abrirTrilha);
  $('#revanche')?.addEventListener('click', () => enviar({ t: 'revanche' }));
  $('#entrarRevanche')?.addEventListener('click', (e) => entrarNaRevanche(e.currentTarget.dataset.cod));
  $('#verTab')?.addEventListener('click', () => { S.verTab = true; S.tela = 'jogo'; render(); });
  $('#denovo')?.addEventListener('click', () => {
    S.confetou = false;
    if (S.modo === 'sala' && S.sala?.tipo === 'espera') { voltar(); entrarNaFila(); }
    else if (S.modo === 'sala') voltar();
    else jogarSozinho(false, S.resultado?.modo === 'desafio' ? 'desafio' : 'solo');
  });
  // D6: toda partida termina com uma comemoração.
  if (!S.confetou) { S.confetou = true; setTimeout(confete, 250); }
}

function render() {
  if (S.tela === 'entrada') { app.innerHTML = telaEntrada(); ligarEntrada(); }
  else if (S.tela === 'fila') { app.innerHTML = telaFila(); ligarFila(); }
  else if (S.tela === 'trilha') { app.innerHTML = telaTrilha(); ligarTrilha(); }
  else if (S.tela === 'jogo') {
    const vazio = telaJogo();
    if (vazio) { app.innerHTML = vazio; $('#sair')?.addEventListener('click', sairDoJogo); }
    else atualizarJogo();
  } else if (S.tela === 'resultado') { app.innerHTML = telaResultado(); ligarResultado(); }
  tique();
}

// Relógios (contagem da fila e tempo da rodada), sem redesenhar a tela.
function tique() {
  const agora = Date.now() + S.offset;
  const cont = $('#contagem');
  if (cont && S.fila?.inicioEm) {
    const s = Math.max(0, Math.ceil((S.fila.inicioEm - agora) / 1000));
    cont.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  const dica = $('#dica');
  if (dica) dica.textContent = DICAS[Math.floor(Date.now() / 7000) % DICAS.length];
  const tm = $('#timer');
  if (tm && S.sala?.fimRodadaEm) {
    const resto = Math.max(0, S.sala.fimRodadaEm - agora), frac = resto / (S.sala.baseMs || E.TEMPO_RODADA_S * 1000);
    tm.firstElementChild.style.width = `${Math.min(100, frac * 100)}%`;
    tm.classList.toggle('pouco', resto < 10000);
    tm.setAttribute('aria-label', `${Math.ceil(resto / 1000)} segundos para fechar a rodada`);
    const pend = $('#pend');
    if (pend) pend.textContent = resto < 10000 && S.sala.pendentes?.length ? `Ainda decidindo: ${S.sala.pendentes.join(', ')}` : '';
  }
  document.querySelectorAll('[data-fim]').forEach((el) => {
    el.textContent = `${Math.max(0, Math.ceil((Number(el.dataset.fim) - agora) / 1000))} s`;
  });
}
setInterval(tique, 250);
setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);

render();
iniciar();
