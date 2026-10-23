// Mercado da Trilha — interface.
// Jogar sozinho usa o motor (engine.js) direto no navegador.
// Nas salas, o servidor é a fonte da verdade: o celular só envia jogadas e desenha o estado recebido.
import * as E from './engine.js';
import * as R from './rivais.js';

// Ícones SVG para cada item do kit (usados no inventário ilustrado)
const ITEM_IC = {  // svg.ic: herda tamanho e cor do estado (falta = apagado, no kit = cor da loja)
  corda: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" fill="none" stroke-width="2"/></svg>',
  lona: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 18L12 6l9 12H3z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 18l4.5-6 4.5 6" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>',
  panela: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6z" stroke="currentColor" fill="none" stroke-width="2"/><path d="M3 12h18M8 9c0-1 1-2 4-2s4 1 4 2" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  mapa: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3zM9 3.5v14M15 6.5v14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bussola: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>',
  lanterna: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 5h6l1 5v3H8v-3l1-5zM8 13h8v3H8zM10 16v4h4v-4M10 3v2M14 3v2" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  kitps: '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" fill="none" stroke-width="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M12 11v4M10 13h4" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
};

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const ic = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Duas medidas de cada personagem: 128 px para placar, peões e escolha; 256 px (-g) para a ficha aberta no meio da tela.
const fichaSrc = (id, grande = false) => `img/fichas/${encodeURIComponent(id || 'f01')}${grande ? '-g' : ''}.webp`;
const fichaNome = (id) => E.FICHAS.find((f) => f.id === id)?.nome || 'Ficha';
const bc = (v) => `<span class="bc">${v} BC</span>`;
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Lobinhos leem o texto curto das cartas, com um adulto; do nível Escoteiro em diante, o texto completo.
const leituraCurta = () => S.perfil.nivel === 'lobinho';
const NIVEL_DESC = { lobinho: 'Cartas simples e texto curto, para ler com um adulto', escoteiro: 'Todas as cartas, com o texto completo' };
// Escolha do nível: dois botões; `attr` é o atributo que cada botão carrega (ex.: data-nivel).
const nivelHtml = (atual, attr) => `<div class="nivel-op" role="radiogroup" aria-label="Nível">${Object.entries(E.NIVEIS).map(([k, nome]) =>
  `<button type="button" class="nivel-btn" role="radio" aria-checked="${atual === k}" ${attr}="${k}"><b>${nome}</b><span>${NIVEL_DESC[k]}</span></button>`).join('')}</div>`;
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
  // O nível do perfil (Lobinho ou Escoteiro em diante) define as cartas e a leitura. Quem usava a leitura curta antes
  // continua como Lobinho. O padrão é Escoteiro em diante.
  perfil: { apelido: '', ficha: 'f01', nivel: ls.get('mt-leitura', 'completa') === 'curta' ? 'lobinho' : E.NIVEL_PADRAO, ...ls.get('mt-perfil', {}) },
  rodadas: ls.get('mt-rodadas', E.RODADAS_PADRAO),
  online: false, registrado: false,   // registrado: há um perfil escolhido neste aparelho, dentro de uma conta
  temConta: false, perfilId: null, perfis: [], maxPerfis: 6,
  perfilEditor: null,    // tela de editor: { modo: 'local'|'novo'|'editar', id?, form, pontuacao?, apagar, codigo }
  editandoPerfis: false, // tela de perfis em modo de edição (mostra o lápis em cada ficha)
  modo: null,            // 'solo' | 'sala'
  solo: null,            // estado do motor no jogo solo (o que se vê é S.eu, uma cópia)
  sala: null, eu: null, placar: [], mural: [], fila: null, pontes: {},
  erro: '', carrinho: {}, offset: 0, confirmarEncerrar: false,
  aguardando: false,     // clicou e espera a resposta (e a animação) para clicar de novo
  cenasN: null,          // última cena já mostrada (null = ainda não sei, não anime o passado)
  soloN: 0, peaoPos: {}, // peaoPos: ordem -> casa onde o peão está desenhado
  som: ls.get('mt-som', true), musica: ls.get('mt-musica', true), reacaoLivreEm: 0,
  insignias: Object.keys(ls.get('mt-insignias', {})),   // todas as que o jogador já ganhou (aparelho + servidor)
  resultado: null, trilha: null, ranking: null, soloSala: false,
  troca: {}, missaoSolo: null,
  setas: {}, delta: {},  // C5: quem subiu ou desceu no placar e os pontos ganhos na última jogada
  log: [], logNovo: false, aba: 'placar', metaVista: null, primeiraVez: false, janelaFechada: null,   // tela do jogo
  ultimoNota: null, kitAnt: null, placarAnt: null, muralVisto: false,
};

// ---------- Utilidades de tela ----------
let toastT;
function toast(msg, tentativa = 0) {
  // Com a carta ou a barraca na frente o aviso esperaria por cima do texto: tenta de novo quando ela fechar.
  if (tentativa < 8 && ($('#cartaPalco') || $('#lojaPalco'))) { setTimeout(() => toast(msg, tentativa + 1), 1500); return; }
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
}
function ir(tela) { S.tela = tela; S.erro = ''; if (tela !== 'jogo') S.verTab = false; render(); window.scrollTo({ top: 0 }); }
// Para onde "voltar" ou "sair" deve levar: quem já tem um perfil (registrado, ou jogando sem conta) cai no
// menu "Como vai jogar?"; quem ainda não escolheu nada cai na tela de entrada (login).
const irMenu = () => ir((S.registrado || S.perfil.apelido.trim()) ? 'modos' : 'entrada');
const eu = () => S.eu;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Som e vibração (D5): tudo gerado no navegador, sem arquivo para baixar ----------
let ac = null;
function audio() {
  if (!S.som && !S.musica) return null;
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
  porta: () => { tom(140, 0.35, { tipo: 'sawtooth', vol: 0.025, ate: 95 }); ruido(0.18, { vol: 0.03, filtro: 700, atraso: 0.05 }); tom(1320, 0.18, { tipo: 'sine', vol: 0.03, atraso: 0.35 }); },
  virar: () => { ruido(0.09, { vol: 0.05, filtro: 2600 }); tom(880, 0.12, { tipo: 'triangle', vol: 0.03, atraso: 0.08 }); },
  clique: () => tom(680, 0.04, { tipo: 'sine', vol: 0.035 }),
  dado: () => { for (let i = 0; i < 5; i++) ruido(0.05, { atraso: i * 0.1, vol: 0.07, filtro: 900 + i * 300 }); },
  passo: () => tom(520, 0.05, { tipo: 'triangle', vol: 0.05 }),
  moeda: () => { tom(988, 0.09, { tipo: 'square', vol: 0.04 }); tom(1319, 0.2, { tipo: 'square', vol: 0.04, atraso: 0.08 }); },
  gasto: () => tom(330, 0.14, { tipo: 'triangle', vol: 0.1, ate: 220 }),
  compra: () => { tom(523, 0.08, { tipo: 'triangle', vol: 0.06 }); tom(659, 0.12, { tipo: 'triangle', vol: 0.06, atraso: 0.06 }); },
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
const botaoSomHtml = () => `${ic(S.som ? 'som' : 'mudo')}<span class="rot">Som</span>`;
const botaoSom = () => `<button class="btn sm btn-som" aria-pressed="${S.som}" aria-label="Efeitos sonoros" title="Ligar ou desligar os efeitos sonoros">${botaoSomHtml()}</button>`;

// Trilha sonora de fundo (música de acampamento em Web Audio puro, leve e ambiente)
let musicaInterval = null;
const NOTAS_ACAMPAMENTO = [
  261.63, 329.63, 392.00, 523.25,
  293.66, 349.23, 440.00, 587.33,
  329.63, 392.00, 493.88, 659.25,
  261.63, 392.00, 523.25, 659.25
];
let notaIdx = 0;
function tocarPassoMusica() {
  if (!S.musica) return;
  const a = audio(); if (!a || a.state !== 'running') return;
  const f = NOTAS_ACAMPAMENTO[notaIdx % NOTAS_ACAMPAMENTO.length];
  notaIdx++;
  tom(f, 0.45, { tipo: 'sine', vol: 0.015 });
  if (Math.random() < 0.25) {
    ruido(0.03, { vol: 0.008, filtro: 1400 });
  }
}
function iniciarMusica() {
  if (musicaInterval) clearInterval(musicaInterval);
  if (!S.musica) return;
  musicaInterval = setInterval(tocarPassoMusica, 700);
}
function pararMusica() {
  if (musicaInterval) { clearInterval(musicaInterval); musicaInterval = null; }
}
function alternarMusica() {
  S.musica = !S.musica; ls.set('mt-musica', S.musica);
  if (S.musica) { audio(); iniciarMusica(); } else { pararMusica(); }
  document.querySelectorAll('.btn-musica').forEach((b) => {
    b.setAttribute('aria-pressed', S.musica);
    b.innerHTML = botaoMusicaHtml();
  });
}
const botaoMusicaHtml = () => `<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="rot">Música</span>`;
const botaoMusica = () => `<button class="btn sm btn-musica" aria-pressed="${S.musica}" aria-label="Música de fundo" title="Ligar ou desligar a música de fundo">${botaoMusicaHtml()}</button>`;

document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-som')) alternarSom();
  if (e.target.closest('.btn-musica')) alternarMusica();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pararMusica();
  else if (S.musica && ac?.state === 'running') iniciarMusica();
});
document.addEventListener('click', () => {
  if (S.musica && !musicaInterval) {
    const a = audio();
    if (a) iniciarMusica();
  }
}, { once: true });

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
    S.emailLigado = !!r.config?.emailLigado;
    S.temConta = !!r.conta;
    if (r.jogador) {
      trocarDePerfil(r.perfilId, r.jogador);
      mesclarInsignias(r.insignias || []);
    }
    enviarPendentes();
    enviarContador();
    carregarRanking();
    const sala = ls.get('mt-sala', null);
    if (sala && S.registrado) { S.modo = 'sala'; S.tela = 'jogo'; S.cenasN = null; reiniciarFaixas(); await conectar(); enviar({ t: 'entrar', codigo: sala }); }
  } catch { S.online = false; }
  if (S.temConta && !S.registrado && S.tela === 'entrada') { abrirPerfis(); return; }   // conta sem perfil escolhido aqui
  if (S.tela === 'entrada' && (S.registrado || S.perfil.apelido.trim())) S.tela = 'modos';   // já tem perfil: vai direto para "como vai jogar"
  render();
}

// O perfil que joga neste aparelho. O que o aparelho guarda de insígnias, recordes e histórico é de um
// perfil só: ao trocar de perfil, isso é esquecido aqui (a conta guarda tudo no servidor).
function trocarDePerfil(id, jogador) {
  const antes = ls.get('mt-perfil-id', null);
  if (antes && id && antes !== id) {
    for (const k of ['mt-insignias', 'mt-recorde', 'mt-recorde-desafio', 'mt-historico']) ls.del(k);
    S.insignias = []; S.ranking = null;
  }
  S.perfilId = id; S.registrado = !!id;
  if (id) ls.set('mt-perfil-id', id);
  if (jogador) { S.perfil = { ...S.perfil, apelido: jogador.apelido, ficha: jogador.ficha, nivel: jogador.nivel || S.perfil.nivel }; ls.set('mt-perfil', S.perfil); }
}
// Resposta das rotas da conta (entrar, perfis, recuperar): conta, perfis e o perfil escolhido neste aparelho.
function aplicarConta(r) {
  S.temConta = true; S.perfis = r.perfis || []; S.maxPerfis = r.maxPerfis || 6;
  trocarDePerfil(r.perfil?.id || null, r.perfil);
  if (r.perfil) mesclarInsignias(r.insignias || []);
}
// Algo que precisa da conta: sem conta, a tela da conta; com conta mas sem perfil, a escolha de perfil.
const pedirConta = () => (S.temConta ? abrirPerfis(true) : abrirConta(true));

// Leva o apelido, a ficha e o nível escolhidos na tela para a conta. A conta em si só o responsável cria, com o e-mail.
async function registrar() {
  const apelido = S.perfil.apelido.trim();
  if (apelido.length < 2) throw new Error('Escreva um apelido com pelo menos 2 letras.');
  ls.set('mt-perfil', S.perfil);
  if (!S.online || !S.registrado) return;
  await api('/api/eu', { apelido, ficha: S.perfil.ficha, nivel: S.perfil.nivel });
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
    S.modo = 'sala'; ls.set('mt-sala', m.codigo); S.fila = null; S.cenasN = null; reiniciarFaixas(); S.eu = null; S.peaoPos = {};
    if (S.tela !== 'resultado' || m.nova) { S.tela = 'jogo'; S.verTab = false; S.resultado = null; S.confetou = false; S.setas = {}; S.delta = {}; S.placar = []; }
  } else if (m.t === 'fila') {
    S.fila = m; S.offset = m.agora - Date.now();
    if (S.tela === 'fila') render();
  } else if (m.t === 'outro_aparelho') {
    // O mesmo perfil abriu as salas em outro aparelho: este sai da sala ou da fila, mas continua na conta.
    S.modo = null; S.sala = null; S.fila = null; S.eu = null; S.placar = []; S.peaoPos = {}; ls.del('mt-sala');
    toast(m.msg); irMenu();
  } else if (m.t === 'fila_saiu') {
    toast(m.msg); S.fila = null; irMenu();
  } else if (m.t === 'erro') {
    S.aguardando = false;
    if (S.tela === 'jogo' && eu()?.pend?.tipo === 'loja') { S.erro = m.msg; atualizarJogo(); } else { toast(m.msg); atualizarJogo(); }
    if (/não encontrada|encerrada|já começou/.test(m.msg) && S.tela !== 'resultado') { ls.del('mt-sala'); S.modo = null; irMenu(); }
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
  const antes = S.eu, muralAntes = S.mural;
  atualizarRanking(m.placar);
  S.missaoSolo = m.missao || null;
  S.sala = m.sala; S.eu = m.eu; S.placar = m.placar; S.mural = m.mural; S.pontes = m.pontes || {};
  registrarCenas(novas, m); registrarMural(m.mural, muralAntes);
  if (m.sala) S.offset = m.sala.agora - Date.now();
  if (m.eu && antes && antes.pend?.tipo === 'loja' && !m.eu.pend) S.carrinho = {};
  if (S.modo === 'sala' && (m.sala.status === 'encerrada' || m.eu?.fim) && S.tela === 'jogo' && !S.verTab) S.tela = 'resultado';
  if (S.tela === 'entrada' || S.tela === 'fila') S.tela = 'jogo';
  if (S.modo === 'solo' && m.eu?.fim && S.tela === 'jogo') setTimeout(() => ir('resultado'), 900);
  S.erro = ''; S.aguardando = false;
  render();
  verCartaSorteada();
  verLojaAberta();
}

// ---------- Loja: a barraca abre as portas na frente do tabuleiro, com os itens nas prateleiras ----------
// O carrinho é o mesmo do painel: marcar um item aqui marca lá, e pagar ou sair usa as mesmas ações.
let lojaVista = null;   // a última parada em loja que já abriu a barraca (não reabre sozinha depois de fechada)
function verLojaAberta() {
  const st = S.eu, ov = $('#lojaPalco');
  const loja = S.tela === 'jogo' && st?.pend?.tipo === 'loja' ? st.pend.loja : null;
  if (!loja) { if (ov) fecharLojaGrande(ov); return; }
  const chave = `${S.modo}:${E.rodadaAtual(st)}:${loja}:${st.pos}`;
  if (chave === lojaVista) { atualizarLojaGrande(); return; }
  lojaVista = chave;
  abrirLojaGrande(loja);
}

async function abrirLojaGrande(loja, animar = true) {
  $('#lojaPalco')?.remove();
  const casa = E.CASAS[loja];
  const ov = document.createElement('div');
  ov.id = 'lojaPalco'; ov.className = 'lj-palco'; ov.dataset.loja = loja;
  ov.style.setProperty('--t', `var(--c-${loja})`);
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', casa.nome);
  ov.innerHTML = `<div class="lj-barraca">
      <div class="lj-toldo" aria-hidden="true"></div>
      <div class="lj-placa">${ic(loja)}<span>${esc(casa.nome)}</span></div>
      <div class="lj-fachada">
        <div class="lj-dentro"><span class="lj-luz" aria-hidden="true"></span><div class="lj-prateleira" id="ljItens"></div></div>
        <div class="lj-porta esq" aria-hidden="true"><i class="lj-janela"></i><i class="lj-macaneta"></i></div>
        <div class="lj-porta dir" aria-hidden="true"><i class="lj-janela"></i><i class="lj-macaneta"></i></div>
      </div>
      <div class="lj-balcao" id="ljBalcao"></div>
    </div>`;
  document.body.appendChild(ov);
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', tecla);
  ov.fechar = fechar;
  atualizarLojaGrande();
  if (!animar || reduzir) { ov.classList.add('aberta', 'pronta'); return; }
  await sleep(450);
  if (!ov.isConnected) return;
  som('porta');
  ov.classList.add('aberta');
  await sleep(750);
  if (ov.isConnected) { ov.classList.add('pronta'); ov.querySelector('.lj-item:not(:disabled)')?.focus(); }
}

