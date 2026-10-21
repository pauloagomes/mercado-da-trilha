// Mercado da Trilha — interface.
// Jogar sozinho usa o motor (engine.js) direto no navegador.
// Nas salas, o servidor é a fonte da verdade: o celular só envia jogadas e desenha o estado recebido.
import * as E from './engine.js';

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
    }
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
    if (S.tela !== 'resultado') S.tela = 'jogo';
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
  if (animar && novas.length && novas.length <= 4 && S.tela === 'jogo' && $('#board')) {
    S.cenaEmCurso = true;
    try { for (const c of novas) await animarCena(c, m); } finally { S.cenaEmCurso = false; }
  } else if (novas.length) {
    // sem animar, os avisos que mereciam toast ainda aparecem
    for (const c of novas) for (const ev of c.cena) if (ev.t === 'sala' && c.ordem === minhaOrdem(m)) toast(`${ev.de} tirou "${ev.carta}"`);
  }
  const antes = S.eu;
  S.sala = m.sala; S.eu = m.eu; S.placar = m.placar; S.mural = m.mural; S.pontes = m.pontes || {};
  if (m.sala) S.offset = m.sala.agora - Date.now();
  if (m.eu && antes && antes.pend?.tipo === 'loja' && !m.eu.pend) S.carrinho = {};
  if (S.modo === 'sala' && (m.sala.status === 'encerrada' || m.eu?.fim) && S.tela === 'jogo' && !S.verTab) S.tela = 'resultado';
  if (S.tela === 'entrada' || S.tela === 'fila') S.tela = 'jogo';
  if (S.modo === 'solo' && m.eu?.fim && S.tela === 'jogo') setTimeout(() => ir('resultado'), 900);
  S.erro = ''; S.aguardando = false;
  render();
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
    if (meu) som('errada');
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

// ---------- Ações ----------
const COR_SOLO = '#D69712';

// No jogo sozinho o motor roda aqui; a tela recebe uma cópia, no mesmo formato que o servidor manda.
function publicarSolo(cena = []) {
  const st = S.solo, snap = structuredClone(E.visaoPropria(st));
  snap.cor = COR_SOLO; snap.ordem = 0;
  empilhar({ t: 'estado', sala: null, eu: snap, placar: [{ ...E.resumoPublico(st), cor: COR_SOLO, ordem: 0, eu: true }],
    mural: [], pontes: {}, cenas: [{ n: ++S.soloN, ordem: 0, cena }] });
}

function acao(t, extra = {}) {
  if (S.aguardando) return;
  if (S.modo === 'sala') {
    S.aguardando = true; atualizarPainel();
    clearTimeout(S.aguardandoT); S.aguardandoT = setTimeout(() => { if (S.aguardando) { S.aguardando = false; atualizarPainel(); } }, 4000);
    enviar({ t, ...extra });
    return;
  }
  const st = S.solo, ctx = E.novoContexto(null);
  ctx.estados.set(0, st);
  E.esvaziarCena(st);
  const r = E.agirNaSala(ctx, 0, { t, ...extra });
  st.saida = [];
  if (r.erro) { E.esvaziarCena(st); if (st.pend?.tipo === 'loja') S.erro = r.erro; else toast(r.erro); atualizarJogo(); return; }
  S.erro = '';
  const cena = E.esvaziarCena(st);
  if (st.feito) E.fecharRodada(st);
  if (!st.pend) S.carrinho = {};
  ls.set('mt-solo', st);
  if (st.fim) {
    const pts = E.pontuacao(st).total, rec = ls.get('mt-recorde', null);
    S.novoRecorde = !rec || pts > rec.pontos;
    if (S.novoRecorde) ls.set('mt-recorde', { pontos: pts, em: Date.now() });
    ls.del('mt-solo');
  }
  S.aguardando = true; atualizarPainel();
  publicarSolo(cena);
}

