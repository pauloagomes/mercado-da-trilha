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
];

const S = {
  tela: 'entrada',
  perfil: ls.get('mt-perfil', { apelido: '', ficha: 'f01' }),
  rodadas: ls.get('mt-rodadas', E.RODADAS_PADRAO),
  online: false, registrado: false,
  modo: null,            // 'solo' | 'sala'
  solo: null,            // estado do jogo solo
  sala: null, eu: null, placar: [], mural: [], fila: null,
  erro: '', carrinho: {}, offset: 0, confirmarEncerrar: false,
  rolando: false, dadoAnterior: null,
};

// ---------- Utilidades de tela ----------
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
}
function ir(tela) { S.tela = tela; S.erro = ''; if (tela !== 'jogo') S.verTab = false; render(); window.scrollTo({ top: 0 }); }
const eu = () => (S.modo === 'solo' ? S.solo : S.eu);

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
    if (sala && S.registrado) { S.modo = 'sala'; S.tela = 'jogo'; await conectar(); enviar({ t: 'entrar', codigo: sala }); }
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
    const antes = S.eu;
    S.sala = m.sala; S.eu = m.eu; S.placar = m.placar; S.mural = m.mural;
    S.offset = m.sala.agora - Date.now();
    if (m.eu && antes && !antes.rolou && m.eu.rolou) animarDado();
    if (m.eu && antes && antes.pend?.tipo === 'loja' && !m.eu.pend) S.carrinho = {};
    if (S.modo === 'sala' && (m.sala.status === 'encerrada' || m.eu?.fim) && S.tela === 'jogo' && !S.verTab) { S.tela = 'resultado'; }
    if (S.tela === 'entrada' || S.tela === 'fila') S.tela = 'jogo';
    S.erro = '';
    render();
  } else if (m.t === 'partida') {
    S.modo = 'sala'; ls.set('mt-sala', m.codigo); S.fila = null;
    if (S.tela !== 'resultado') S.tela = 'jogo';
  } else if (m.t === 'fila') {
    S.fila = m; S.offset = m.agora - Date.now();
    if (S.tela === 'fila') render();
  } else if (m.t === 'fila_saiu') {
    toast(m.msg); S.fila = null; ir('entrada');
  } else if (m.t === 'erro') {
    if (S.tela === 'jogo' && eu()?.pend?.tipo === 'loja') { S.erro = m.msg; render(); } else toast(m.msg);
    if (/não encontrada|encerrada|já começou/.test(m.msg) && S.tela !== 'resultado') { ls.del('mt-sala'); S.modo = null; ir('entrada'); }
  } else if (m.t === 'fogo') {
    if (m.meu) chamas(); else toast(`${m.apelido} chegou ao Fogo de Conselho!`);
  }
}

// ---------- Ações ----------
function acao(t, extra = {}) {
  if (S.modo === 'sala') { enviar({ t, ...extra }); return; }
  const st = S.solo;
  const fogo = st.fogo;
  const fn = { rolar: () => E.rolar(st), comprar: () => E.comprar(st, extra.itens), sair_loja: () => E.sairDaLoja(st),
    responder: () => E.responder(st, extra.i), pagar: () => E.pagar(st), ficar: () => E.ficarParado(st) }[t];
  const r = fn();
  st.saida = [];
  if (r.erro) { if (st.pend?.tipo === 'loja') S.erro = r.erro; else toast(r.erro); render(); return; }
  S.erro = '';
  if (t === 'rolar') animarDado();
  if (st.fogo > fogo) chamas();
  if (st.feito) E.fecharRodada(st);
  if (!st.pend) S.carrinho = {};
  ls.set('mt-solo', st);
  if (st.fim) {
    const pts = E.pontuacao(st).total, rec = ls.get('mt-recorde', null);
    S.novoRecorde = !rec || pts > rec.pontos;
    if (S.novoRecorde) ls.set('mt-recorde', { pontos: pts, em: Date.now() });
    ls.del('mt-solo');
    setTimeout(() => ir('resultado'), 900);
  }
  render();
}