// Prateleira e balcão, a partir do estado e do carrinho (chamado também quando o painel muda).
function atualizarLojaGrande() {
  const ov = $('#lojaPalco'), st = S.eu;
  if (!ov || st?.pend?.tipo !== 'loja' || st.pend.loja !== ov.dataset.loja) return;
  const loja = st.pend.loja, itens = E.ITENS.filter((i) => i.loja === loja);
  const sel = Object.keys(S.carrinho).filter((id) => S.carrinho[id]);
  const { total } = E.totalCompra(st, sel);
  const feira = E.descontoFeira(st, loja), trava = S.aguardando ? 'disabled' : '';
  $('#ljItens').innerHTML = itens.map((i) => {
    const tem = st.kit.includes(i.id), pr = E.precoItem(st, i), marcado = !!S.carrinho[i.id];
    return `<button class="lj-item${tem ? ' tem' : ''}${marcado ? ' marcado' : ''}" data-lj-item="${i.id}" aria-pressed="${marcado}" ${tem ? 'disabled' : trava}>
      <span class="lj-ico">${ITEM_IC[i.id] || ic(loja)}</span>
      <span class="lj-nome">${esc(i.nome)}</span>
      <span class="lj-preco">${pr !== i.preco ? `<s>${i.preco}</s> ` : ''}${pr} BC</span>
      ${tem ? '<span class="lj-selo">No kit</span>' : marcado ? '<span class="lj-check" aria-hidden="true">✓</span>' : ''}
    </button>`;
  }).join('');
  const avisos = [
    feira ? `<p class="lj-aviso ok">Feira! ${feira} BC de desconto em cada item.</p>` : '',
    st.desconto ? `<p class="lj-aviso ok">Promoção: ${st.desconto} BC de desconto nesta compra.</p>` : '',
    st.extra ? `<p class="lj-aviso alerta">O lojista está distraído: a compra vai custar ${st.extra} BC a mais. Confira o aviso de gasto.</p>` : '',
    S.erro ? `<p class="lj-aviso erro">${esc(S.erro)}</p>` : '',
  ].join('');
  $('#ljBalcao').innerHTML = `${avisos}
    <div class="lj-total"><span>Saldo ${st.saldo} BC</span><b>Total ${total} BC</b></div>
    <div class="lj-botoes"><button class="btn primary" id="ljPagar" ${sel.length && !S.aguardando ? '' : 'disabled'}>Pagar ${total} BC</button>
      <button class="btn" id="ljSair" ${trava}>Sair sem comprar</button></div>`;
  ov.querySelectorAll('[data-lj-item]').forEach((b) => b.addEventListener('click', () => {
    S.carrinho[b.dataset.ljItem] = !S.carrinho[b.dataset.ljItem]; S.erro = '';
    atualizarPainel();
    $(`[data-lj-item="${b.dataset.ljItem}"]`)?.focus();
  }));
  $('#ljPagar').addEventListener('click', () => acao('comprar', { itens: Object.keys(S.carrinho).filter((k) => S.carrinho[k]) }));
  $('#ljSair').addEventListener('click', () => acao('sair_loja'));
}

// Comprou ou saiu: as portas fecham e a barraca some.
async function fecharLojaGrande(ov) {
  if (ov.dataset.fechando) return;
  ov.dataset.fechando = '1';
  ov.classList.remove('pronta', 'aberta');
  ov.classList.add('saindo');
  await sleep(reduzir ? 0 : 650);
  ov.fechar?.();
}

// ---------- Carta sorteada: chega na frente do tabuleiro de costas, gira e mostra a frente ----------
// A janela de arte guarda o espaço da imagem de um personagem ou objeto. Para pôr a arte de uma carta,
// salve public/img/cartas/<id da carta>.webp (4:3) e inclua o id aqui.
const ARTES_CARTAS = new Set([]);
let cartaVista = null;   // a última carta sorteada que já apareceu (não reabre depois de fechada)

function verCartaSorteada() {
  const st = S.eu, ov = $('#cartaPalco');
  const id = S.tela === 'jogo' && st?.pend?.tipo === 'carta' ? st.pend.carta : null;
  if (!id) {
    // respondeu: a carta grande mostra o resultado, se ainda estiver aberta
    if (ov && st?.resposta?.carta === ov.dataset.id) resultadoNaCarta(st);
    else if (ov && S.tela !== 'jogo') ov.remove();
    return;
  }
  const chave = `${S.modo}:${E.rodadaAtual(st)}:${id}`;
  if (chave === cartaVista) return;
  cartaVista = chave;
  abrirCartaGrande(st, id);
}

const ICONE_PERGUNTA = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8V15M12 18.5v.5"/></svg>';
function cenaDaCarta(c) {
  const t = c.tipo === 'tempestade', g = `ccg-${c.id}`;
  const ceu = t ? ['#3A2F6B', '#8C7BC9'] : ['#2B6FA3', '#9CCBEA'];
  return `<svg class="cc-cena" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ceu[0]}"/><stop offset="1" stop-color="${ceu[1]}"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#${g})"/>
    ${t ? '<g fill="#5E5482"><ellipse cx="50" cy="28" rx="34" ry="12"/><ellipse cx="80" cy="22" rx="30" ry="13"/><ellipse cx="112" cy="30" rx="32" ry="11"/></g><path d="M86 34 l-8 16 h9 l-7 16" stroke="#FFE27A" stroke-width="3" fill="none" stroke-linejoin="round"/>'
      : '<circle cx="124" cy="30" r="14" fill="#FFE08A"/><circle cx="124" cy="30" r="22" fill="#FFE08A" opacity=".25"/>'}
    <path d="M0 86 L30 58 L52 78 L80 50 L108 76 L132 56 L160 78 L160 120 L0 120Z" fill="${t ? '#3E3A5A' : '#2E5939'}"/>
    <path d="M0 100 Q40 84 80 98 T160 94 L160 120 L0 120Z" fill="${t ? '#2C2944' : '#3B6E47'}"/>
    <g fill="${t ? '#1F1D33' : '#21412B'}"><path d="M18 104 l9 -22 l9 22z"/><path d="M128 102 l8 -20 l8 20z"/><path d="M142 106 l6 -15 l6 15z"/></g>
  </svg>`;
}
function frenteDaCarta(c) {
  const curta = leituraCurta() && c.curto;
  const arte = ARTES_CARTAS.has(c.id) ? `<img src="img/cartas/${encodeURIComponent(c.id)}.webp" alt="">` : `${cenaDaCarta(c)}<span class="cc-emblema">${ic(c.tipo)}</span>`;
  return `<div class="cc" data-tipo="${c.tipo}">
    ${c.sala ? '<span class="cc-sala">Vale para a sala toda</span>' : ''}
    <div class="cc-miolo">
      <div class="cc-cab"><span class="cc-nome">${esc(c.titulo)}</span><span class="cc-pts"><small>+</small>${E.PTS_CARTA} <small>pts</small></span><span class="cc-selo">${ic(c.tipo)}</span></div>
      <div class="cc-arte">${arte}</div>
      <span class="cc-faixa">${c.tipo === 'tempestade' ? 'Carta de revés · Tempestade' : 'Carta de sorte · Bússola'}</span>
      <div class="cc-texto">${curta ? `<p class="cc-curto">${esc(c.curto)}</p>` : `<p>${esc(c.historia)}</p><div class="cc-pergunta"><span class="cc-bola">${ICONE_PERGUNTA}</span><b>${esc(c.pergunta)}</b></div>`}</div>
      <div class="cc-rodape">
        <span>No jogo<b>${esc(c.resumo)}</b></span>
        <span>Acertou<b>${c.tipo === 'tempestade' ? 'Escapa do revés' : `+${E.PTS_CARTA} pts`}${c.sala ? ` · +${E.GANHO_CARTA_SALA} BC para quem tirou` : ''}</b></span>
      </div>
    </div>
  </div>`;
}
const VERSO_DA_CARTA = `<div class="cc-verso"><div class="cc-miolo">
  <svg class="cc-rosa" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="none" stroke="#F3D27A" stroke-width="2"/><circle cx="50" cy="50" r="38" fill="none" stroke="#F3D27A" stroke-width="1" stroke-dasharray="2 4"/>
    <path d="M50 6 L57 43 L94 50 L57 57 L50 94 L43 57 L6 50 L43 43Z" fill="#F3D27A" opacity=".9"/><path d="M50 22 L54 46 L78 50 L54 54 L50 78 L46 54 L22 50 L46 46Z" fill="#1C3A26"/>
    <circle cx="50" cy="50" r="12" fill="#D9A62E" stroke="#1C3A26" stroke-width="2"/>
    <text x="50" y="54.5" text-anchor="middle" font-family="Rockwell, Roboto Slab, Georgia, serif" font-weight="800" font-size="12" fill="#1C3A26">BC</text>
  </svg>
  <div class="cc-marca">Mercado<br>da <span>Trilha</span></div><div class="cc-sub">Bússola · Tempestade</div>
</div></div>`;

async function abrirCartaGrande(st, id) {
  $('#cartaPalco')?.remove();
  const c = E.cartaMostrada(st, id);
  const ov = document.createElement('div');
  ov.id = 'cartaPalco'; ov.className = 'cc-palco'; ov.dataset.id = id;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Carta ${c.titulo}`);
  ov.innerHTML = `<div class="cc-voo"><div class="cc-giro"><div class="cc-lado">${VERSO_DA_CARTA}</div><div class="cc-lado cc-frente">${frenteDaCarta(c)}</div></div></div>
    <div class="cc-respostas"></div>`;
  document.body.appendChild(ov);
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', tecla);
  ov.fechar = fechar;
  await sleep(reduzir ? 0 : 900);
  if (!ov.isConnected) return;
  som('virar');
  ov.querySelector('.cc-voo').classList.add('virada');
  await sleep(reduzir ? 0 : 800);
  if (!ov.isConnected || ov.dataset.respondida) return;
  const r = ov.querySelector('.cc-respostas');
  r.innerHTML = c.opcoes.map((o, i) => `<button class="cc-op" data-cc-resp="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('');
  ov.classList.add('pronta');
  r.querySelectorAll('[data-cc-resp]').forEach((b) => b.addEventListener('click', () => {
    if (S.aguardando) return;
    ov.dataset.escolha = b.dataset.ccResp;
    r.querySelectorAll('[data-cc-resp]').forEach((x) => { x.disabled = true; });
    b.classList.add('escolhida');
    acao('responder', { i: Number(b.dataset.ccResp) });
  }));
  r.querySelector('.cc-op')?.focus();
}