async function jogarSozinho(continuar) {
  try { await registrarLocal(); } catch (e) { toast(e.message); return; }
  S.modo = 'solo';
  let salvo = continuar ? ls.get('mt-solo', null) : null;
  if (salvo && salvo.v !== E.VERSAO_ESTADO) { ls.del('mt-solo'); salvo = null; toast('O jogo foi atualizado: a partida salva foi descartada.'); }
  S.solo = salvo || E.novoJogador({ apelido: S.perfil.apelido.trim(), ficha: S.perfil.ficha, rodadas: S.rodadas, seed: Math.floor(Math.random() * 2 ** 31) });
  S.solo.saida = []; S.solo.cena = [];
  ls.set('mt-solo', S.solo);
  S.cenasN = null; S.aguardando = false; S.peaoPos = {}; pendentes.length = 0;
  S.eu = null;
  publicarSolo();
  ir('jogo');
}
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
  const p = S.perfil, salvo = ls.get('mt-solo', null), rec = ls.get('mt-recorde', null);
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
      <div class="modo" style="--t:var(--c-util)"><h3>Jogar sozinho</h3><p class="note">Na hora, sem sala. Funciona mesmo sem internet depois de aberto.</p>
        <button class="btn big primary" id="solo">Jogar sozinho</button>
        ${salvo && !salvo.fim ? `<button class="btn" id="continuar">Continuar partida (rodada ${E.rodadaAtual(salvo)} de ${salvo.rodadas})</button>` : ''}</div>
      <div class="modo" style="--t:var(--c-bussola)"><h3>Entrar com código</h3><p class="note">Alguém criou a sala e passou o código de 5 letras.</p>
        <div class="row"><input type="text" id="codigo" maxlength="5" placeholder="Código" style="text-transform:uppercase;flex:1;min-width:7em" autocapitalize="characters" ${S.online ? '' : 'disabled'}><button class="btn primary" id="entrarCod" ${S.online ? '' : 'disabled'}>Entrar</button></div>
        <button class="btn sm" id="criar" ${S.online ? '' : 'disabled'}>Criar uma sala e receber o código</button></div>
      <div class="modo" style="--t:var(--c-fogo)"><h3>Sala de espera</h3><p class="note">Entre na fila e jogue com quem estiver esperando: até 8 jogadores, 12 rodadas, todos juntos.</p>
        <button class="btn big primary" id="fila" ${S.online ? '' : 'disabled'}>Entrar na fila</button></div>
    </div>
    ${S.online ? '' : '<p class="note">Sem conexão com o servidor: as salas ficam indisponíveis, mas você pode jogar sozinho.</p>'}
    ${rec ? `<p class="note">Seu recorde jogando sozinho: <b>${rec.pontos} pts</b>.</p>` : ''}
    <details><summary>Como funciona cada casa</summary>
      <div class="casas">${casas.map(([k, t]) => `<div class="casa-info" style="--t:var(--c-${k})">${ic(k)}<b>${E.CASAS[k].nome}</b><span>${t}</span></div>`).join('')}</div>
      <p class="note" style="margin-top:10px">Pontos: 10 por item do kit, +20 pelo kit completo, +10 por carta acertada, 1 pt a cada 10 BC que sobrarem e o bônus da meta secreta. Antes de rolar, você escolhe: rolar de graça, pagar 5 BC pelo dado duplo ou ajudar no acampamento e ganhar 15 BC. Acertar uma carta de Tempestade evita o revés. Desempate: saldo final, depois cartas acertadas.</p>
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
  $('#continuar')?.addEventListener('click', () => jogarSozinho(true));
  $('#entrarCod').addEventListener('click', () => entrarComCodigo($('#codigo').value));
  $('#codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarComCodigo(e.target.value); });
  $('#criar').addEventListener('click', criarSala);
  $('#fila').addEventListener('click', entrarNaFila);
}

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
  return `<div class="${st.resposta.ok ? 'okmsg' : 'erro'}"><b>${titulo}</b> ${esc(c.porque)}</div>
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
      ${st.skip ? '' : `<button class="btn big" id="duplo" ${op.duplo && !S.aguardando ? '' : 'disabled'}>Dado duplo<small>Custa ${E.DADO_DUPLO_CUSTO} BC · rola dois e fica com um</small></button>
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
  return `<div class="placar">${S.placar.map((p, i) => `<div class="pl${p.eu ? ' eu' : ''}" style="--pc:${p.cor}"><span class="pos">${i + 1}</span><img src="${fichaSrc(p.ficha)}" alt="${esc(fichaNome(p.ficha))}"><div><div class="nm">${esc(p.apelido)}${p.eu ? ' (você)' : ''}</div><div class="meta">Kit ${p.kit}/7 · rodada ${Math.min(p.rodada + (p.fim ? 0 : 1), S.sala?.rodadas || 12)}${p.fim ? ' · terminou' : ''}${S.sala?.tipo === 'espera' && p.feito && !p.fim ? ' · pronto' : ''} · ${p.saldo} BC</div></div><span class="pts">${p.pontos} pts</span></div>`).join('')}</div>`;
}