function animarDado() {
  if (reduzir) return;
  S.rolando = true; render();
  setTimeout(() => { S.rolando = false; render(); }, 550);
}

async function jogarSozinho(continuar) {
  try { await registrarLocal(); } catch (e) { toast(e.message); return; }
  S.modo = 'solo';
  S.solo = continuar ? ls.get('mt-solo', null) : null;
  if (!S.solo) S.solo = E.novoJogador({ apelido: S.perfil.apelido.trim(), ficha: S.perfil.ficha, rodadas: S.rodadas, seed: Math.floor(Math.random() * 2 ** 31) });
  ls.set('mt-solo', S.solo);
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
  S.modo = 'sala'; ls.set('mt-sala', codigo);
  enviar({ t: 'entrar', codigo });
}
async function criarSala() {
  try {
    await preparoOnline();
    const { codigo } = await api('/api/salas', { rodadas: S.rodadas });
    S.modo = 'sala'; ls.set('mt-sala', codigo);
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
  S.modo = null; S.sala = null; S.eu = null; S.placar = []; S.mural = [];
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
    ['pedagio', 'Valor sorteado de 2 a 12 BC.'], ['bussola', 'Carta de sorte com uma pergunta.'],
    ['tempestade', 'Carta de revés com uma pergunta.'], ['perdido', 'Pague 10 BC ou perca a próxima rodada.'],
    ['fogo', 'Mais 20 BC e uma fogueira na tela.'],
  ];
  return `
  <section class="hero"><div class="wrap">
    <div class="eyebrow" style="color:var(--sun)">Jogo de treino da conta digital</div>
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
      <p class="note" style="margin-top:10px">Pontos: 10 por item do kit, +20 pelo kit completo, +5 por carta acertada e 1 pt a cada 10 BC que sobrarem. Desempate: saldo final, depois cartas acertadas.</p>
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
  return `${topo('<span class="chip">Sala de espera</span><span class="sp"></span><button class="btn sm" id="sairFila">Sair da fila</button>')}
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
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function tabuleiro(st) {
  const peoes = S.modo === 'sala' ? S.placar : [{ ...E.resumoPublico(st), cor: '#D69712', eu: true }];
  const porCasa = {};
  for (const p of peoes) (porCasa[p.pos] ||= []).push(p);
  const cells = E.TABULEIRO.map((k, i) => {
    const [r, c] = posCasa(i);
    const lista = (porCasa[i] || []).sort((a, b) => (b.eu ? 1 : 0) - (a.eu ? 1 : 0));
    const vis = lista.slice(0, 4), resto = lista.length - vis.length;
    const cls = ['cell', E.CASAS[k].loja && E.lojaFechada(st, k) ? 'fechada' : '', E.CASAS[k].loja && E.descontoFeira(st, k) ? 'feira' : '', st.pos === i ? 'aqui' : ''].join(' ');
    return `<div class="${cls}" style="grid-row:${r};grid-column:${c};--t:var(--c-${k})" title="${E.CASAS[k].nome}">${ic(k)}<span class="lbl">${E.CASAS[k].nome}</span>
      <span class="peoes">${vis.map((p) => `<span class="peao${p.eu ? ' eu' : ''}" style="--pc:${p.cor}" title="${esc(p.apelido)}"><img src="${fichaSrc(p.ficha)}" alt=""></span>`).join('')}${resto > 0 ? `<span class="mais">+${resto}</span>` : ''}</span></div>`;
  }).join('');
  const v = S.rolando ? 1 + Math.floor(Math.random() * 6) : (st.dado || 5);
  return `<div class="board" aria-label="Tabuleiro">${cells}
    <div class="centro"><div class="nome">Mercado<br>da <span>Trilha</span></div>
      <div class="dado${S.rolando ? ' rolando' : ''}" aria-label="Dado: ${st.dado || 'ainda não rolado'}">${[...Array(9)].map((_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</div>
      <p class="note">${esc(st.ultimo || 'Role o dado para começar.')}</p></div></div>`;
}

function blocoUltimo(st) {
  if (!st.resposta) return st.ultimo ? `<p>${esc(st.ultimo)}</p>` : '';
  const c = E.CARTAS.find((x) => x.id === st.resposta.carta);
  return `<div class="${st.resposta.ok ? 'okmsg' : 'erro'}"><b>${st.resposta.ok ? 'Acertou! +5 pts.' : 'Não foi dessa vez.'}</b> ${esc(c.porque)}</div>
    ${c.app ? `<p class="app-linha">${esc(c.app)} ${linkHub('carta', 'Conheça')}</p>` : ''}`;
}

function painel(st) {
  const espera = S.modo === 'sala' && S.sala?.tipo === 'espera';
  if (st.fim) {
    return `<div class="painel" style="--t:var(--sun)"><div class="tag">Fim do mercado</div><h3>Você completou as ${st.rodadas} rodadas</h3><p>${E.pontuacao(st).total} pts.</p><button class="btn primary" id="verRes">Ver resultado</button></div>`;
  }
  if (st.pend) {
    const k = st.pend.tipo === 'loja' ? st.pend.loja : st.pend.tipo === 'carta' ? E.CARTAS.find((c) => c.id === st.pend.carta).tipo : st.pend.tipo;
    let corpo = '';
    if (st.pend.tipo === 'loja') {
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
        <div class="row"><button class="btn primary" id="pagarLoja" ${sel.length ? '' : 'disabled'}>Pagar ${bc(total)}</button><button class="btn" id="sairLoja">Sair sem comprar</button></div>`;
    } else if (st.pend.tipo === 'carta') {
      const c = E.CARTAS.find((x) => x.id === st.pend.carta);
      corpo = `<div class="carta" style="--t:var(--c-${c.tipo})"><span class="tag">Carta ${E.CASAS[c.tipo].nome}</span><strong>${esc(c.titulo)}</strong><span>${esc(c.historia)}</span></div>
        <p><b>${esc(c.pergunta)}</b></p>
        <div class="opcoes">${c.opcoes.map((o, i) => `<button class="opcao" data-resp="${i}">${esc(o)}</button>`).join('')}</div>`;
    } else if (st.pend.tipo === 'pedagio') {
      corpo = `<p>O pedágio hoje custa <b>${bc(st.pend.valor)}</b>.</p>${st.saldo < st.pend.valor ? `<div class="alerta">Seu saldo (${st.saldo} BC) não cobre: o pagamento será recusado e você perde a próxima rodada.</div>` : ''}
        <div class="row"><button class="btn primary" id="pagar">Pagar ${bc(st.pend.valor)}</button></div>`;
    } else if (st.pend.tipo === 'perdido') {
      corpo = `<p>Você se perdeu. Pague <b>${bc(st.pend.valor)}</b> para seguir, ou fique parado e perca a próxima rodada.</p>
        <div class="row"><button class="btn primary" id="pagar" ${st.saldo < st.pend.valor ? 'disabled' : ''}>Pagar ${bc(st.pend.valor)}</button><button class="btn" id="ficar">Ficar parado</button></div>`;
    }
    const casa = st.pend.tipo === 'loja' ? st.pend.loja : st.pend.tipo === 'carta' ? k : st.pend.tipo;
    return `<div class="painel" style="--t:var(--c-${k})"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas} · tirou ${st.dado}</div>
      <div class="ptitulo">${ic(casa)}<h3>${E.CASAS[TABULEIRO_ATUAL(st)].nome}</h3></div>${corpo}</div>`;
  }
  if (espera && st.rolou) {
    const prontos = S.placar.filter((p) => p.feito || p.fim).length;
    return `<div class="painel" style="--t:var(--sun)"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas}</div>${blocoUltimo(st)}
      <div class="espera-msg"><span class="pulso"></span><span>Aguardando os outros jogadores (${prontos} de ${S.placar.length} prontos).</span></div></div>`;
  }
  return `<div class="painel" style="--t:var(--sun)"><div class="tag">Rodada ${E.rodadaAtual(st)} de ${st.rodadas}${espera ? ' · aberta para todos' : ''}</div>
    <div class="rolarbox">${blocoUltimo(st)}<button class="btn big primary" id="rolar">${ic('dado')} Rolar o dado</button>
    ${st.skip ? '<p class="note">Você está parado: esta rolagem conta como rodada perdida.</p>' : ''}</div></div>`;
}
const TABULEIRO_ATUAL = (st) => E.TABULEIRO[st.pos];

function conta(st, cor) {
  const avisos = st.avisos.slice().reverse().slice(0, 8);
  return `<div class="conta"><header style="--pc:${cor}"><img src="${fichaSrc(st.ficha)}" alt="${esc(fichaNome(st.ficha))}"><span class="nm">${esc(st.apelido)}<span class="sub">Conta BadenCoin · inspirada no Trilha HUB</span></span><span class="bc muted">${E.pontuacao(st).total} pts</span></header>
    <div class="saldo">${ic('moeda')}<b>${st.saldo}</b><span>BC</span></div>
    <div class="cbody">
      <div><div class="eyebrow" style="margin-bottom:6px">Kit de Acampamento · ${st.kit.length}/7</div><div class="kitrow">${E.ITENS.map((i) => `<span class="kit${st.kit.includes(i.id) ? ' on' : ''}" style="--t:var(--c-${i.loja})">${i.nome}</span>`).join('')}</div></div>
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

function telaJogo() {
  const st = eu();
  if (!st) return `${topo('<span class="sp"></span><button class="btn sm" id="sair">Sair</button>')}<div class="wrap jogo"><p class="muted">Carregando a sala…</p></div>`;
  const s = S.sala, espera = S.modo === 'sala' && s?.tipo === 'espera';
  const modoChip = S.modo === 'solo' ? '<span class="chip">Sozinho</span>' : espera ? '<span class="chip">Sala de espera</span>' : `<span class="chip">Sala <b>${esc(s?.codigo)}</b></span>`;
  const cor = S.modo === 'sala' ? (S.eu?.cor || '#D69712') : '#D69712';
  return `${topo(`${modoChip}<span class="chip">Rodada <b>${E.rodadaAtual(st)}/${st.rodadas}</b></span><span class="sp"></span><button class="btn sm" id="sair">${S.modo === 'solo' ? 'Pausar' : 'Sair'}</button>${espera && s.status === 'em_jogo' ? '<div class="timer" id="timer"><i></i></div>' : ''}`)}
  <div class="wrap jogo">
    <div class="j-main">${tabuleiro(st)}<div class="side">${painel(st)}${conta(st, cor)}</div></div>
    ${S.modo === 'sala' ? `<div class="dois"><div class="stack"><div class="eyebrow">Placar da sala</div>${placarHtml()}${anfitriao()}</div>
      <div class="stack"><div class="eyebrow">Mural</div><ul class="mural">${S.mural.slice().reverse().map((m) => `<li><span class="dot" style="--pc:${m.cor}"></span><span>${esc(m.texto)}</span></li>`).join('') || '<li>Nada ainda.</li>'}</ul></div></div>` : ''}
  </div>`;
}

function ligarJogo() {
  $('#sair')?.addEventListener('click', sairDoJogo);
  $('#rolar')?.addEventListener('click', () => acao('rolar'));
  $('#verRes')?.addEventListener('click', () => { S.verTab = false; ir('resultado'); });
  app.querySelectorAll('[data-item]').forEach((c) => c.addEventListener('change', () => { S.carrinho[c.dataset.item] = c.checked; S.erro = ''; render(); }));
  $('#pagarLoja')?.addEventListener('click', () => acao('comprar', { itens: Object.keys(S.carrinho).filter((k) => S.carrinho[k]) }));
  $('#sairLoja')?.addEventListener('click', () => acao('sair_loja'));
  app.querySelectorAll('[data-resp]').forEach((b) => b.addEventListener('click', () => acao('responder', { i: Number(b.dataset.resp) })));
  $('#pagar')?.addEventListener('click', () => acao('pagar'));
  $('#ficar')?.addEventListener('click', () => acao('ficar'));
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(S.sala.codigo); toast('Código copiado.'); } catch { toast(`Código: ${S.sala.codigo}`); }
  });
  $('#encerrar')?.addEventListener('click', () => {
    if (!S.confirmarEncerrar) { S.confirmarEncerrar = true; render(); return; }
    S.confirmarEncerrar = false; enviar({ t: 'encerrar' });
  });
  $('#cancelarEnc')?.addEventListener('click', () => { S.confirmarEncerrar = false; render(); });
}