// Depois de responder: certa e errada nas opções, o porquê e um botão para seguir.
function resultadoNaCarta(st) {
  const ov = $('#cartaPalco');
  if (!ov || ov.dataset.respondida) return;
  ov.dataset.respondida = '1';
  const c = E.cartaMostrada(st, st.resposta.carta), r = ov.querySelector('.cc-respostas');
  if (!r.querySelector('[data-cc-resp]')) { ov.fechar?.(); return; }   // respondeu pelo painel antes do giro acabar
  r.querySelectorAll('[data-cc-resp]').forEach((b) => {
    b.disabled = true;
    const k = Number(b.dataset.ccResp);
    if (k === c.certa) b.classList.add('certa');
    else if (String(k) === ov.dataset.escolha || k === st.resposta.escolha) b.classList.add('errada');
  });
  const titulo = st.resposta.ok ? `Acertou! +${E.PTS_CARTA} pts.${st.resposta.evitou ? ' Você evitou o revés.' : ''}` : 'Não foi dessa vez.';
  r.insertAdjacentHTML('beforeend', `<div class="cc-resultado ${st.resposta.ok ? 'ok' : ''}"><b>${titulo}</b> ${esc(c.porque)}</div>
    <div class="cc-fim"><button class="btn primary cc-seguir">Continuar</button></div>`);
  r.querySelector('.cc-seguir').addEventListener('click', () => ov.fechar());
  r.querySelector('.cc-seguir').focus();
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
function atualizarPlacar() { const el = $('#placar'); if (el) el.innerHTML = placarHtml(); else if ($('#jAmigos')) atualizarAmigos(); }

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

// O dado que rola no centro do tabuleiro: as faces trocam depressa e param no valor sorteado, depois some.
const dadoHtml = (v, extra = '') => `<div class="dado${extra}" aria-label="Dado: ${v}">${[...Array(9)].map((_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;

let dadosT = 0;
async function rolarFaces(vals, rolando = true) {
  const box = $('#dados'); if (!box) return;
  clearTimeout(dadosT);
  box.classList.add('ver');
  if (rolando) {
    box.classList.add('rolando'); som('dado', 15);
    for (let k = 0; k < (reduzir ? 0 : 7); k++) { box.innerHTML = vals.map(() => dadoHtml(1 + Math.floor(Math.random() * 6))).join(''); await sleep(85); }
  }
  box.innerHTML = vals.map((v) => dadoHtml(v)).join('');
  box.classList.remove('rolando');
  dadosT = setTimeout(() => box.classList.remove('ver'), 1700);
}

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
    if (!el) {
      el = document.createElement('div');
      el.dataset.o = p.ordem;
      el.innerHTML = '<img alt="">';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        mostrarDetalhesFicha(S.placar.find((x) => x.ordem === Number(el.dataset.o)));
      });
      lay.appendChild(el);
    }
    el.className = `peao2${p.eu ? ' eu' : ''}`;
    el.style.setProperty('--pc', p.cor);
    el.title = `${p.apelido} · ${p.pontos} pts`;
    const img = el.firstChild, src = fichaSrc(p.ficha);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    S.peaoPos[p.ordem] = p.pos;
  }
  layoutPeoes();
}

// Balão de fala leve, dinâmico e focado no peão do jogador
function balaoPeao(ordem, texto) {
  const p = peao(ordem); const board = $('#board');
  if (!p || !board) return;
  board.querySelectorAll(`.balao-peao-${ordem}`).forEach((b) => b.remove());
  const bRect = board.getBoundingClientRect(), pRect = p.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `balao-acao balao-peao-${ordem}`;
  el.textContent = texto;
  board.appendChild(el);
  // A ponta do balão (a 14 px da esquerda) aponta para o peão; o balão inteiro fica dentro do tabuleiro.
  const cx = pRect.left - bRect.left + pRect.width / 2;
  const x = Math.max(6, Math.min(bRect.width - el.offsetWidth - 6, cx - 14));
  const y = Math.max(6, pRect.top - bRect.top - el.offsetHeight - 8);
  el.style.setProperty('--seta', `${Math.max(8, Math.min(el.offsetWidth - 18, cx - x - 5))}px`);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  setTimeout(() => el.remove(), 3200);
}

// Modal ao clicar/selecionar ficha: traz ao centro com imagem, apelido e pontuação
function mostrarDetalhesFicha(p) {
  if (!p) return;
  som('clique');
  const overlayAnterior = $('#fichaModal');
  if (overlayAnterior) overlayAnterior.remove();
  const antes = document.activeElement;
  const el = document.createElement('div');
  el.className = 'ficha-modal-overlay';
  el.id = 'fichaModal';
  el.innerHTML = `
    <div class="ficha-modal" role="dialog" aria-modal="true" aria-labelledby="fmNome" style="--pc:${esc(p.cor || 'var(--sun)')}">
      <img src="${fichaSrc(p.ficha, true)}" alt="${esc(fichaNome(p.ficha))}">
      <div class="fm-nome" id="fmNome">${esc(p.apelido)}${p.eu ? ' (você)' : ''}</div>
      <div class="fm-pts">${p.pontos} pts</div>
      <div class="fm-info">Ficha: <b>${esc(fichaNome(p.ficha))}</b></div>
      ${p.saldo != null ? `<div class="fm-info">Saldo: <b>${p.saldo} BC</b> · Kit: <b>${p.kit ?? 0}/7</b></div>` : ''}
      <button class="btn sm primary" id="fecharFichaModal">Fechar</button>
    </div>`;
  document.body.appendChild(el);
  const fechar = () => { el.remove(); document.removeEventListener('keydown', tecla); antes?.focus?.(); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); else if (e.key === 'Tab') { e.preventDefault(); el.querySelector('button').focus(); } };
  document.addEventListener('keydown', tecla);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.id === 'fecharFichaModal') fechar();
  });
  el.querySelector('button').focus();
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
    await rolarFaces(ev.v);
    if (ev.v.length === 1) { const dest = celula((S.peaoPos[ordem] + ev.v[0]) % E.TABULEIRO.length); dest?.classList.add('destino'); setTimeout(() => dest?.classList.remove('destino'), 900); }
  },
  async escolheu(ev, ordem, meu) {
    if (!meu) return;
    await rolarFaces([ev.v], false);
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
    // O andou vem do dado e também das cartas (avance 3, volte 2): o texto vale para os dois.
    const nomeCasa = E.CASAS[E.TABULEIRO[pos]]?.nome || '';
    if (n) balaoPeao(ordem, `${dir < 0 ? 'Voltou' : 'Andou'} ${n} ${n === 1 ? 'casa' : 'casas'}: ${nomeCasa}`);
  },
  async credito(ev, ordem, meu) {
    if (!meu) return;
    mostrarNota(`${ev.d}: +${ev.v} BC`);
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
    $('#bConta')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 280 });
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
    await rolarFaces([ev.v]);
    await sleep(150);
  },
  async ponte(ev, ordem, meu, m) {
    const quem = m.placar.find((p) => p.ordem === ordem);
    flutuar(celula(ev.pos), meu ? 'Sua ponte' : `Ponte de ${quem?.apelido || ''}`, 'info');
    S.pontes = { ...S.pontes, [ev.pos]: ordem };
    atualizarPontes(m.placar);
  },
  async gratificacao(ev, ordem, meu) {
    flutuar(peao(ordem), `+${E.GRATIFICACAO} BC`, 'bom');
    balaoPeao(ordem, `Guardião da ponte: +${E.GRATIFICACAO} BC`);
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
  async troca(ev, ordem, meu) {
    flutuar(peao(ordem), `${E.ITENS.find((i) => i.id === ev.dar).nome} → ${E.ITENS.find((i) => i.id === ev.querer).nome}`, 'info');
    if (meu) som('moeda');
  },
  async oferta(ev, ordem, meu) {
    if (meu) toast('Oferta feita: quem aceitar primeiro troca com você.');
  },
  async missao(ev, ordem, meu, m) {
    if (meu) { confete(); som('fogo'); banner(`Missão cumprida primeiro: ${ev.nome}! +${E.MISSAO_PTS} pts`, 'virada'); }
    else toast(`${m.placar.find((p) => p.ordem === ordem)?.apelido || 'Alguém'} cumpriu a missão da sala primeiro.`);
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
  anotar(m.texto, m.cor); atualizarFaixas();
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
  if (enviando || !fila.length || !S.online || !S.registrado) return;
  enviando = true;
  try {
    const resto = [];
    for (const it of fila) {
      if (it.perfil && it.perfil !== S.perfilId) { resto.push(it); continue; }   // é de outro perfil: espera ele
      try {
        const r = await fetch(it.tipo === 'solo' ? '/api/solo' : '/api/desafio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(it.corpo) });
        if (r.status >= 500) resto.push(it);
        else if (r.ok) { const j = await r.json().catch(() => ({})); if (j.insignias) mesclarInsignias(j.insignias); if (it.tipo === 'desafio' && S.resultado) S.resultado.valeu = j.valeu; }
      } catch { resto.push(it); }
    }
    ls.set('mt-envios', resto);
  } catch { /* sem rede: fica na fila */ } finally { enviando = false; }
}
addEventListener('online', () => { S.online = true; enviarPendentes(); enviarContador(); });

async function carregarRanking() {
  if (!S.online || !S.registrado) return;
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
  const { modo, uuid: id, dia, acoes, treino, ctx, perfil } = S.solo;
  ls.set('mt-solo', { v: E.VERSAO_ESTADO, modo, uuid: id, dia, acoes, treino, perfil, pontes: ctx.pontes, missao: ctx.missao, estados: Object.fromEntries(ctx.estados) });
}
function carregarSolo() {
  const d = ls.get('mt-solo', null);
  if (!d || d.v !== E.VERSAO_ESTADO || !d.estados?.eu) { ls.del('mt-solo'); return null; }
  const ctx = E.novoContexto(d.modo === 'solo' ? d.pontes || {} : null);
  if (d.modo === 'solo') ctx.missao = d.missao || E.missaoDaPartida(d.estados.eu.seed);
  for (const [id, st] of Object.entries(d.estados)) { st.saida = []; st.cena = []; ctx.estados.set(id, st); }
  return { modo: d.modo, uuid: d.uuid, dia: d.dia, acoes: d.acoes || [], treino: !!d.treino, perfil: d.perfil || null, ctx };
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
  const mi = ctx.missao ? { nome: E.missaoPorId(ctx.missao.id).nome, itens: E.missaoPorId(ctx.missao.id).itens, desc: E.descreverMissao(ctx.missao), pts: E.MISSAO_PTS, vencedor: ctx.missao.vencedor != null ? ctx.estados.get(ctx.missao.vencedor)?.apelido || null : null } : null;
  empilhar({ t: 'estado', sala: null, eu: snap, placar, mural: [], pontes, cenas, missao: mi });
}

function acao(t, extra = {}) {
  if (S.aguardando) return;
  som('clique');
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
    som('errada');
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
  // Sem conta, a partida fica só no aparelho: nada vai para o servidor além do contador anônimo.
  const fila = ls.get('mt-envios', []);
  if (modo === 'solo') { if (S.registrado) fila.push({ tipo: 'solo', perfil: S.perfilId, corpo: { id, pontos: pts, saldo: st.saldo, acertos: st.acertos, kit: st.kit.length, rodadas: st.rodadas, posicao: pos, insignias: novas } }); }
  else if (!treino) { ls.set(chaveDesafio(dia), { pontos: pts }); if (S.registrado) fila.push({ tipo: 'desafio', perfil: S.perfilId, corpo: { dia, acoes } }); }
  ls.set('mt-envios', fila);
  contar('fim');
  enviarPendentes().then(() => { if (modo === 'desafio') carregarRanking(); });
}

async function jogarSozinho(continuar, modo = 'solo') {
  try { await registrarLocal(); } catch (e) { toast(e.message); return; }
  S.modo = 'solo';
  let salvo = continuar ? carregarSolo() : null;
  if (continuar && !salvo) toast('O jogo foi atualizado: a partida salva foi descartada.');
  if (!salvo) {
    contar('inicio');
    const apelido = S.perfil.apelido.trim(), ficha = S.perfil.ficha;
    if (modo === 'desafio') {
      const dia = diaSP();
      salvo = { modo, uuid: uuid(), dia, acoes: [], treino: !!ls.get(chaveDesafio(dia), null), ctx: E.novoDesafio(dia, { apelido, ficha }) };
    } else {
      salvo = { modo, uuid: uuid(), acoes: [], ctx: R.novoJogoSolo({ apelido, ficha, rodadas: S.rodadas, seed: Math.floor(Math.random() * 2 ** 31), vistas: ls.get('mt-vistas', []), nivel: S.perfil.nivel }) };
    }
  }
  salvo.perfil ??= S.perfilId;
  S.solo = salvo; salvarSolo();
  S.cenasN = null; reiniciarFaixas(); S.aguardando = false; S.peaoPos = {}; S.resultado = null; S.confetou = false; S.setas = {}; S.delta = {}; S.placar = []; pendentes.length = 0;
  S.eu = null;
  publicarSolo();
  ir('jogo');
}
// Cada perfil tem a sua primeira tentativa do desafio do dia.
const chaveDesafio = (dia) => (S.perfilId ? `mt-desafio-${dia}-${S.perfilId}` : `mt-desafio-${dia}`);
const jogarDesafio = () => (S.registrado ? jogarSozinho(false, 'desafio') : pedirConta());
async function registrarLocal() {
  const a = S.perfil.apelido.trim();
  if (a.length < 2) throw new Error('Escreva um apelido com pelo menos 2 letras.');
  ls.set('mt-perfil', S.perfil); ls.set('mt-rodadas', S.rodadas);
}

// Salas e fila: precisam de conexão e da conta do responsável. Sem conta, abre a tela da conta e devolve false.
async function preparoOnline() {
  if (!S.online) throw new Error('Salas indisponíveis: sem conexão com o servidor. Você pode jogar sozinho.');
  await registrarLocal();
  if (!S.registrado) { pedirConta(); return false; }
  await registrar();
  await conectar();
  return true;
}

async function entrarComCodigo(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(codigo)) { toast('O código tem 5 letras ou números.'); return; }
  try { if (!await preparoOnline()) return; } catch (e) { toast(e.message); return; }
  S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; reiniciarFaixas(); S.peaoPos = {}; S.eu = null;
  enviar({ t: 'entrar', codigo });
}
// E4: o anfitrião reabriu a sala com código; todos os que estavam no resultado são levados juntos.
function entrarNaRevanche(codigo) {
  S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; reiniciarFaixas(); S.peaoPos = {}; S.eu = null; S.placar = [];
  S.verTab = false; S.resultado = null; S.setas = {}; S.delta = {};
  S.tela = 'jogo'; render();
  enviar({ t: 'entrar', codigo });
}
async function criarSala() {
  try {
    if (!await preparoOnline()) return;
    const { codigo } = await api('/api/salas', { rodadas: S.rodadas });
    S.modo = 'sala'; ls.set('mt-sala', codigo); S.cenasN = null; reiniciarFaixas(); S.peaoPos = {}; S.eu = null;
    enviar({ t: 'entrar', codigo });
  } catch (e) { toast(e.message); }
}
async function entrarNaFila() {
  try { if (!await preparoOnline()) return; } catch (e) { toast(e.message); return; }
  S.fila = null; S.modo = null; ls.del('mt-sala');
  ir('fila');
  enviar({ t: 'fila_entrar' });
}
function sairDaFila() { enviar({ t: 'fila_sair' }); S.fila = null; irMenu(); }
function sairDoJogo() {
  if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); }
  S.modo = null; S.sala = null; S.eu = null; S.placar = []; S.mural = []; S.pontes = {}; S.peaoPos = {}; pendentes.length = 0;
  irMenu();
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
  return `<header class="top"><div class="wrap"><span class="logo" aria-label="Mercado da Trilha">${ic('moeda')}<span class="logo-txt" aria-hidden="true">Mercado da <span>Trilha</span></span></span>${extra}</div></header>`;
}

// Passo 1: login. Só a conta do responsável (e-mail + código) ou o jogo sem conta; nada de perfil ainda.
function telaEntrada() {
  return `
  <section class="hero"><div class="wrap">
    <div class="row" style="justify-content:space-between"><div class="eyebrow" style="color:var(--sun)">Jogo de treino da conta digital</div><div class="row" style="gap:6px">${botaoSom()}${botaoMusica()}</div></div>
    <h1>Mercado da <span>Trilha</span></h1>
    <p>Monte o Kit de Acampamento gastando BadenCoin (BC) nas barracas. Confira cada gasto, acerte as cartas e termine com o maior número de pontos.</p>
  </div></section>
  <div class="wrap entrada">
    <div class="box">
      <h2>Entrar para jogar</h2>
      <p class="note">Com a conta do responsável (e-mail + código), a criança joga em salas, faz o desafio do dia e guarda o histórico e as insígnias em Minha trilha. Sem conta, só o jogo sozinho neste aparelho.</p>
      <button class="btn big primary" id="abrirConta" ${S.online ? '' : 'disabled'}>Entrar ou criar a conta do responsável</button>
      <div class="ou-sep"><span></span>ou<span></span></div>
      <button class="btn" id="semConta">Jogar sem conta, só neste aparelho</button>
    </div>
    ${S.online ? '' : '<p class="note">Sem conexão com o servidor: a conta do responsável fica indisponível, mas você pode jogar sozinho.</p>'}
  </div>
  <footer class="wrap rodape"><span class="tb">Um jogo do Trilha HUB</span>${linkHub('entrada', 'Conheça o Trilha HUB')}</footer>`;
}
function ligarEntrada() {
  $('#abrirConta')?.addEventListener('click', () => abrirConta());
  $('#semConta')?.addEventListener('click', () => abrirEditorLocal());
}

// Passo 3: como vai jogar. Já há um perfil (da conta ou local); escolhe a duração e o modo.
function telaModos() {
  const p = S.perfil, bruto = ls.get('mt-solo', null), rec = ls.get('mt-recorde', null);
  // A partida salva só aparece para o perfil que a começou (ou sem conta, se começou sem conta).
  const salvo = bruto && bruto.v === E.VERSAO_ESTADO && bruto.estados?.eu && !bruto.estados.eu.fim && (!bruto.perfil || bruto.perfil === S.perfilId) ? bruto : null;
  const dia = diaSP(), jogouHoje = ls.get(chaveDesafio(dia), null) || S.ranking?.jogou;
  const top = S.ranking?.top?.slice(0, 3) || [];
  const casas = [
    ['partida', 'Ao passar, +30 BC de mesada.'], ['agencia', 'Depósito de 40 BC, se a conta não passar de 300 BC.'],
    ['util', 'Corda, lona e panela.'], ['exp', 'Mapa, bússola e lanterna.'], ['enf', 'Kit primeiros socorros.'],
    ['pedagio', 'De 2 a 12 BC para o caixa do evento. Em sala, quem para primeiro vira guardião da ponte e ganha 3 BC por pedágio pago ali.'], ['bussola', 'Carta de sorte com uma pergunta.'],
    ['tempestade', 'Carta de revés com uma pergunta.'], ['perdido', 'Pague 10 BC ou arrisque o dado: de 4 a 6 acha a trilha de graça.'],
    ['fogo', 'Mais 20 BC e uma fogueira na tela.'],
    ['troca', 'Troque um item do kit por outro. Nenhum BC muda de conta.'],
  ];
  return `${topo(`<span class="chip">Como vai jogar?</span><span class="sp"></span>${botaoSom()}${botaoMusica()}`)}
  <div class="wrap entrada">
    <div class="box perfil-atual">
      <img src="${fichaSrc(p.ficha)}" alt="">
      <span class="pa-nome"><b>${esc(p.apelido)}</b><span class="note">${esc(E.NIVEIS[p.nivel] || '')}${S.registrado ? '' : ' · sem conta'}</span></span>
      <span class="sp"></span>
      <button class="btn sm" id="trocarPerfil">${S.registrado ? 'Trocar de perfil' : 'Editar'}</button>
    </div>
    ${!S.registrado && !S.temConta ? `<div class="conta-linha"><p><b>Sem conta, só o jogo sozinho neste aparelho.</b> Para salas, desafio do dia, recordes e Minha trilha, um adulto responsável entra com o e-mail.</p><button class="btn" id="abrirConta" ${S.online ? '' : 'disabled'}>Entrar ou criar a conta do responsável</button></div>` : ''}
    <label class="f" style="max-width:340px">Duração (jogo sozinho e sala com código)<select id="rodadas">${E.RODADAS_OPCOES.map((n) => `<option value="${n}" ${n === S.rodadas ? 'selected' : ''}>${n} rodadas${n === E.RODADAS_PADRAO ? ' (padrão)' : ''}</option>`).join('')}</select></label>
    <div class="modos">
      <div class="modo" style="--t:var(--c-util)"><h3>Jogar sozinho</h3><p class="note">Contra 3 rivais virtuais, na hora. Funciona mesmo sem internet depois de aberto.</p>
        <button class="btn big primary" id="solo">Jogar sozinho</button>
        ${salvo ? `<button class="btn" id="continuar" data-modo="${salvo.modo}">${salvo.modo === 'desafio' ? 'Continuar o desafio do dia' : `Continuar partida (rodada ${E.rodadaAtual(salvo.estados.eu)} de ${salvo.estados.eu.rodadas})`}</button>` : ''}
        ${rec ? `<p class="note">Seu recorde: <b>${rec.pontos} pts</b>.</p>` : ''}</div>
      <div class="modo" style="--t:var(--c-agencia)"><h3>Desafio do dia</h3><p class="note">A mesma partida para todo mundo hoje (${dia.split('-').reverse().join('/')}). A primeira tentativa vale para o placar do dia.</p>
        <button class="btn big primary" id="desafio">${jogouHoje ? 'Treinar o desafio de hoje' : 'Jogar o desafio de hoje'}</button>
        ${S.registrado && top.length ? `<p class="note">Placar de hoje: ${top.map((x, i) => `${i + 1}º ${esc(x.apelido)} (${x.pontos})`).join(' · ')}</p>` : ''}</div>
      <div class="modo" style="--t:var(--c-bussola)"><h3>Entrar com código</h3><p class="note">Alguém criou a sala e passou o código de 5 letras.</p>
        <div class="row"><input type="text" id="codigo" maxlength="5" placeholder="Código" style="text-transform:uppercase;flex:1;min-width:7em" autocapitalize="characters" ${S.online ? '' : 'disabled'}><button class="btn primary" id="entrarCod" ${S.online ? '' : 'disabled'}>Entrar</button></div>
        <button class="btn sm" id="criar" ${S.online ? '' : 'disabled'}>Criar uma sala e receber o código</button></div>
      <div class="modo" style="--t:var(--c-fogo)"><h3>Sala de espera</h3><p class="note">Entre na fila e jogue com quem estiver esperando: até 8 jogadores, 12 rodadas, todos juntos.</p>
        <button class="btn big primary" id="fila" ${S.online ? '' : 'disabled'}>Entrar na fila</button></div>
    </div>
    ${S.online ? '' : '<p class="note">Sem conexão com o servidor: as salas ficam indisponíveis, mas você pode jogar sozinho.</p>'}
    <div class="row minhas"><b>Minhas insígnias</b> ${S.insignias.length ? S.insignias.slice(0, 12).map((i) => seloHtml(i)).join('') : '<span class="note">Nenhuma ainda: jogue uma partida até o fim.</span>'}<button class="btn sm" id="trilha">Minha trilha</button><button class="btn sm" id="recordes" ${S.online ? '' : 'disabled'}>Quadro de recordes</button></div>
    <details><summary>Como funciona cada casa</summary>
      <div class="casas">${casas.map(([k, t]) => `<div class="casa-info" style="--t:var(--c-${k})">${ic(k)}<b>${E.CASAS[k].nome}</b><span>${t}</span></div>`).join('')}</div>
      <p class="note" style="margin-top:10px">Pontos: 10 por item do kit, +20 pelo kit completo, +10 por carta acertada, 1 pt a cada 10 BC que sobrarem, o bônus da meta secreta e o Canivete do leilão. A cada 3 rodadas há um evento, anunciado antes; cada item do kit protege de um revés, e nas últimas rodadas créditos e cartas certas valem em dobro. Antes de rolar, você escolhe: rolar de graça, pagar 5 BC pelo dado duplo ou ajudar no acampamento e ganhar 15 BC. Acertar uma carta de Tempestade evita o revés. Desempate: saldo final, depois cartas acertadas.</p>
    </details>
  </div>
  <footer class="wrap rodape"><span class="tb">Um jogo do Trilha HUB</span>${linkHub('entrada', 'Conheça o Trilha HUB')}</footer>`;
}
function ligarModos() {
  $('#rodadas').addEventListener('change', (e) => { S.rodadas = Number(e.target.value); });
  $('#trocarPerfil').addEventListener('click', () => (S.registrado ? abrirPerfis() : abrirEditorLocal()));
  $('#solo').addEventListener('click', () => jogarSozinho(false));
  $('#continuar')?.addEventListener('click', (e) => jogarSozinho(true, e.currentTarget.dataset.modo));
  $('#desafio').addEventListener('click', jogarDesafio);
  $('#trilha').addEventListener('click', abrirTrilha);
  $('#recordes').addEventListener('click', abrirRecordes);
  $('#entrarCod').addEventListener('click', () => entrarComCodigo($('#codigo').value));
  $('#codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarComCodigo(e.target.value); });
  $('#criar').addEventListener('click', criarSala);
  $('#fila').addEventListener('click', entrarNaFila);
  $('#abrirConta')?.addEventListener('click', () => abrirConta());
}

// ---------- Minha trilha (E3) ----------
const MODOS = { solo: 'Sozinho', desafio: 'Desafio do dia', espera: 'Sala de espera', codigo: 'Sala com código' };
async function abrirTrilha() {
  S.trilha = null; S.conta = { dados: null, emailEnviado: null, apagar: false }; ir('trilha');
  // O que está guardado só neste aparelho (sem conta ou sem rede).
  const doAparelho = (extra) => ({ ...extra, partidas: ls.get('mt-historico', []),
    recordes: { solo: ls.get('mt-recorde', null)?.pontos, desafio: ls.get('mt-recorde-desafio', null)?.pontos }, insignias: [] });
  if (S.temConta && !S.registrado) { abrirPerfis(); return; }
  if (!S.registrado) { S.trilha = doAparelho({ semConta: true }); render(); return; }
  try {
    S.trilha = await api('/api/minha-trilha');
    mesclarInsignias(S.trilha.insignias.map((i) => i.id));
    S.conta.dados = await api('/api/conta').catch(() => null);
  } catch {
    S.trilha = doAparelho({ offline: true });
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
      ${t.offline || t.semConta ? '<p class="note">Mostrando só o que está guardado neste aparelho.</p>' : ''}</div>
    ${t.semConta ? `<div class="box"><div class="eyebrow">Conta do responsável</div><p class="note">Sem conta, o histórico e as insígnias ficam só neste aparelho e somem se o navegador for limpo. Com a conta, um adulto responsável guarda tudo e recupera em qualquer aparelho.</p><div class="row"><button class="btn primary" id="trilhaConta" ${S.online ? '' : 'disabled'}>Entrar ou criar a conta do responsável</button></div></div>`
      : t.offline ? '<div class="box"><div class="eyebrow">Conta</div><p class="note">Os dados da conta precisam de conexão com o servidor.</p></div>' : contaHtml()}`;
  return `${topo(`<span class="chip">Minha trilha</span><span class="sp"></span>${botaoSom()}${botaoMusica()}<button class="btn sm" id="voltarTrilha">Voltar</button>`)}
  <div class="wrap trilha stack">${corpo}</div>`;
}
// ---------- Conta do responsável em Minha trilha: e-mail, quadro de recordes, código de recuperação e apagar ----------
function contaHtml() {
  const c = S.conta || {}, d = c.dados;
  if (!d) return '<div class="box"><div class="eyebrow">Conta do responsável</div><p class="muted">Carregando…</p></div>';
  const troca = c.emailEnviado
    ? `<p>Mandamos um código de 6 números para <b>${esc(c.emailEnviado)}</b>. Ele vale por 15 minutos.</p>
      <div class="form-linha"><label class="f">Código do e-mail novo<input id="codigoEmail" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></label><button class="btn primary" id="confirmarEmail">Trocar o e-mail</button></div>`
    : d.emailLigado ? `<div class="form-linha"><label class="f">E-mail novo<input id="emailNovo" type="email" maxlength="120" autocomplete="email" placeholder="responsavel@exemplo.com.br"></label><button class="btn" id="enviarEmail">Enviar código</button></div>`
      : '<p class="note">O envio de e-mail não está ligado neste servidor agora.</p>';
  return `<div class="box"><div class="eyebrow">Conta do responsável</div>
      <p>Conta de <b>${esc(d.conta.email)}</b>. Neste aparelho joga <b>${esc(d.perfil.apelido)}</b>.</p>
      <details${c.emailEnviado ? ' open' : ''}><summary>Trocar o e-mail</summary><div class="stack" style="margin-top:8px">${troca}<p class="note">O e-mail só muda depois de confirmado o código que chegar no e-mail novo.</p></div></details>
      <div class="row"><button class="btn sm" id="sairConta">Sair deste aparelho</button></div>
      <p class="note">Sair deste aparelho não apaga nada: o responsável entra de novo com o e-mail ou com o código de recuperação.</p></div>
    <div class="box"><div class="eyebrow">Quadro de recordes</div>
      ${d.perfil.noQuadro
        ? `<p><b>${esc(d.perfil.apelido)}</b> aparece no quadro de recordes.</p><div class="row"><button class="btn sm" id="quadroNao">Tirar do quadro</button></div>`
        : `<p><b>${esc(d.perfil.apelido)}</b> não aparece no quadro de recordes.</p><div class="row"><button class="btn sm primary" id="quadroSim">Mostrar no quadro</button></div>`}
      <p class="note">O quadro mostra só apelido, ficha e pontos, nunca o e-mail. Quem decide é o responsável, perfil por perfil.</p></div>
    <div class="box"><div class="eyebrow">Perfis da conta · ${d.perfis.length} de ${d.maxPerfis}</div>
      <div class="perfis-lista">${d.perfis.map((x) => `<div class="perfil-linha"><img src="${fichaSrc(x.ficha)}" alt=""><span class="pl-nome"><b>${esc(x.apelido)}</b><span class="note">${esc(E.NIVEIS[x.nivel] || '')}${x.id === d.perfil.id ? ' · neste aparelho' : ''}</span></span><span class="sp"></span>${c.apagarPerfil === x.id ? '' : `<button class="btn sm danger" data-apagar-perfil="${x.id}">Apagar</button>`}</div>
        ${c.apagarPerfil === x.id ? confirmarApagarPerfil(x, c) : ''}`).join('')}</div>
      <div class="row"><button class="btn sm" id="irPerfis">Trocar de perfil ou criar outro</button></div>
      <p class="note">Cada perfil tem o seu histórico, as suas insígnias e o seu código de recuperação. Perfis diferentes jogam ao mesmo tempo em aparelhos diferentes; o mesmo perfil joga em um aparelho por vez.</p></div>
    <div class="box"><div class="eyebrow">Código de recuperação de ${esc(d.perfil.apelido)}</div>
      <p class="note">Outra forma de entrar na conta, sem e-mail: 6 palavras que valem em qualquer aparelho e já escolhem este perfil.</p>
      ${S.codigoNovo ? `<div class="palavras">${S.codigoNovo.map((x) => `<span>${x}</span>`).join('')}</div><p class="note">Anote ou imprima agora: ele aparece só desta vez. Gerar outro código invalida este. Quem tiver estas palavras entra na conta.</p><div class="row"><button class="btn sm" id="copiarCodigo">Copiar</button></div>` : '<div class="row"><button class="btn" id="gerarCodigo">Gerar o código</button></div>'}</div>
    <div class="box apagar-conta"><div class="eyebrow">Apagar a conta</div>
      ${c.apagar ? confirmarApagarConta(d, c)
        : '<p class="note">O responsável pode apagar a conta e todos os dados dela quando quiser.</p><div class="row"><button class="btn sm danger" id="apagarConta">Apagar a conta</button></div>'}</div>`;
}
// Apagar pontuação pede o código enviado ao e-mail da conta: quem decide é o responsável, não quem está com o aparelho.
const campoCodigo = (id, email) => `<p>Mandamos um código de 6 números para <b>${esc(email)}</b>. Ele vale por 15 minutos.</p>
  <label class="f">Código do e-mail<input id="${id}" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></label>`;