function anfitriao() {
  const s = S.sala;
  if (!s || s.tipo !== 'codigo' || !s.souAnfitriao) return '';
  return `<div class="painel anfitriao" style="--t:var(--c-bussola)"><div class="tag">Painel do anfitrião</div>
    <div class="row" style="justify-content:space-between"><span class="codigo">${esc(s.codigo)}</span><button class="btn sm" id="copiar">Copiar código</button></div>
    <p class="note">Mande este código pelo grupo. ${s.jogando} jogando, ${s.terminaram} terminaram, ${s.total} de ${s.max} na sala.</p>
    ${s.status === 'aberta' ? `<div class="row"><button class="btn sm danger" id="encerrar">${S.confirmarEncerrar ? 'Confirmar: encerrar a sala' : 'Encerrar sala'}</button>${S.confirmarEncerrar ? '<button class="btn sm" id="cancelarEnc">Cancelar</button>' : ''}</div>` : '<p class="note">Sala encerrada.</p>'}
    <div class="promo"><b>Leve o Trilha HUB para o seu grupo</b><span class="note">A carteira de evento de verdade: recarga por Pix, pagamento por QR ou pulseira e avisos de gasto no WhatsApp dos responsáveis.</span>${linkHub('anfitriao', 'Ver como funciona')}</div></div>`;
}

function muralHtml() {
  return S.mural.slice().reverse().map((m) => `<li><span class="dot" style="--pc:${m.cor}"></span><span>${esc(m.texto)}</span></li>`).join('') || '<li>Nada ainda.</li>';
}

function barraTopo(st) {
  const s = S.sala, espera = S.modo === 'sala' && s?.tipo === 'espera';
  const modoChip = S.modo === 'solo' ? '<span class="chip">Sozinho</span>' : espera ? '<span class="chip">Sala de espera</span>' : `<span class="chip">Sala <b>${esc(s?.codigo)}</b></span>`;
  return topo(`${modoChip}<span class="chip">Rodada <b>${E.rodadaAtual(st)}/${st.rodadas}</b></span><span class="sp"></span>${botaoSom()}<button class="btn sm" id="sair">${S.modo === 'solo' ? 'Pausar' : 'Sair'}</button>${espera && s.status === 'em_jogo' ? '<div class="timer" id="timer"><i></i></div>' : ''}`);
}

function reacoesHtml() {
  return `<div class="reacoes" id="reacoes" role="group" aria-label="Reações rápidas">${E.REACOES.map((r, i) => `<button class="btn sm" data-reacao="${i}">${r}</button>`).join('')}</div>`;
}

function montarJogo() {
  const sala = S.modo === 'sala';
  return `<div id="topo-jogo"></div>
  <div class="wrap jogo">
    <div class="j-main">
      <div class="boardbox">${montarTabuleiro()}${sala ? reacoesHtml() : ''}</div>
      <div class="side"><div id="painel"></div><div id="conta-box"></div></div>
    </div>
    ${sala ? `<div class="dois"><div class="stack"><div class="eyebrow">Placar da sala</div><div id="placar"></div><div id="anfitriao"></div></div>
      <div class="stack"><div class="eyebrow">Mural</div><ul class="mural" id="mural"></ul></div></div>` : ''}
  </div>`;
}

function atualizarPainel() {
  const st = eu(); const el = $('#painel'); if (!st || !el) return;
  el.innerHTML = painel(st); ligarPainel();
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
    $('#placar').innerHTML = placarHtml(); $('#anfitriao').innerHTML = anfitriao(); atualizarMural(); ligarAnfitriao();
  }
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
}

function ligarAnfitriao() {
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(S.sala.codigo); toast('Código copiado.'); } catch { toast(`Código: ${S.sala.codigo}`); }
  });
  $('#encerrar')?.addEventListener('click', () => {
    if (!S.confirmarEncerrar) { S.confirmarEncerrar = true; atualizarJogo(); return; }
    S.confirmarEncerrar = false; enviar({ t: 'encerrar' });
  });
  $('#cancelarEnc')?.addEventListener('click', () => { S.confirmarEncerrar = false; atualizarJogo(); });
}