function telaResultado() {
  const st = eu();
  if (!st) { S.tela = 'entrada'; return telaEntrada(); }
  const p = E.pontuacao(st), sala = S.modo === 'sala';
  const pos = sala ? S.placar.findIndex((x) => x.eu) + 1 : 0;
  const aindaJogando = sala ? S.placar.filter((x) => !x.fim).length : 0;
  return `${topo('<span class="sp"></span><button class="btn sm" id="inicio">Voltar ao início</button>')}
  <div class="wrap resultado">
    <div class="eyebrow">Fim do mercado</div>
    <h2>${sala ? `Você ficou em ${pos}º de ${S.placar.length}` : S.novoRecorde ? '<span class="recorde">Novo recorde!</span>' : 'Partida concluída'}</h2>
    <div class="box pontos">
      <div class="pt"><span>Itens do kit (${st.kit.length} × 10)</span><b>${p.itens}</b></div>
      <div class="pt"><span>Kit completo</span><b>${p.kitCompleto}</b></div>
      <div class="pt"><span>Cartas acertadas (${st.acertos} × 5)</span><b>${p.cartas}</b></div>
      <div class="pt"><span>Saldo final (${st.saldo} BC ÷ 10)</span><b>${p.saldo}</b></div>
      <div class="pt total"><span>Total</span><b>${p.total} pts</b></div>
    </div>
    ${sala ? `<div class="stack"><div class="eyebrow">Placar${aindaJogando ? ` · ${aindaJogando} ainda jogando` : ''}</div>${placarHtml()}</div>` : ''}
    <div class="promo"><b>Para chefes e responsáveis</b><span>No próximo acampamento, o grupo pode usar a carteira de evento do Trilha HUB: os jovens pagam com QR ou pulseira e os responsáveis acompanham cada gasto pelo WhatsApp.</span>${linkHub('resultado', 'Saiba mais sobre o Trilha HUB')}</div>
    <div class="row"><button class="btn primary" id="denovo">${sala && S.sala?.tipo === 'espera' ? 'Entrar na fila de novo' : 'Jogar de novo'}</button><button class="btn" id="inicio2">Voltar ao início</button>${sala ? '<button class="btn" id="verTab">Ver o tabuleiro</button>' : ''}</div>
  </div>`;
}

function ligarResultado() {
  const voltar = () => { if (S.modo === 'sala') { enviar({ t: 'sair_sala' }); ls.del('mt-sala'); } S.modo = null; ir('entrada'); };
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
  else if (S.tela === 'jogo') { app.innerHTML = telaJogo(); ligarJogo(); }
  else if (S.tela === 'resultado') { app.innerHTML = telaResultado(); ligarResultado(); }
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