function confirmarApagarPerfil(x, c) {
  const passo = !x.pontuacao
    ? `<p class="note">${esc(x.apelido)} ainda não tem nenhuma partida. Apagar o perfil?</p><div class="row"><button class="btn sm danger" data-apagar-sim="${x.id}">Apagar</button><button class="btn sm" id="apagarPerfilNao">Cancelar</button></div>`
    : !c.codigoPerfil
      ? `<p class="note"><b>${esc(x.apelido)} tem pontuação.</b> Apagar leva para sempre as partidas, as insígnias e o código de recuperação. Para isso, o responsável confirma com um código enviado ao e-mail da conta.</p><div class="row"><button class="btn sm" data-codigo-perfil="${x.id}">Enviar código</button><button class="btn sm" id="apagarPerfilNao">Cancelar</button></div>`
      : `${campoCodigo('codigoApagarPerfil', c.codigoPerfil)}<div class="row"><button class="btn sm danger" data-apagar-sim="${x.id}">Apagar ${esc(x.apelido)}</button><button class="btn sm" id="apagarPerfilNao">Cancelar</button></div>`;
  return `<div class="confirmar-apagar">${passo}</div>`;
}
function confirmarApagarConta(d, c) {
  const pontos = d.perfis.some((x) => x.pontuacao);
  const aviso = `<p><b>Isso apaga para sempre</b> o e-mail, todos os perfis, as partidas, as insígnias e os códigos de recuperação, e desconecta todos os aparelhos. Não dá para desfazer.</p>
    <p class="note">O que está guardado só neste aparelho continua aqui até você limpar os dados do site.</p>`;
  if (pontos && !c.codigoConta) return `${aviso}<p class="note">Há perfis com pontuação, então o responsável confirma com um código enviado ao e-mail da conta.</p>
    <div class="row"><button class="btn" id="codigoConta">Enviar código</button><button class="btn" id="apagarNao">Cancelar</button></div>`;
  return `${aviso}${pontos ? campoCodigo('codigoApagarConta', c.codigoConta) : ''}
    <div class="row"><button class="btn danger" id="apagarSim">Sim, apagar a conta</button><button class="btn" id="apagarNao">Cancelar</button></div>`;
}
async function acaoConta(fn, ok) {
  try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); }
  render();
}
// O aparelho deixou de ter conta (saiu ou apagou): esquece a sala e os resultados que ainda iam subir para ela.
function semContaNoAparelho() {
  S.registrado = false; S.temConta = false; S.perfilId = null; S.perfis = []; S.ranking = null; S.trilha = null; S.conta = null; S.codigoNovo = null;
  ls.del('mt-sala'); ls.set('mt-envios', []);
  if (ws) { try { ws.close(); } catch { /* já fechado */ } }
}
function ligarTrilha() {
  $('#voltarTrilha')?.addEventListener('click', () => { S.trilha = null; S.codigoNovo = null; irMenu(); });
  $('#trilhaConta')?.addEventListener('click', () => abrirConta());
  $('#gerarCodigo')?.addEventListener('click', () => acaoConta(async () => { S.codigoNovo = (await api('/api/recuperacao', {})).palavras; }));
  $('#copiarCodigo')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.codigoNovo.join(' ')); toast('Código copiado.'); } catch { toast('Copie as palavras à mão.'); } });
  $('#enviarEmail')?.addEventListener('click', () => acaoConta(async () => {
    S.conta.emailEnviado = (await api('/api/conta/email', { email: $('#emailNovo').value })).email;
  }, 'Código enviado. Veja a caixa de entrada do e-mail novo.'));
  $('#confirmarEmail')?.addEventListener('click', () => acaoConta(async () => {
    await api('/api/conta/email/confirmar', { codigo: $('#codigoEmail').value });
    S.conta.dados = await api('/api/conta'); S.conta.emailEnviado = null;
  }, 'Pronto: o e-mail da conta foi trocado.'));
  const quadro = (sim) => acaoConta(async () => {
    await api('/api/conta/quadro', { sim });
    S.conta.dados = await api('/api/conta');
  }, sim ? 'Pronto: a conta aparece no quadro de recordes.' : 'A conta saiu do quadro de recordes.');
  $('#quadroSim')?.addEventListener('click', () => quadro(true));
  $('#quadroNao')?.addEventListener('click', () => quadro(false));
  $('#apagarConta')?.addEventListener('click', () => { S.conta.apagar = true; render(); });
  $('#irPerfis')?.addEventListener('click', () => abrirPerfis());
  app.querySelectorAll('[data-apagar-perfil]').forEach((b) => b.addEventListener('click', () => { S.conta.apagarPerfil = b.dataset.apagarPerfil; S.conta.codigoPerfil = null; render(); }));
  $('#apagarPerfilNao')?.addEventListener('click', () => { S.conta.apagarPerfil = null; S.conta.codigoPerfil = null; render(); });
  app.querySelectorAll('[data-codigo-perfil]').forEach((b) => b.addEventListener('click', () => acaoConta(async () => {
    S.conta.codigoPerfil = (await api('/api/conta/codigo-apagar', { acao: 'apagar_perfil', id: b.dataset.codigoPerfil })).email;
  }, 'Código enviado ao e-mail da conta.')));
  app.querySelectorAll('[data-apagar-sim]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const r = await api('/api/perfis/apagar', { id: b.dataset.apagarSim, confirmo: true, codigo: $('#codigoApagarPerfil')?.value });
      aplicarConta(r); S.conta.apagarPerfil = null; S.conta.codigoPerfil = null;
      toast('O perfil foi apagado.');
      if (!S.registrado) { abrirPerfis(); return; }
      S.conta.dados = { ...(await api('/api/conta')) };
    } catch (e) { toast(e.message); }
    render();
  }));
  $('#apagarNao')?.addEventListener('click', () => { S.conta.apagar = false; S.conta.codigoConta = null; render(); });
  $('#codigoConta')?.addEventListener('click', () => acaoConta(async () => {
    S.conta.codigoConta = (await api('/api/conta/codigo-apagar', { acao: 'apagar_conta' })).email;
  }, 'Código enviado ao e-mail da conta.'));
  $('#apagarSim')?.addEventListener('click', async () => {
    try {
      await api('/api/conta/apagar', { confirmo: true, codigo: $('#codigoApagarConta')?.value });
      semContaNoAparelho(); toast('A conta e todos os dados dela foram apagados.'); ir('entrada');
    } catch (e) { toast(e.message); }
  });
  $('#sairConta')?.addEventListener('click', async () => {
    try {
      await api('/api/conta/sair', {});
      semContaNoAparelho(); toast('Este aparelho saiu da conta.'); ir('entrada');
    } catch (e) { toast(e.message); }
  });
}