function telaResultado() {
  const st = eu();
  if (!st) { S.tela = 'entrada'; return telaEntrada(); }
  const p = E.pontuacao(st), sala = S.modo === 'sala';
  const pos = sala ? S.placar.findIndex((x) => x.eu) + 1 : 0;
  const aindaJogando = sala ? S.placar.filter((x) => !x.fim).length : 0;
  const meta = E.METAS.find((m) => m.id === st.meta), cumpriu = E.metaCumprida(st);
  const metasSala = sala ? S.placar.filter((x) => x.meta && !x.eu).map((x) => {
    const m = E.METAS.find((k) => k.id === x.meta.id);
    return `<li><b>${esc(x.apelido)}</b>: ${esc(m?.nome || '')} · ${x.meta.ok ? `cumpriu (+${m.pts})` : 'não cumpriu'}</li>`;
  }).join('') : '';
  return `${topo(`<span class="sp"></span>${botaoSom()}<button class="btn sm" id="inicio">Voltar ao início</button>`)}
  <div class="wrap resultado">
    <div class="eyebrow">Fim do mercado</div>
    <h2>${sala ? `Você ficou em ${pos}º de ${S.placar.length}` : S.novoRecorde ? '<span class="recorde">Novo recorde!</span>' : 'Partida concluída'}</h2>
    <div class="box pontos">
      <div class="pt"><span>Itens do kit (${st.kit.length} × 10)</span><b>${p.itens}</b></div>
      <div class="pt"><span>Kit completo</span><b>${p.kitCompleto}</b></div>
      <div class="pt"><span>Cartas acertadas (${st.acertos} × ${E.PTS_CARTA})</span><b>${p.cartas}</b></div>
      <div class="pt"><span>Saldo final (${st.saldo} BC ÷ 10)</span><b>${p.saldo}</b></div>
      <div class="pt"><span>Meta secreta: ${esc(meta?.nome || '')} · ${cumpriu ? 'cumprida' : 'não cumprida'}</span><b>${p.meta}</b></div>
      <div class="pt total"><span>Total</span><b>${p.total} pts</b></div>
    </div>
    ${metasSala ? `<div class="box"><div class="eyebrow">Metas dos outros jogadores</div><ul class="metas-sala">${metasSala}</ul></div>` : ''}
    ${sala ? `<div class="stack"><div class="eyebrow">Placar${aindaJogando ? ` · ${aindaJogando} ainda jogando` : ''}</div>${placarHtml()}</div>` : ''}
    <div class="promo"><b>Para chefes e responsáveis</b><span>No próximo acampamento, o grupo pode usar a carteira de evento do Trilha HUB: os jovens pagam com QR ou pulseira e os responsáveis acompanham cada gasto pelo WhatsApp.</span>${linkHub('resultado', 'Saiba mais sobre o Trilha HUB')}</div>
    <div class="row"><button class="btn primary" id="denovo">${sala && S.sala?.tipo === 'espera' ? 'Entrar na fila de novo' : 'Jogar de novo'}</button><button class="btn" id="inicio2">Voltar ao início</button>${sala ? '<button class="btn" id="verTab">Ver o tabuleiro</button>' : ''}</div>
  </div>`;
}

function ligarResultado() {
  const voltar = () => { if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); } S.modo = null; S.peaoPos = {}; S.eu = null; ir('entrada'); };
  $('#inicio')?.addEventListener('click', voltar);
  $('#inicio2')?.addEventListener('click', voltar);
  $('#verTab')?.addEventListener('click', () => { S.verTab = true; S.tela = 'jogo'; render(); });
  $('#denovo')?.addEventListener('click', () => {
    if (S.modo === 'sala' && S.sala?.tipo === 'espera') { voltar(); entrarNaFila(); }
    else if (S.modo === 'sala') voltar();
    else jogarSozinho(false);
  });
}

function render() {
  if (S.tela === 'entrada') { app.innerHTML = telaEntrada(); ligarEntrada(); }
  else if (S.tela === 'fila') { app.innerHTML = telaFila(); ligarFila(); }
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
    const resto = Math.max(0, S.sala.fimRodadaEm - agora), frac = resto / (E.TEMPO_RODADA_S * 1000);
    tm.firstElementChild.style.width = `${Math.min(100, frac * 100)}%`;
    tm.classList.toggle('pouco', resto < 10000);
    tm.setAttribute('aria-label', `${Math.ceil(resto / 1000)} segundos para fechar a rodada`);
  }
}
setInterval(tique, 250);
setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);

render();
iniciar();