// ---------- Quem vai jogar? (perfis da conta, como num serviço de streaming) ----------
async function abrirPerfis(pedida = false) {
  if (pedida) toast('Escolha quem vai jogar neste aparelho.');
  S.editandoPerfis = false; ir('perfis');
  try { aplicarConta(await api('/api/conta')); } catch (e) { toast(e.message); }
  render();
}
// Passo 2: escolher o perfil (como num serviço de streaming), criar um novo ou, no modo de edição, abrir o editor.
function telaPerfis() {
  const cheia = S.perfis.length >= S.maxPerfis, ed = S.editandoPerfis;
  const lista = S.perfis.map((x) => `<button class="perfil-card${!ed && x.id === S.perfilId ? ' atual' : ''}${ed ? ' editando' : ''}" data-perfil="${x.id}">
      ${ed ? `<span class="editar-ico" aria-hidden="true">${ic('ajustes')}</span>` : ''}
      <img src="${fichaSrc(x.ficha)}" alt=""><b>${esc(x.apelido)}</b><span class="note">${esc(E.NIVEIS[x.nivel] || '')}</span>
      ${!ed && x.id === S.perfilId ? '<span class="note">neste aparelho</span>' : ''}</button>`).join('');
  const novo = ed || cheia ? '' : '<button class="perfil-card novo" id="novoPerfil"><span class="mais" aria-hidden="true">+</span><b>Novo perfil</b></button>';
  return `${topo(`<span class="chip">Quem vai jogar?</span><span class="sp"></span><button class="btn sm" id="editarPerfis" aria-pressed="${ed}">${ed ? 'Pronto' : 'Editar'}</button>${S.registrado ? '<button class="btn sm" id="voltarPerfis">Voltar</button>' : ''}`)}
  <div class="wrap trilha stack">
    <h2>${ed ? 'Qual perfil editar?' : 'Quem vai jogar?'}</h2>
    <div class="perfis-grade">${lista}${novo}</div>
    ${!ed && cheia ? `<p class="note">A conta já tem ${S.maxPerfis} perfis. Para criar outro, apague um primeiro (toque em Editar).</p>` : ''}
    <p class="note">Cada criança tem o seu perfil, com histórico, insígnias e quadro de recordes próprios. Perfis diferentes jogam ao mesmo tempo em aparelhos diferentes; o mesmo perfil joga em um aparelho por vez.</p>
    <div class="row"><button class="btn sm" id="sairContaPerfis">Sair da conta</button></div>
  </div>`;
}
function ligarPerfis() {
  $('#voltarPerfis')?.addEventListener('click', () => ir('modos'));
  $('#editarPerfis').addEventListener('click', () => { S.editandoPerfis = !S.editandoPerfis; render(); });
  app.querySelectorAll('[data-perfil]').forEach((b) => b.addEventListener('click', async () => {
    if (S.editandoPerfis) { abrirEditorExistente(b.dataset.perfil); return; }
    try {
      aplicarConta(await api('/api/perfis/escolher', { id: b.dataset.perfil }));
      toast(`Bom jogo, ${S.perfil.apelido}!`);
      enviarPendentes(); carregarRanking();
      ir('modos');
    } catch (e) { toast(e.message); }
  }));
  $('#novoPerfil')?.addEventListener('click', () => abrirEditorNovo());
  $('#sairContaPerfis')?.addEventListener('click', async () => {
    try { await api('/api/conta/sair', {}); semContaNoAparelho(); toast('Este aparelho saiu da conta.'); ir('entrada'); } catch (e) { toast(e.message); }
  });
}

// ---------- Novo perfil, editar ou apagar (sem conta: identidade guardada só neste aparelho) ----------
function abrirEditorLocal() {
  S.perfilEditor = { modo: 'local', form: { ...S.perfil } };
  ir('perfilEditor');
}
function abrirEditorNovo() {
  S.perfilEditor = { modo: 'novo', form: { apelido: '', ficha: E.FICHAS[0].id, nivel: E.NIVEL_PADRAO } };
  ir('perfilEditor');
}
async function abrirEditorExistente(id) {
  const x = S.perfis.find((p) => p.id === id); if (!x) return;
  try {
    // Editar pede que o perfil esteja escolhido neste aparelho: é nele que /api/eu grava.
    aplicarConta(await api('/api/perfis/escolher', { id }));
  } catch (e) { toast(e.message); return; }
  S.perfilEditor = { modo: 'editar', id, form: { apelido: x.apelido, ficha: x.ficha, nivel: x.nivel }, pontuacao: x.pontuacao, apagar: false, codigoPerfil: null };
  ir('perfilEditor');
}
function telaPerfilEditor() {
  const ed = S.perfilEditor, f = ed.form, novo = ed.modo === 'novo', local = ed.modo === 'local';
  const titulo = local ? 'Quem vai jogar neste aparelho?' : novo ? 'Novo perfil' : 'Editar perfil';
  const apagarBloco = !local && ed.modo === 'editar' ? (ed.apagar
    ? confirmarApagarPerfil({ id: ed.id, apelido: f.apelido, pontuacao: ed.pontuacao }, ed)
    : `<div class="row"><button class="btn sm danger" id="pedirApagarPerfil">Apagar este perfil</button></div>`) : '';
  return `${topo(`<span class="chip">${titulo}</span><span class="sp"></span><button class="btn sm" id="voltarEditor">Cancelar</button>`)}
  <div class="wrap trilha stack">
    <div class="box">
      <h2>${titulo}</h2>
      <label class="f">Apelido<input type="text" id="editApelido" maxlength="20" autocomplete="off" placeholder="Ex.: Coruja Atenta" value="${esc(f.apelido)}"></label>
      <div class="stack" style="gap:6px"><span class="f" style="font-weight:600;font-size:.9rem">Escolha a sua ficha</span>
        <div class="fichas" role="radiogroup" aria-label="Fichas">${E.FICHAS.map((x) => `<button type="button" class="ficha-op" role="radio" aria-checked="${f.ficha === x.id}" data-ed-ficha="${x.id}" title="${esc(x.nome)}"><img src="${fichaSrc(x.id)}" alt="${esc(x.nome)}"></button>`).join('')}</div>
        <span class="note" id="editFichaNome">${esc(fichaNome(f.ficha))}</span>
      </div>
      <div class="stack" style="gap:6px"><span class="f" style="font-weight:600;font-size:.9rem">Nível</span>${nivelHtml(f.nivel, 'data-ed-nivel')}
        <span class="note">Define as cartas que saem. Lobinhos leem o texto curto.</span></div>
      <div class="row"><button class="btn primary" id="salvarEditor">${local ? 'Continuar' : novo ? 'Criar e jogar' : 'Salvar'}</button><button class="btn" id="cancelarEditor">Cancelar</button></div>
      ${apagarBloco}
    </div>
  </div>`;
}
function ligarPerfilEditor() {
  const ed = S.perfilEditor;
  $('#voltarEditor').addEventListener('click', () => ir(ed.modo === 'local' ? 'entrada' : 'perfis'));
  $('#cancelarEditor').addEventListener('click', () => ir(ed.modo === 'local' ? 'entrada' : 'perfis'));
  $('#editApelido').addEventListener('input', (e) => { ed.form.apelido = e.target.value; });
  app.querySelectorAll('[data-ed-ficha]').forEach((b) => b.addEventListener('click', () => {
    ed.form.ficha = b.dataset.edFicha;
    app.querySelectorAll('[data-ed-ficha]').forEach((x) => x.setAttribute('aria-checked', x === b));
    $('#editFichaNome').textContent = fichaNome(ed.form.ficha);
  }));
  app.querySelectorAll('[data-ed-nivel]').forEach((b) => b.addEventListener('click', () => {
    ed.form.nivel = b.dataset.edNivel;
    app.querySelectorAll('[data-ed-nivel]').forEach((x) => x.setAttribute('aria-checked', x === b));
  }));
  $('#salvarEditor').addEventListener('click', async () => {
    const apelido = ed.form.apelido.trim();
    if (apelido.length < 2) { toast('Escreva um apelido com pelo menos 2 letras.'); return; }
    try {
      if (ed.modo === 'local') {
        S.perfil = { ...S.perfil, ...ed.form, apelido };
        ls.set('mt-perfil', S.perfil); ls.set('mt-rodadas', S.rodadas);
        S.perfilEditor = null; ir('modos'); return;
      }
      if (ed.modo === 'novo') {
        aplicarConta(await api('/api/perfis', { apelido, ficha: ed.form.ficha, nivel: ed.form.nivel }));
        S.perfilEditor = null;
        toast(`Perfil criado. Bom jogo, ${S.perfil.apelido}!`);
        ir('modos'); return;
      }
      // editar: o perfil já está escolhido neste aparelho (abrirEditorExistente chamou /api/perfis/escolher)
      await api('/api/eu', { apelido, ficha: ed.form.ficha, nivel: ed.form.nivel });
      S.perfil = { ...S.perfil, apelido, ficha: ed.form.ficha, nivel: ed.form.nivel }; ls.set('mt-perfil', S.perfil);
      S.perfis = S.perfis.map((x) => (x.id === ed.id ? { ...x, apelido, ficha: ed.form.ficha, nivel: ed.form.nivel } : x));
      S.perfilEditor = null;
      toast('Perfil salvo.');
      ir('perfis');
    } catch (e) { toast(e.message); }
  });
  $('#pedirApagarPerfil')?.addEventListener('click', () => { ed.apagar = true; render(); });
  $('#apagarPerfilNao')?.addEventListener('click', () => { ed.apagar = false; ed.codigoPerfil = null; render(); });
  app.querySelectorAll('[data-codigo-perfil]').forEach((b) => b.addEventListener('click', () => acaoConta(async () => {
    ed.codigoPerfil = (await api('/api/conta/codigo-apagar', { acao: 'apagar_perfil', id: b.dataset.codigoPerfil })).email;
  }, 'Código enviado ao e-mail da conta.')));
  app.querySelectorAll('[data-apagar-sim]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const r = await api('/api/perfis/apagar', { id: b.dataset.apagarSim, confirmo: true, codigo: $('#codigoApagarPerfil')?.value });
      aplicarConta(r);
      S.perfilEditor = null;
      toast('O perfil foi apagado.');
      ir(S.temConta ? 'perfis' : 'entrada');   // apagar o perfil ativo não tira o aparelho da conta: só falta escolher outro
    } catch (e) { toast(e.message); }
  }));
}

// ---------- Entrar ou criar a conta do responsável (e-mail + código) ----------
function abrirConta(pedida = false) {
  if (pedida) toast('Para isso, um responsável precisa entrar com o e-mail.');
  S.entrada = { enviado: null, email: '' };
  ir('conta');
}
function telaConta() {
  const e = S.entrada || {}, p = S.perfil;
  let corpo;
  if (!S.emailLigado) corpo = '<p class="note">O envio de e-mail ainda não está ligado neste servidor, então ainda não dá para entrar ou criar a conta. Enquanto isso, dá para jogar sozinho.</p>';
  else if (!e.enviado) corpo = `
    <label class="f">E-mail do responsável<input id="contaEmail" type="email" maxlength="120" autocomplete="email" placeholder="responsavel@exemplo.com.br" value="${esc(e.email)}"></label>
    <label class="check"><input type="checkbox" id="contaMaior"><span>Tenho 18 anos ou mais e sou responsável pela criança que vai jogar.</span></label>
    <div class="row"><button class="btn primary" id="contaEnviar">Enviar código</button></div>`;
  else corpo = `
    <p>Mandamos um código de 6 números para <b>${esc(e.enviado)}</b>. Ele vale por 15 minutos.</p>
    <label class="f">Código do e-mail<input id="contaCodigo" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></label>
    <div class="conta-quem"><img src="${fichaSrc(p.ficha)}" alt="${esc(fichaNome(p.ficha))}"><label class="f">Se a conta for nova, a criança joga como<input id="contaApelido" type="text" maxlength="20" autocomplete="nickname" placeholder="Ex.: Lobo Veloz" value="${esc(p.apelido)}"></label></div>
    <div class="stack" style="gap:6px"><span class="f" style="font-weight:600;font-size:.9rem">Nível da criança</span>${nivelHtml(p.nivel, 'data-conta-nivel')}</div>
    <p class="note">Se a conta já existir, entramos nela e você escolhe quem vai jogar entre os perfis dela.</p>
    <div class="row"><button class="btn primary" id="contaEntrar">Entrar</button><button class="btn" id="contaOutro">Usar outro e-mail</button></div>`;
  return `${topo(`<span class="chip">Conta do responsável</span><span class="sp"></span><button class="btn sm" id="voltarConta">Voltar</button>`)}
  <div class="wrap trilha stack">
    <div class="box">
      <h2>Conta do responsável</h2>
      <p>A conta é de um adulto: o pai, a mãe ou o responsável legal. A criança joga dentro dela.</p>
      <p class="note">Com a conta, a criança joga em salas, faz o desafio do dia, guarda o histórico e as insígnias em Minha trilha e pode aparecer no quadro de recordes, se o responsável quiser. Sem conta, só dá para jogar sozinho neste aparelho.</p>
      ${corpo}
    </div>
    <p class="note">O e-mail serve só para entrar na conta e receber os códigos. Ele nunca aparece para outros jogadores. Não pedimos nenhum dado da criança.</p>
  </div>`;
}
function ligarConta() {
  $('#voltarConta')?.addEventListener('click', () => { S.entrada = null; irMenu(); });
  const enviar = async () => {
    const email = $('#contaEmail').value.trim();
    if (!$('#contaMaior').checked) { toast('Marque que você é um adulto responsável pela criança.'); return; }
    try {
      const r = await api('/api/conta/codigo', { email, maior: true });
      S.entrada = { email, enviado: r.email };
      toast('Código enviado. Veja a caixa de entrada.');
      render();
    } catch (err) { toast(err.message); }
  };
  $('#contaEnviar')?.addEventListener('click', enviar);
  $('#contaEmail')?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') enviar(); });
  $('#contaOutro')?.addEventListener('click', () => { S.entrada = { email: S.entrada?.email || '', enviado: null }; render(); });
  app.querySelectorAll('[data-conta-nivel]').forEach((b) => b.addEventListener('click', () => {
    S.perfil.nivel = b.dataset.contaNivel; ls.set('mt-perfil', S.perfil);
    app.querySelectorAll('[data-conta-nivel]').forEach((x) => x.setAttribute('aria-checked', x === b));
  }));
  const entrar = async () => {
    const apelido = $('#contaApelido').value.trim();
    if (apelido) S.perfil.apelido = apelido;
    try {
      const r = await api('/api/conta/entrar', { email: S.entrada.email, codigo: $('#contaCodigo').value, maior: true, apelido: S.perfil.apelido, ficha: S.perfil.ficha, nivel: S.perfil.nivel });
      aplicarConta(r);
      S.entrada = null;
      if (!r.perfil) { toast('Conta conectada. Escolha quem vai jogar.'); abrirPerfis(); return; }
      toast(`Conta conectada. Bom jogo, ${r.perfil.apelido}!`);
      enviarPendentes(); carregarRanking();
      ir('modos');
    } catch (err) { toast(err.message); }
  };
  $('#contaEntrar')?.addEventListener('click', entrar);
  $('#contaCodigo')?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') entrar(); });
}

// ---------- Quadro de recordes (só para quem tem conta; mostra as contas que o responsável inscreveu) ----------
async function abrirRecordes() {
  if (!S.registrado) { pedirConta(); return; }
  S.quadro = null; ir('recordes');
  try { S.quadro = await api('/api/recordes'); } catch { S.quadro = { erro: true }; }
  render();
}
function telaRecordes() {
  const q = S.quadro;
  const lista = (k) => (q[k]?.length ? `<ol>${q[k].map((x) => `<li><img src="${fichaSrc(x.ficha)}" alt=""><span>${esc(x.apelido)}</span><b>${x.pontos} pts</b></li>`).join('')}</ol>` : '<p class="note">Ninguém ainda.</p>');
  const corpo = !q ? '<p class="muted">Carregando…</p>' : q.erro ? '<p class="note">Não foi possível carregar o quadro agora.</p>'
    : `<div class="quadro">${Object.entries(MODOS).map(([k, nome]) => `<div class="box"><div class="eyebrow">${nome}</div>${lista(k)}</div>`).join('')}</div>
      <p class="note">Aparecem só as contas que o responsável colocou no quadro. Para entrar ou sair, abra Minha trilha.</p>`;
  return `${topo(`<span class="chip">Quadro de recordes</span><span class="sp"></span>${botaoSom()}${botaoMusica()}<button class="btn sm" id="voltarRecordes">Voltar</button>`)}
  <div class="wrap trilha stack">${corpo}</div>`;
}
function ligarRecordes() { $('#voltarRecordes')?.addEventListener('click', () => { S.quadro = null; irMenu(); }); }

// ---------- Contador anônimo do jogo sozinho (só quantas partidas começaram e terminaram) ----------
function contar(evento) {
  const c = ls.get('mt-contador', { inicio: 0, fim: 0 });
  c[evento] = (c[evento] || 0) + 1; ls.set('mt-contador', c);
  enviarContador();
}
async function enviarContador() {
  const c = ls.get('mt-contador', { inicio: 0, fim: 0 });
  if (!S.online || (!c.inicio && !c.fim)) return;
  const env = { inicio: Math.min(c.inicio || 0, 50), fim: Math.min(c.fim || 0, 50) };
  try {
    const r = await fetch('/api/contador', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(env) });
    if (r.ok) ls.set('mt-contador', { inicio: c.inicio - env.inicio, fim: c.fim - env.fim });
  } catch { /* fica para a próxima vez */ }
}


function telaFila() {
  const f = S.fila, js = f?.jogadores || [], max = f?.max || 8;
  const vagas = Math.max(0, Math.min(max, Math.max(2, js.length + 1)) - js.length);
  return `${topo(`<span class="chip">Sala de espera</span><span class="sp"></span>${botaoSom()}${botaoMusica()}<button class="btn sm" id="sairFila">Sair da fila</button>`)}
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
    // O reflexo da fogueira entra pelo lado da pedra virado para o centro do tabuleiro.
    const dx = 3.5 - c, dy = 3.5 - r, m = Math.max(Math.abs(dx), Math.abs(dy));
    const fx = Math.round(50 + (dx / m) * 48), fy = Math.round(50 + (dy / m) * 48);
    const v = (i * 3 + Math.floor(i / 4)) % 5;   // forma e rachaduras da pedra: varia sem repetir a vizinha
    return `<div class="cell v${v}" data-casa="${i}" style="grid-row:${r};grid-column:${c};--t:var(--c-${k});--fx:${fx}%;--fy:${fy}%" title="${E.CASAS[k].nome}"><span class="pedra"></span>${ic(k)}<span class="lbl">${E.CASAS[k].nome}</span><span class="guardiao" hidden></span><span class="farol"></span></div>`;
  }).join('');
  // O cenário fica embaixo das casas: o dia carrega já; noite e chuva só quando forem usados (ou com folga).
  const cenario = `<div class="cenario" aria-hidden="true"><img class="c-dia" src="img/cenario/dia.webp" alt="" decoding="async"><img class="c-noite" data-src="img/cenario/noite.webp" alt="" decoding="async"><img class="c-chuva" data-src="img/cenario/chuva.webp" alt="" decoding="async"></div>`;
  // Brilho e fagulhas sobre a fogueira pintada no cenário (ela já tem lenha, chamas e o anel de pedras).
  const fogueira = '<div class="fogueira-centro" aria-hidden="true"><div class="brilho"></div><div class="brilho b2"></div><div class="fagulhas"><i></i><i></i><i></i><i></i><i></i></div></div>';
  return `<div class="board" id="board" aria-label="Tabuleiro">${cenario}${cells}
    <div class="centro">${fogueira}<p class="j-nota" id="jNota" role="status" aria-live="polite"></p>
      <div class="dados" id="dados" aria-hidden="true"></div></div>
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
  definirClima(E.climaDaRodada(st));
}

// Troca o cenário com um fade (só opacidade); a imagem é baixada na primeira vez que for usada.
function definirClima(clima) {
  const b = $('#board'); if (!b) return;
  for (const c of ['noite', 'chuva']) b.classList.toggle(c, clima === c);
  carregarCenario(b.querySelector(`.c-${clima}`));
}
const carregarCenario = (img) => { if (img && !img.getAttribute('src')) img.setAttribute('src', img.dataset.src); };
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
// Uma opção do dado duplo: o dado, quantas casas anda e a casa onde cai.
function opcaoDado(st, v, i, trava) {
  const n = E.TABULEIRO.length, pos = (st.pos + v) % n, k = E.TABULEIRO[pos], casa = E.CASAS[k];
  const extras = [
    st.pos + v >= n ? `Passa na Partida: +${E.MESADA} BC` : '',
    casa.loja && E.lojaFechada(st, k) ? 'Loja fechada' : '',
    casa.loja && E.descontoFeira(st, k) ? 'Feira com desconto' : '',
  ].filter(Boolean);
  return `<button class="dado-esc" data-esc="${i}" style="--d:var(--c-${k})" ${trava}>
    ${dadoHtml(v)}
    <span class="passos">Andar ${v} ${v === 1 ? 'casa' : 'casas'}</span>
    <span class="destino">Cai em<b>${ic(k)}${casa.nome}</b></span>
    ${extras.map((t) => `<small>${t}</small>`).join('')}
  </button>`;
}

function placarHtml() {
  const agora = Date.now();
  return `<div class="placar">${S.placar.map((p, i) => {
    const seta = S.setas[p.ordem], d = S.delta[p.ordem];
    return `<div class="pl${p.eu ? ' eu' : ''}" style="--pc:${p.cor}" data-ordem-placar="${p.ordem}" role="button" tabindex="0" title="Ver ficha de ${esc(p.apelido)}"><span class="pos">${i + 1}${seta ? `<span class="seta ${seta}" aria-label="${seta === 'up' ? 'subiu' : 'desceu'}">${seta === 'up' ? '▲' : '▼'}</span>` : ''}</span><img src="${fichaSrc(p.ficha)}" alt="${esc(fichaNome(p.ficha))}"><div><div class="nm">${esc(p.apelido)}${p.eu ? ' (você)' : ''} ${(p.insignias || []).slice(0, 3).map((i) => seloHtml(i)).join('')}</div><div class="meta">${p.patrulha != null ? `${esc(S.sala?.patrulhas?.find((x) => x.n === p.patrulha)?.nome || '')} · ` : ''}Kit ${p.kit}/7 · rodada ${Math.min(p.rodada + (p.fim ? 0 : 1), eu()?.rodadas || 12)}${p.fim ? ' · terminou' : ''}${S.sala?.tipo === 'espera' && p.feito && !p.fim ? ' · pronto' : ''} · ${p.saldo} BC</div></div><span class="pts">${d && d.ate > agora ? `<span class="delta">+${d.v}</span>` : ''}${p.pontos} pts</span></div>`;
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

function reacoesHtml() {
  return `<div class="reacoes" id="reacoes" role="group" aria-label="Reações rápidas">${E.REACOES.map((r, i) => `<button class="btn sm" data-reacao="${i}">${r}</button>`).join('')}</div>`;
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

// A7: ofertas de troca dos outros jogadores da sala.
function painelOfertas() {
  const of = S.sala?.ofertas, st = eu();
  if (!of?.length || !st || st.fim) return '';
  const nome = (id) => E.ITENS.find((i) => i.id === id)?.nome;
  return `<div class="painel" style="--t:var(--c-troca)"><div class="tag">Feira de Trocas · ofertas</div><div class="ofertas">${of.map((o) => `<div class="oferta"><span><b>${esc(o.apelido)}</b> dá ${nome(o.dar)} e quer ${nome(o.querer)}</span>${o.possoAceitar ? `<button class="btn sm primary" data-aceitar="${o.de}">Aceitar</button>` : `<span class="note">Você precisa ter ${nome(o.querer)} e não ter ${nome(o.dar)}.</span>`}</div>`).join('')}</div></div>`;
}
// ---------- Tela do jogo: uma tela só, sem rolagem ----------
// Topo com a ficha, o placar (saldo e pontos), a meta secreta e os amigos; o tabuleiro no maior tamanho possível;
// os ícones de jogada e o kit no rodapé. O espaço que sobra vira informação, por prioridade: acontecimentos,
// reações (só nas salas) e missão da sala. Em tela curta nada disso aparece.

// O balão do centro do tabuleiro: o resultado da última jogada. Avisos fixos (parado, esperando) ficam até mudar.
const NOTA = { t: 0 };
function mostrarNota(txt, fixo = false) {
  const el = $('#jNota'); if (!el) return;
  clearTimeout(NOTA.t);
  if (!txt) { el.classList.remove('ver'); return; }
  el.textContent = txt; el.classList.add('ver');
  if (!fixo) NOTA.t = setTimeout(() => el.classList.remove('ver'), 4200);
}

// Acontecimentos: o que o jogo avisa e o que os outros jogadores fazem, do mais novo para o mais antigo.
function reiniciarFaixas() { S.log = []; S.ultimoNota = null; S.kitAnt = null; S.placarAnt = null; S.muralVisto = false; }
function anotar(texto, cor, tipo = '') {
  if (S.log.slice(0, 4).some((l) => l.texto === texto)) return;   // a mesma notícia pode vir de várias cenas
  S.log.unshift({ texto, cor, tipo, rodada: S.eu ? E.rodadaAtual(S.eu) : 1 });
  if (S.log.length > 40) S.log.length = 40;
  S.logNovo = true;
}
// Cada cena (gasto, crédito, fogo...) vira uma linha. Na sala, o servidor já conta fogo, kit, ponte, missão, troca e
// carta de sala no mural; no jogo sozinho essas linhas saem das cenas dos rivais.
function registrarCenas(novas, m) {
  const minha = minhaOrdem(m), solo = S.modo === 'solo';
  for (const c of novas) {
    const p = m.placar.find((x) => x.ordem === c.ordem); if (!p) continue;
    const meu = c.ordem === minha, quem = meu ? 'Você' : p.apelido;
    for (const ev of c.cena) {
      if (ev.t === 'gasto' && meu) anotar(`Você: ${ev.d}, -${ev.v} BC`, p.cor);
      else if (ev.t === 'credito' && meu) anotar(`Você: ${ev.d}, +${ev.v} BC`, p.cor);
      else if (ev.t === 'andou' && !meu && ev.passos > 0) anotar(`${quem} andou ${ev.passos} ${ev.passos === 1 ? 'casa' : 'casas'}`, p.cor);
      else if (ev.t === 'recusa') anotar(`${quem}: pagamento recusado (${ev.d})`, p.cor, 'aviso');
      else if (ev.t === 'anuncio' && meu) anotar(`Na próxima rodada: ${E.descreverEvento(ev)}`, null, 'aviso');
      else if (ev.t === 'evento' && meu) anotar(`Evento da rodada: ${E.descreverEvento(ev)}`, null, 'aviso');
      else if (ev.t === 'noite' && meu) anotar('Noite no acampamento: créditos e cartas certas valem em dobro', null, 'aviso');
      else if (solo) {
        if (ev.t === 'fogo') anotar(`${quem} chegou ao Fogo de Conselho`, p.cor);
        else if (ev.t === 'kit') anotar(`${quem} completou o kit`, p.cor, 'aviso');
        else if (ev.t === 'ponte') anotar(`${quem} assumiu a ponte`, p.cor);
        else if (ev.t === 'missao') anotar(`${quem} cumpriu a missão: ${ev.nome}`, p.cor, 'aviso');
        else if (ev.t === 'troca') anotar(`${quem} fez uma troca na Feira`, p.cor);
        else if (ev.t === 'sala') anotar(`${ev.de} tirou a carta de sala "${ev.carta}"`, p.cor);
      }
    }
  }
}
// Mural da sala: as linhas novas entram nos acontecimentos (as reações que já entraram na hora não repetem).
function registrarMural(novo, antes) {
  if (!S.muralVisto) { S.muralVisto = true; return; }   // o mural que já existia ao entrar não vira notícia
  const tinha = new Set((antes || []).map((x) => `${x.texto}|${x.cor}`));
  for (const x of novo || []) {
    if (tinha.has(`${x.texto}|${x.cor}`)) continue;
    anotar(x.texto, x.cor, /^O anfitrião|Evento da rodada|Votação|Leilão|Canivete/.test(x.texto) ? 'aviso' : '');
  }
}

const metaChave = (st) => `${S.modo}:${st.seed}:${st.meta}`;

// ----- Topo -----
function atualizarTopo(st) {
  const cor = S.modo === 'sala' ? (S.eu?.cor || COR_SOLO) : COR_SOLO;
  const pts = E.pontuacao(st).total;
  $('#jJogador').innerHTML = `<img class="j-avatar" src="${fichaSrc(st.ficha)}" alt="${esc(fichaNome(st.ficha))}" style="--pc:${cor}">
    <button class="j-placar" id="bConta" type="button" aria-label="Sua conta: saldo ${st.saldo} BC, ${pts} pontos. Toque para ver o extrato">
      <span class="jp-cab"><span class="jp-nome">${esc(st.apelido)}</span><span>Rodada ${E.rodadaAtual(st)}/${st.rodadas}</span></span>
      <span class="jp-vals"><span class="jp-val">${ic('moeda')}<b id="saldoNum">${st.saldo}</b><small>BC</small></span><i class="jp-div"></i><span class="jp-val"><b id="pontosNum">${pts}</b><small>pts</small></span></span>
    </button>`;
  const ant = S.placarAnt;
  if (ant && !reduzir) {
    if (pts !== ant.pontos) piscarValor('#pontosNum', pts > ant.pontos);
    if (st.saldo !== ant.saldo && !S.cenaEmCurso) piscarValor('#saldoNum', st.saldo > ant.saldo);
  }
  S.placarAnt = { saldo: st.saldo, pontos: pts };
  // meta secreta: pisca até o jogador abrir a carta
  const meta = $('#bMeta'), vista = S.metaVista === metaChave(st);
  meta.classList.toggle('pisca', !vista); meta.hidden = !st.meta;
  atualizarAmigos();
  const t = $('#timer'), s = S.sala;
  if (t) t.hidden = !(S.modo === 'sala' && s?.tipo === 'espera' && s.status === 'em_jogo');
}
function piscarValor(sel, sobe) {
  const el = $(sel); if (!el) return;
  el.classList.remove('sobe', 'desce'); void el.offsetWidth; el.classList.add(sobe ? 'sobe' : 'desce');
}

// ----- Amigos: um grupo de fichas que abre o placar e os acontecimentos -----
function amigosListaHtml() {
  return S.placar.map((p, i) => `<div class="j-amigo${p.eu ? ' eu' : ''}" style="--c:${p.cor}" data-ordem-placar="${p.ordem}" role="button" tabindex="0" title="Ver ficha de ${esc(p.apelido)}"><span class="pos">${i + 1}</span><img src="${fichaSrc(p.ficha)}" alt=""><span><b>${esc(p.apelido)}${p.eu ? ' (você)' : ''}</b><small>${p.patrulha != null ? `${esc(S.sala?.patrulhas?.find((x) => x.n === p.patrulha)?.nome || '')} · ` : ''}Saldo ${p.saldo} BC · Kit ${p.kit}/7${p.fim ? ' · terminou' : ''}</small></span><span class="pts">${p.pontos} pts</span></div>`).join('');
}
function logListaHtml() {
  return S.log.slice(0, 10).map((l) => `<div class="j-log-item ${l.tipo}" style="--c:${l.cor || 'var(--muted)'}"><span class="rod">R${l.rodada}</span><i></i><span>${esc(l.texto)}</span></div>`).join('') || '<p class="note">Ainda não aconteceu nada.</p>';
}
function atualizarAmigos() {
  const outros = S.placar.filter((p) => !p.eu), bt = $('#bAmigos'), painel = $('#jAmigos');
  bt.hidden = outros.length === 0;
  if (!outros.length) { painel.hidden = true; return; }
  $('#jPilha').innerHTML = outros.slice(0, 4).map((p) => `<img src="${fichaSrc(p.ficha)}" alt="${esc(p.apelido)}" title="${esc(p.apelido)}">`).join('');
  const s = S.sala, cab = s ? `<p class="j-sala-cab">${s.tipo === 'espera' ? 'Sala de espera' : `Sala <b>${esc(s.codigo)}</b>`}</p>` : '';
  painel.innerHTML = `${cab}<div class="j-abas" role="tablist"><button type="button" role="tab" data-aba="placar" aria-selected="${S.aba === 'placar'}">Amigos</button><button type="button" role="tab" data-aba="log" aria-selected="${S.aba === 'log'}">Acontecimentos</button></div>${S.aba === 'placar' ? `${amigosListaHtml()}${S.sala?.patrulhas ? patrulhasHtml() : ''}` : logListaHtml()}`;
}
function alternarAmigos(abrir) {
  const painel = $('#jAmigos'), bt = $('#bAmigos'); if (!painel) return;
  const ver = abrir ?? painel.hidden;
  painel.hidden = !ver; bt.setAttribute('aria-expanded', String(ver));
}

// ----- Faixas que aproveitam o espaço livre -----
function atualizarFaixas() {
  const ac = $('#jAcontece');
  if (ac) {
    ac.innerHTML = `<h2>Acontecimentos</h2><ol>${S.log.slice(0, 8).map((l, i) => `<li class="${l.tipo}${i === 0 && S.logNovo ? ' novo' : ''}" style="--c:${l.cor || 'var(--muted)'}"><span>${esc(l.texto)}</span></li>`).join('') || '<li><span>A partida começou. Boa sorte!</span></li>'}</ol>`;
    S.logNovo = false;
  }
  const mi = $('#jMissao'), m = S.sala?.missao || S.missaoSolo, st = eu();
  if (mi) {
    if (!m || !m.itens) { mi.innerHTML = ''; mi.dataset.vazio = '1'; }
    else {
      delete mi.dataset.vazio;
      mi.className = `j-missao${m.vencedor ? ' feita' : ''}`;
      mi.innerHTML = `<span class="rot">Missão</span><span class="nome">${esc(m.nome)}</span><span class="itens">${m.itens.map((id) => { const it = E.ITENS.find((x) => x.id === id);
        return `<span class="it${st?.kit.includes(id) ? ' tem' : ''}" style="--t:var(--c-${it.loja})" title="${esc(it.nome)}" role="img" aria-label="${esc(it.nome)}: ${st?.kit.includes(id) ? 'no kit' : 'falta'}">${ITEM_IC[id]}</span>`; }).join('')}</span><span class="pts">${m.vencedor ? `${esc(m.vencedor)} ✓` : `+${m.pts} pts`}</span>`;
    }
  }
  if ($('#jAmigos') && !$('#jAmigos').hidden) atualizarAmigos();
}

// ----- Kit no rodapé -----
function atualizarKit(st) {
  const novo = S.kitAnt ? st.kit.find((id) => !S.kitAnt.includes(id)) : null;
  $('#jKit').innerHTML = `<div class="kit-rot"><span>Kit</span><b>${st.kit.length}/7</b></div><div class="j-slots">${E.ITENS.map((i) =>
    `<div class="j-slot${st.kit.includes(i.id) ? ' tem' : ''}${novo === i.id ? ' novo' : ''}" style="--t:var(--c-${i.loja})" title="${esc(i.nome)}" role="img" aria-label="${esc(i.nome)}: ${st.kit.includes(i.id) ? 'no kit' : 'falta'}">${ITEM_IC[i.id]}</div>`).join('')}</div>`;
  S.kitAnt = [...st.kit];
}

// ----- Ícones de jogada -----
function acoesHtml(st) {
  const s = S.sala, espera = S.modo === 'sala' && s?.tipo === 'espera', trava = S.aguardando ? 'disabled' : '';
  const reabrir = (k, rot, nome) => `<button class="j-acao um" id="reabrir" type="button" aria-label="${esc(nome)}">${ic(k)}<span class="j-valor mais">${rot}</span></button>`;
  if (st.fim) return `<button class="j-acao um" id="verRes" type="button" aria-label="Ver o resultado">${ic('estrela')}<span class="j-valor mais">Resultado</span></button>`;
  if (st.pend) {
    const t = st.pend.tipo;
    if (t === 'loja') return reabrir(st.pend.loja, 'Abrir', `Abrir ${E.CASAS[st.pend.loja].nome}`);
    if (t === 'carta') return reabrir(E.cartaPorId(st.pend.carta).tipo, 'Abrir', 'Abrir a carta');
    return reabrir(t === 'dado' ? 'dado' : t, 'Decidir', 'Decidir agora');
  }
  if (painelJanela().exclusivo) return `<button class="j-acao um" type="button" disabled aria-label="Votação aberta">${ic('dado')}<span class="j-valor">Votando</span></button>`;
  const op = E.opcoesDaRodada(st);
  const esperando = espera && st.rolou;
  if (st.skip && !esperando) return `<button class="j-acao um destaque" id="rolar" type="button" ${trava} aria-label="Passar a vez: você está parado nesta rodada">${ic('dado')}<span class="j-valor mais">Passar</span></button>`;
  return `<button class="j-acao um${S.primeiraVez ? ' destaque' : ''}" id="rolar" type="button" ${trava || (esperando ? 'disabled' : '')} aria-label="Rolar um dado. Grátis">${ic('d1')}<span class="j-valor mais">Grátis</span></button>
    <button class="j-acao" id="duplo" type="button" ${op.duplo && !S.aguardando ? '' : 'disabled'} aria-label="Dado duplo. ${st.duploGratis > 0 ? 'Grátis, graças à Bússola' : `Custa ${E.DADO_DUPLO_CUSTO} BC`}">${ic('d2')}<span class="j-valor${st.duploGratis > 0 ? ' mais' : ''}">${st.duploGratis > 0 ? 'Grátis' : `${E.DADO_DUPLO_CUSTO} BC`}</span></button>
    <button class="j-acao ajuda" id="ajudar" type="button" ${op.ajudar && !S.aguardando ? '' : 'disabled'} aria-label="Ajudar no acampamento. Não anda e ganha ${E.AJUDA_GANHO} BC">${ic('ajuda')}<span class="j-valor mais">+${E.AJUDA_GANHO} BC</span></button>`;
}
function atualizarAcoes(st) { $('#jBtns').innerHTML = acoesHtml(st); }

// O aviso do centro do tabuleiro: parado, esperando os outros, ou o resultado da última jogada.
function atualizarNota(st) {
  const espera = S.modo === 'sala' && S.sala?.tipo === 'espera';
  if (st.skip && !st.rolou && !st.fim) { mostrarNota('Você está parado: esta rodada só passa.', true); S.ultimoNota = null; return; }
  if (espera && st.rolou && !st.pend && !st.fim) {
    const prontos = S.placar.filter((p) => p.feito || p.fim).length;
    mostrarNota(`Aguardando os outros jogadores (${prontos} de ${S.placar.length} prontos)`, true); S.ultimoNota = null; return;
  }
  if (st.ultimo && st.ultimo !== S.ultimoNota) { S.ultimoNota = st.ultimo; mostrarNota(st.ultimo); }
  else if (!st.ultimo || (S.ultimoNota == null)) mostrarNota('');
}

// ----- Decisões que pedem uma janela: dado duplo, troca, pedágio e perdido (loja e carta têm as suas) -----
const DECISOES = ['dado', 'troca', 'pedagio', 'perdido'];
function decisaoHtml(st) {
  const trava = S.aguardando ? 'disabled' : '';
  const k = st.pend.tipo === 'dado' ? 'partida' : st.pend.tipo;   // troca, pedágio e perdido são o nome da casa
  let corpo = '', titulo = '';
  if (st.pend.tipo === 'dado') {
    const [a, b] = st.pend.dados;
    titulo = 'Dado duplo';
    corpo = `<p>Com qual dado você quer andar?</p><div class="duplo">${[a, b].map((v, i) => opcaoDado(st, v, i, trava)).join('')}</div>`;
  } else if (st.pend.tipo === 'troca') {
    titulo = E.CASAS.troca.nome;
    const faltam = E.ITENS.filter((i) => !st.kit.includes(i.id));
    const dar = st.kit.includes(S.troca.dar) ? S.troca.dar : st.kit[0], querer = faltam.some((i) => i.id === S.troca.querer) ? S.troca.querer : faltam[0]?.id;
    S.troca = { dar, querer };
    const nome = (id) => E.ITENS.find((i) => i.id === id)?.nome;
    const bau = dar && querer && E.ITENS.find((i) => i.id === querer).preco <= E.ITENS.find((i) => i.id === dar).preco;
    const sala = S.modo === 'sala';
    corpo = `<p>Troque um item do seu kit por outro. <b>Nenhum BC muda de conta.</b></p>
      ${faltam.length ? `<div class="troca-sel"><label class="f">Eu dou<select id="trocaDar">${st.kit.map((id) => `<option value="${id}" ${id === dar ? 'selected' : ''}>${nome(id)}</option>`).join('')}</select></label>
      <label class="f">Eu quero<select id="trocaQuero">${faltam.map((i) => `<option value="${i.id}" ${i.id === querer ? 'selected' : ''}>${i.nome}</option>`).join('')}</select></label></div>` : '<div class="okmsg">Você já tem todos os itens do kit!</div>'}
      <div class="row"><button class="btn primary" id="trocarBau" ${bau && !S.aguardando ? '' : 'disabled'}>Trocar no baú</button>${sala ? `<button class="btn" id="oferecer" ${faltam.length && !S.aguardando ? '' : 'disabled'}>Oferecer à sala</button>` : ''}<button class="btn" id="sairTroca" ${trava}>Sair sem trocar</button></div>
      <p class="note">Baú: na hora, só por um item que custa o mesmo ou menos${faltam.length && !bau ? ' (este custa mais)' : ''}.${sala ? ' Oferta: quem aceitar primeiro troca com você.' : ''}</p>`;
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
    <div class="ptitulo">${ic(st.pend.tipo === 'dado' ? 'dado' : k)}<h3>${titulo}</h3></div>${corpo}</div>`;
}
function atualizarDecisao(st) {
  let ov = $('#jDecisao');
  if (!st.pend || !DECISOES.includes(st.pend.tipo) || st.fim) { ov?.remove(); return; }
  const novo = !ov;
  if (novo) {
    ov = document.createElement('div'); ov.id = 'jDecisao'; ov.className = 'j-modal'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    document.body.appendChild(ov);
  }
  ov.setAttribute('aria-label', st.pend.tipo === 'dado' ? 'Dado duplo' : E.CASAS[st.pend.tipo].nome);
  ov.innerHTML = `<div class="j-folha-decisao">${decisaoHtml(st)}</div>`;
  if (novo) ov.querySelector('button:not(:disabled)')?.focus();
}

// ----- Votação, leilão e ofertas de troca: uma janela que abre sozinha e pode ser fechada -----
function atualizarJanela(st) {
  let ov = $('#jJanela');
  const s = S.sala, html = st && !st.fim && s ? painelJanela().html + painelOfertas() : '';
  if (!html) { ov?.remove(); S.janelaFechada = null; return; }
  const corpo = `<div class="j-folha-decisao">${html}<div class="row" style="margin-top:10px"><button class="btn sm" id="jFecharJanela" type="button">Fechar</button></div></div>`;
  if (ov) { ov.innerHTML = corpo; return; }
  const assin = `${s.voto?.fimEm}|${s.leilao?.fimEm}|${(s.ofertas || []).map((o) => `${o.de}${o.dar}${o.querer}`).join(',')}`;
  if (assin === S.janelaFechada) return;                                              // o jogador já fechou esta
  if ($('#cartaPalco') || $('#lojaPalco') || $('#jDecisao') || $('#jFolha')) return;   // espera as outras janelas
  ov = document.createElement('div'); ov.id = 'jJanela'; ov.className = 'j-modal'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Votação, leilão ou ofertas da sala');
  ov.innerHTML = corpo; ov.dataset.assin = assin; document.body.appendChild(ov);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('#jFecharJanela')) { const ov = $('#jJanela'); S.janelaFechada = ov?.dataset.assin || null; ov?.remove(); }
});

// ----- Folhas: conta, meta, como jogar, ajustes, sala e sair -----
function jFechar() { const f = $('#jFolha'); if (!f) return; f.remove(); document.removeEventListener('keydown', jTecla); f.depois?.(); const st = eu(); if (st && S.tela === 'jogo') atualizarJanela(st); }
function jTecla(e) { if (e.key === 'Escape') jFechar(); }
function jAbrir(html, { tipo = '', fecha = true, depois } = {}) {
  $('#jFolha')?.remove();
  const f = document.createElement('div');
  f.id = 'jFolha'; f.className = 'j-modal'; f.dataset.tipo = tipo; f.dataset.fecha = fecha ? '1' : ''; f.depois = depois;
  f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
  f.innerHTML = html; document.body.appendChild(f);
  f.addEventListener('click', (e) => { if (e.target === f && f.dataset.fecha) jFechar(); });
  document.removeEventListener('keydown', jTecla); if (fecha) document.addEventListener('keydown', jTecla);
  (f.querySelector('[autofocus]') || f.querySelector('button'))?.focus();
  return f;
}

function abrirComoJogar(primeira = false) {
  const f = jAbrir(`<div class="j-folha" aria-label="Sua primeira jogada">
    <h2>${primeira ? 'Sua primeira jogada' : 'Como jogar a sua vez'}</h2>
    <p class="sub">Na sua vez, toque em um dos três ícones embaixo do tabuleiro:</p>
    <ul class="j-explica">
      <li><span class="chip um">${ic('d1')}</span><span><b>Rolar um dado <em>Grátis</em></b><span>Você anda de 1 a 6 casas e cumpre o que a casa pedir.</span></span></li>
      <li><span class="chip">${ic('d2')}</span><span><b>Dado duplo <em>${E.DADO_DUPLO_CUSTO} BC</em></b><span>Rola dois dados e você escolhe com qual andar. Dá para ver onde cada um leva.</span></span></li>
      <li><span class="chip ajuda">${ic('ajuda')}</span><span><b>Ajudar no acampamento <em>+${E.AJUDA_GANHO} BC</em></b><span>Você não anda e ganha ${E.AJUDA_GANHO} BC.</span></span></li>
    </ul>
    <div class="j-dica">${ic('util')}<span>O <b>kit do acampamento</b> fica embaixo. Cada item comprado nas lojas acende e vale 10 pontos.</span></div>
    <div class="j-dica">${ic('estrela')}<span>A <b>estrela piscando</b> é a sua meta secreta${S.placar.length > 1 ? ', e o grupo de fichas mostra os <b>amigos</b>' : ''}. Toque ${S.placar.length > 1 ? 'neles' : 'nela'} para ver.</span></div>
    <button class="btn primary" type="button" id="jEntendi" autofocus>Entendi, vamos jogar</button></div>`, { tipo: 'como', depois: () => { ls.set('mt-tutorial-visto', true); S.primeiraVez = false; atualizarAcoesSeguro(); } });
  f.querySelector('#jEntendi').addEventListener('click', jFechar);
}
function atualizarAcoesSeguro() { const st = eu(); if (st && $('#jBtns')) { atualizarAcoes(st); ligarPainel(); } }

function abrirMeta() {
  const st = eu(); if (!st) return;
  const m = E.METAS.find((x) => x.id === st.meta); if (!m) return;
  S.metaVista = metaChave(st); $('#bMeta')?.classList.remove('pisca');
  $('#metaPalco')?.remove();
  const ov = document.createElement('div');
  ov.id = 'metaPalco'; ov.className = 'cc-palco'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Sua meta secreta');
  ov.innerHTML = `<div class="cc-voo"><div class="cc-giro">
      <div class="cc-lado">${VERSO_DA_CARTA.replace('Bússola · Tempestade', 'Meta secreta')}</div>
      <div class="cc-lado cc-frente"><div class="cc" data-tipo="meta"><div class="cc-miolo">
        <div class="cc-cab"><span class="cc-nome">Sua meta secreta</span><span class="cc-pts"><small>+</small>${m.pts} <small>pts</small></span><span class="cc-selo">${ic('estrela')}</span></div>
        <div class="cc-arte" aria-hidden="true"><span class="cc-estrela">${ic('estrela')}</span></div>
        <span class="cc-faixa">Cumpra até o fim da partida</span>
        <div class="cc-texto"><p><b>${esc(m.nome)}</b></p><p>Cumprindo, você ganha +${m.pts} pts no fim da partida.</p></div>
        <div class="cc-rodape"><span>Só você vê<b>Os outros descobrem no fim</b></span><span>Vale<b>+${m.pts} pts</b></span></div>
      </div></div></div></div></div>
    <div class="cc-respostas"><div class="cc-fim"><button class="btn primary" type="button" id="jGuardar" autofocus>Guardar segredo</button></div></div>`;
  document.body.appendChild(ov);
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', tecla);
  ov.querySelector('#jGuardar').addEventListener('click', fechar);
  som('virar');
  const voo = ov.querySelector('.cc-voo');
  setTimeout(() => { if (ov.isConnected) { voo.classList.add('virada'); ov.classList.add('pronta'); ov.querySelector('#jGuardar').focus(); } }, reduzir ? 0 : 900);
}

function abrirContaJogo() {
  const st = eu(); if (!st) return;
  const avisos = st.avisos.slice().reverse().slice(0, 8), pts = E.pontuacao(st).total;
  jAbrir(`<div class="j-folha" aria-label="Sua conta"><h2>Sua conta</h2>
    <div class="j-conta-resumo"><span class="jp-val">${ic('moeda')}<b>${st.saldo}</b><small>BC</small></span><span class="jp-val"><b>${pts}</b><small>pts</small></span></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Avisos da conta</div><div class="avisos">${avisos.map((a) => `<div class="aviso ${a.tipo}">${esc(a.texto)}</div>`).join('')}</div></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Extrato · últimas 10</div><table class="extrato">${st.extrato.slice().reverse().map((x) => `<tr><td>${esc(x.d)}</td><td class="v">${x.v > 0 ? '+' : ''}${x.v} BC</td><td class="v muted">${x.s} BC</td></tr>`).join('')}</table></div>
    <button class="btn primary" type="button" id="jPronto" autofocus>Fechar</button></div>`, { tipo: 'conta' });
  $('#jPronto').addEventListener('click', jFechar);
}
function abrirAjustes() {
  jAbrir(`<div class="j-folha" aria-label="Ajustes"><h2>Ajustes</h2><p class="sub">Efeitos sonoros e música de fundo.</p>
    <div class="row">${botaoSom()}${botaoMusica()}</div><button class="btn primary" type="button" id="jPronto" autofocus>Pronto</button></div>`, { tipo: 'ajustes' });
  $('#jPronto').addEventListener('click', jFechar);
}
function salaFolhaHtml() {
  const s = S.sala; if (!s) return '';
  return `<div class="j-folha" aria-label="Sala"><h2>${s.tipo === 'espera' ? 'Sala de espera' : `Sala ${esc(s.codigo)}`}</h2>
    <p class="sub">${s.jogando ?? S.placar.length} jogando${s.max ? `, ${s.total ?? S.placar.length} de ${s.max} na sala` : ''}.</p>
    ${anfitriao()}${S.sala.patrulhas ? patrulhasHtml() : ''}
    <button class="btn primary" type="button" id="jPronto">Fechar</button></div>`;
}
function abrirSala() {
  if (S.modo !== 'sala') return;
  jAbrir(salaFolhaHtml(), { tipo: 'sala' });
  $('#jPronto').addEventListener('click', jFechar); ligarAnfitriao();
}
function abrirSair() {
  const sala = S.modo === 'sala';
  jAbrir(`<div class="j-folha" role="alertdialog" aria-label="Sair do jogo"><h2>Sair do jogo?</h2>
    <p class="sub">${sala ? 'Você sai da sala. Enquanto ela estiver aberta, dá para voltar com o código.' : 'Você volta para a tela inicial. A sua partida fica salva neste aparelho, e dá para continuar depois.'}</p>
    <div class="duplo"><button class="btn" type="button" id="jSairSim">Sair</button><button class="btn primary" type="button" id="jSairNao" autofocus>Continuar jogando</button></div></div>`, { tipo: 'sair' });
  $('#jSairNao').addEventListener('click', jFechar);
  $('#jSairSim').addEventListener('click', () => { jFechar(); sairDoJogo(); });
}

// ----- Tamanho do tabuleiro: o maior quadrado que cabe no miolo da tela -----
function ajustarJogo() {
  const palco = $('#jPalco'), tab = $('#board'), acoes = $('#jAcoes'); if (!palco || !tab || !acoes) return;
  const r = palco.getBoundingClientRect();
  const paisagem = r.width >= r.height * 1.15;
  palco.classList.toggle('paisagem', paisagem);
  palco.classList.toggle('curta', paisagem && r.height < 340);   // celular deitado: os ícones de jogada passam para duas colunas
  const a = acoes.getBoundingClientRect(), gap = paisagem ? 16 : 10;
  const lado = Math.floor(Math.max(120, paisagem ? Math.min(r.width - a.width - gap, r.height) : Math.min(r.width + 16, r.height - a.height - gap)));
  tab.style.setProperty('--lado', `${lado}px`);
  tab.classList.toggle('com-rotulos', lado >= 600);
  palco.style.setProperty('--larg', `${lado}px`);
  // O que sobra de espaço vira informação, por prioridade: acontecimentos, reações e missão. Em tela curta nada aparece.
  const temMissao = !$('#jMissao')?.dataset.vazio, temReacoes = !!$('#reacoes');
  let ver = { A: false, R: false, M: false }, lat = 0;
  if (!paisagem) {
    let livre = r.height - lado - a.height - gap;
    if (livre >= 78) { ver.A = true; livre -= 64; }
    if (ver.A && temReacoes && livre >= 66) { ver.R = true; livre -= 50; }
    if (ver.A && temMissao && livre >= 58) ver.M = true;
  } else {
    const sobra = r.width - a.width - 2 * gap - lado;
    if (sobra >= 240) { ver = { A: true, R: temReacoes, M: temMissao }; lat = Math.min(320, Math.floor(sobra)); }
  }
  palco.style.setProperty('--lat', `${lat}px`);
  palco.classList.toggle('ver-acontece', ver.A); palco.classList.toggle('ver-reacoes', ver.R); palco.classList.toggle('ver-missao', ver.M); palco.classList.toggle('ver-baixo', ver.R || ver.M);
}

function montarJogo() {
  const sala = S.modo === 'sala';
  return `<div class="j-tela" id="jTela">
    <header class="j-topo" id="jTopo">
      <div class="j-jogador" id="jJogador"></div>
      <div class="j-icones">
        <button class="j-icbtn j-meta" id="bMeta" type="button" aria-label="Meta secreta: toque para ver">${ic('estrela')}</button>
        <button class="j-amigos" id="bAmigos" type="button" aria-expanded="false" aria-controls="jAmigos" aria-label="Amigos" hidden><span class="j-pilha" id="jPilha"></span>${ic('seta')}</button>
      </div>
      <section class="j-painel-amigos" id="jAmigos" hidden aria-label="Amigos"></section>
      <div class="timer" id="timer" hidden><i></i></div>
      <div class="j-pend" id="pend"></div>
    </header>
    <main class="j-palco" id="jPalco">
      <div class="j-lateral">
        <section class="j-acontece" id="jAcontece" aria-label="Acontecimentos"></section>
        <div class="j-baixo"><div class="j-missao" id="jMissao" data-vazio="1"></div>${sala ? reacoesHtml() : ''}</div>
      </div>
      ${montarTabuleiro()}
      <div class="j-acoes" id="jAcoes"><div class="j-btns" id="jBtns"></div>
        <div class="j-minis">
          <button class="j-mini" id="bComo" type="button" aria-label="Como jogar a sua vez">?</button>
          <button class="j-mini" id="bAjustes" type="button" aria-label="Ajustes de som e música">${ic('ajustes')}</button>
          ${sala ? `<button class="j-mini" id="bSala" type="button" aria-label="Sala e anfitrião">${ic('sala')}</button>` : ''}
          <button class="j-mini sai" id="bSair" type="button" aria-label="Sair do jogo">${ic('sair')}</button>
        </div>
      </div>
    </main>
    <footer class="j-kit" id="jKit"></footer>
  </div>`;
}

function atualizarPainel() {
  const st = eu(); if (!st || !$('#jBtns')) return;
  atualizarAcoes(st); atualizarDecisao(st); atualizarJanela(st);
  ligarPainel(); tique();
  atualizarLojaGrande();   // a barraca aberta acompanha o carrinho, os avisos e os erros
}

// Redesenha só o que mudou; o tabuleiro e os peões continuam na tela.
function atualizarJogo() {
  const st = eu();
  if (S.tela !== 'jogo' || !st) return;
  const nova = !$('#board');
  if (nova) { app.innerHTML = montarJogo(); S.peaoPos = {}; ligarFixos(); }
  atualizarTopo(st); atualizarKit(st); atualizarFaixas();
  atualizarPainel();
  atualizarCasas(st); atualizarNota(st); atualizarPontes();
  if (nova || !S.cenaEmCurso) sincronizarPeoes(S.placar);
  if ($('#jFolha')?.dataset.tipo === 'sala') { $('#jFolha').innerHTML = salaFolhaHtml(); $('#jPronto')?.addEventListener('click', jFechar); ligarAnfitriao(); }
  ajustarJogo();
  if (nova && !ls.get('mt-tutorial-visto', false) && !st.pend && !st.rolou && st.rodada === 0) { S.primeiraVez = true; atualizarAcoesSeguro(); setTimeout(() => { if (S.tela === 'jogo' && !$('#jFolha')) abrirComoJogar(true); }, 500); }
  tique();
}

function telaJogo() {
  if (!eu()) return `${topo('<span class="sp"></span><button class="btn sm" id="sair">Sair</button>')}<div class="wrap jogo"><p class="muted">Carregando a sala…</p></div>`;
  return null;
}

// Ligações que valem para o jogo todo: feitas uma vez, quando o tabuleiro nasce.
let GLOBAIS = false;
function ligarFixos() {
  document.querySelectorAll('[data-reacao]').forEach((b) => b.addEventListener('click', () => {
    if (Date.now() < S.reacaoLivreEm) return;
    S.reacaoLivreEm = Date.now() + E.REACAO_INTERVALO_MS;
    enviar({ t: 'reagir', i: Number(b.dataset.reacao) });
    const todos = document.querySelectorAll('[data-reacao]');
    todos.forEach((x) => { x.disabled = true; });
    setTimeout(() => todos.forEach((x) => { x.disabled = false; }), E.REACAO_INTERVALO_MS);
  }));
  if (!GLOBAIS) {
  GLOBAIS = true;
  const abrirFichaDoPlacar = (e) => {
    const plEl = e.target.closest('[data-ordem-placar]');
    if (!plEl || (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) return;
    if (e.type === 'keydown') e.preventDefault();
    const o = Number(plEl.dataset.ordemPlacar);
    mostrarDetalhesFicha(S.placar.find((x) => x.ordem === o));
  };
  app.addEventListener('click', abrirFichaDoPlacar);
  app.addEventListener('keydown', abrirFichaDoPlacar);
  // composedPath guarda por onde o clique passou, mesmo que o painel se redesenhe no meio do caminho (como ao trocar de aba).
  document.addEventListener('click', (e) => { const p = $('#jAmigos'); if (p && !p.hidden && !e.composedPath().includes(p)) alternarAmigos(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternarAmigos(false); });
  }
  $('#bAmigos').addEventListener('click', (e) => { e.stopPropagation(); alternarAmigos(); });
  $('#jAmigos').addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (b) { S.aba = b.dataset.aba; atualizarAmigos(); } });
  $('#bMeta').addEventListener('click', abrirMeta);
  $('#jJogador').addEventListener('click', (e) => { if (e.target.closest('#bConta')) abrirContaJogo(); });
  $('#bComo').addEventListener('click', () => abrirComoJogar(false));
  $('#bAjustes').addEventListener('click', abrirAjustes);
  $('#bSala')?.addEventListener('click', abrirSala);
  $('#bSair').addEventListener('click', abrirSair);
  if (window.ResizeObserver) { new ResizeObserver(() => layoutPeoes()).observe($('#board')); new ResizeObserver(ajustarJogo).observe($('#jPalco')); }
  // Com folga e sem economia de dados, já baixa os outros cenários para a troca não esperar a rede.
  if (!navigator.connection?.saveData) setTimeout(() => document.querySelectorAll('.cenario img').forEach(carregarCenario), 8000);
}

function ligarPainel() {
  $('#rolar')?.addEventListener('click', () => { S.primeiraVez = false; acao('rolar'); });
  $('#duplo')?.addEventListener('click', () => { S.primeiraVez = false; acao('dado_duplo'); });
  $('#ajudar')?.addEventListener('click', () => { S.primeiraVez = false; acao('ajudar'); });
  $('#reabrir')?.addEventListener('click', () => {
    const st = eu(); if (!st?.pend) return;
    if (st.pend.tipo === 'loja') abrirLojaGrande(st.pend.loja, false);
    else if (st.pend.tipo === 'carta') abrirCartaGrande(st, st.pend.carta);
    else atualizarPainel();
  });
  document.querySelectorAll('[data-esc]').forEach((b) => b.addEventListener('click', () => acao('escolher_dado', { i: Number(b.dataset.esc) })));
  $('#verRes')?.addEventListener('click', () => { S.verTab = false; ir('resultado'); });
  $('#pagar')?.addEventListener('click', () => acao('pagar'));
  $('#arriscar')?.addEventListener('click', () => acao('arriscar'));
  $('#trocaDar')?.addEventListener('change', (e) => { S.troca.dar = e.target.value; atualizarPainel(); });
  $('#trocaQuero')?.addEventListener('change', (e) => { S.troca.querer = e.target.value; atualizarPainel(); });
  $('#trocarBau')?.addEventListener('click', () => acao('trocar_bau', { dar: S.troca.dar, querer: S.troca.querer }));
  $('#oferecer')?.addEventListener('click', () => acao('oferecer_troca', { dar: S.troca.dar, querer: S.troca.querer }));
  $('#sairTroca')?.addEventListener('click', () => acao('sair_troca'));
  document.querySelectorAll('[data-aceitar]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'aceitar_troca', de: Number(b.dataset.aceitar) })));
  document.querySelectorAll('[data-voto]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'votar_evento', i: Number(b.dataset.voto) })));
  document.querySelectorAll('[data-lance]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'dar_lance', valor: Number(b.dataset.lance) })));
}

function ligarAnfitriao() {
  document.querySelectorAll('[data-mestre]').forEach((b) => b.addEventListener('click', () => enviar({ t: 'mestre', tipo: b.dataset.mestre })));
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
  if (!st) {
    S.tela = (S.registrado || S.perfil.apelido.trim()) ? 'modos' : 'entrada';
    return S.tela === 'modos' ? telaModos() : telaEntrada();
  }
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
  return `${topo(`<span class="sp"></span>${botaoSom()}${botaoMusica()}<button class="btn sm" id="inicio">Voltar ao início</button>`)}
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
  const voltar = () => { if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); } S.modo = null; S.peaoPos = {}; S.eu = null; S.resultado = null; S.confetou = false; irMenu(); };
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
  if (S.tela !== 'jogo') for (const id of ['cartaPalco', 'lojaPalco', 'metaPalco', 'jFolha', 'jDecisao', 'jJanela']) $(`#${id}`)?.remove();   // carta, barraca e janelas só existem na tela do jogo
  document.documentElement.classList.toggle('em-jogo', S.tela === 'jogo' && !!eu());   // no jogo a página não rola
  if (S.tela === 'entrada') { app.innerHTML = telaEntrada(); ligarEntrada(); }
  else if (S.tela === 'modos') { app.innerHTML = telaModos(); ligarModos(); }
  else if (S.tela === 'fila') { app.innerHTML = telaFila(); ligarFila(); }
  else if (S.tela === 'trilha') { app.innerHTML = telaTrilha(); ligarTrilha(); }
  else if (S.tela === 'recordes') { app.innerHTML = telaRecordes(); ligarRecordes(); }
  else if (S.tela === 'conta') { app.innerHTML = telaConta(); ligarConta(); }
  else if (S.tela === 'perfis') { app.innerHTML = telaPerfis(); ligarPerfis(); }
  else if (S.tela === 'perfilEditor') { app.innerHTML = telaPerfilEditor(); ligarPerfilEditor(); }
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
  // Votação, leilão e ofertas esperavam outra janela fechar: abrem assim que o caminho estiver livre.
  if (S.tela === 'jogo' && S.sala && (S.sala.voto || S.sala.leilao || S.sala.ofertas?.length) && !$('#jJanela')) atualizarJanela(eu());
  document.querySelectorAll('[data-fim]').forEach((el) => {
    el.textContent = `${Math.max(0, Math.ceil((Number(el.dataset.fim) - agora) / 1000))} s`;
  });
}
setInterval(tique, 250);
setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);

render();
iniciar();
