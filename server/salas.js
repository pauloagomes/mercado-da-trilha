// Salas, sala de espera e rodadas sincronizadas.
// O estado das salas ativas fica em memória para responder rápido, e cada
// mudança é gravada no PostgreSQL. Depois de reiniciar, a sala é recarregada do banco.
import crypto from 'node:crypto';
import * as E from '../public/js/engine.js';
import { pool } from './db.js';

export const CORES = ['#C2415D', '#2B6FA3', '#D69712', '#2F7A42', '#7A4FB0', '#178A86',
  '#B4581F', '#4F6D7A', '#A63D8F', '#5E8C31', '#C9672E', '#3E4FB8'];
export const MAX_ESPERA = 8;
export const MAX_CODIGO = 30;
export const RODADAS_ESPERA = E.RODADAS_PADRAO;

const ms = (n, def) => Number(process.env[n]) || def;
const CONTAGEM_FILA_MS = () => ms('CONTAGEM_FILA_MS', 80_000);
const RODADA_MS = () => ms('RODADA_MS', E.TEMPO_RODADA_S * 1000);
const INATIVIDADE_MS = () => ms('INATIVIDADE_MS', 2 * 60 * 60 * 1000);

const salas = new Map();           // codigo -> Sala
const fila = new Map();            // jogadorId -> { id, apelido, ficha, desde, ws }
let filaInicioEm = null;
let filaTimer = null;
let log = console;

export function configurar({ logger }) { if (logger) log = logger; }

function enviar(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

class Sala {
  constructor(r) {
    this.codigo = r.codigo.trim();
    this.tipo = r.tipo;
    this.status = r.status;
    this.anfitriao = r.anfitriao_id;
    this.rodadas = r.rodadas;
    this.semente = r.semente;
    this.rodadaSync = r.rodada_sync || 1;
    this.jogadores = new Map();  // jogadorId -> { partId, ordem, cor, st, gravando }
    this.sockets = new Set();    // conexões abertas nesta sala (jogadores e espectadores)
    this.mural = [];
    this.fimRodadaEm = null;
    this.timer = null;
    this.ultimaAtividade = Date.now();
    this.atividadeGravadaEm = 0;
  }
}

// ---------- Banco ----------
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function novoCodigo() {
  let s = '';
  for (let i = 0; i < 5; i++) s += LETRAS[crypto.randomInt(LETRAS.length)];
  return s;
}

async function inserirSala(tipo, rodadas, anfitriao) {
  for (let tent = 0; tent < 10; tent++) {
    const codigo = novoCodigo();
    const r = await pool.query(
      `INSERT INTO salas (codigo, tipo, status, anfitriao_id, rodadas, semente)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING *`,
      [codigo, tipo, tipo === 'codigo' ? 'aberta' : 'em_jogo', anfitriao, rodadas, crypto.randomInt(1, 2 ** 31 - 1)],
    );
    if (r.rowCount) return r.rows[0];
  }
  throw new Error('Não foi possível gerar um código de sala.');
}

async function adicionarJogador(sala, jog) {
  const ordem = sala.jogadores.size;
  const cor = CORES[ordem % CORES.length];
  const st = E.novoJogador({ apelido: jog.apelido, ficha: jog.ficha, rodadas: sala.rodadas, seed: sala.semente });
  st.saida = [];
  const r = await pool.query(
    `INSERT INTO participacoes (sala_codigo, jogador_id, ordem, cor, saldo_bc, estado)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (sala_codigo, jogador_id) DO UPDATE SET atualizado_em = now() RETURNING id`,
    [sala.codigo, jog.id, ordem, cor, st.saldo, E.visaoPropria(st)],
  );
  const p = { partId: r.rows[0].id, ordem, cor, st, gravando: Promise.resolve() };
  sala.jogadores.set(jog.id, p);
  return p;
}

function gravar(sala, jogId) {
  const p = sala.jogadores.get(jogId);
  if (!p) return;
  const saida = p.st.saida.splice(0);
  const st = p.st;
  const pontos = E.pontuacao(st).total;
  p.gravando = p.gravando.then(async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `UPDATE participacoes SET rodada = $2, posicao = $3, saldo_bc = $4, kit = $5, pontos = $6, estado = $7, atualizado_em = now()
         WHERE id = $1`,
        [p.partId, st.rodada, st.pos, st.saldo, JSON.stringify(st.kit), pontos, E.visaoPropria(st)],
      );
      for (const s of saida) {
        if (s.k === 'mov') {
          await c.query('INSERT INTO movimentos (participacao_id, tipo, valor_bc, saldo_depois, descricao) VALUES ($1, $2, $3, $4, $5)',
            [p.partId, s.tipo, s.valor, s.saldo, s.d]);
        } else if (s.k === 'jogada') {
          await c.query('INSERT INTO jogadas (sala_codigo, jogador_id, rodada, dado, casa) VALUES ($1, $2, $3, $4, $5)',
            [sala.codigo, jogId, s.rodada, s.dado, s.casa]);
        }
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      log.error?.({ err: e }, 'falha ao gravar participação');
    } finally {
      c.release();
    }
  });
  tocarAtividade(sala);
}

function tocarAtividade(sala) {
  sala.ultimaAtividade = Date.now();
  if (Date.now() - sala.atividadeGravadaEm > 60_000) {
    sala.atividadeGravadaEm = Date.now();
    pool.query('UPDATE salas SET ultima_atividade = now() WHERE codigo = $1', [sala.codigo]).catch(() => {});
  }
}

export async function carregarSala(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(codigo)) return null;
  if (salas.has(codigo)) return salas.get(codigo);
  const r = await pool.query('SELECT * FROM salas WHERE codigo = $1', [codigo]);
  if (!r.rowCount) return null;
  const sala = new Sala(r.rows[0]);
  const ps = await pool.query('SELECT * FROM participacoes WHERE sala_codigo = $1 ORDER BY ordem', [codigo]);
  for (const row of ps.rows) {
    const st = { ...row.estado, saida: [] };
    sala.jogadores.set(row.jogador_id, { partId: row.id, ordem: row.ordem, cor: row.cor, st, gravando: Promise.resolve() });
  }
  if (salas.has(codigo)) return salas.get(codigo); // outra requisição carregou junto
  salas.set(codigo, sala);
  if (sala.tipo === 'espera' && sala.status === 'em_jogo') abrirRodadaSync(sala, false);
  return sala;
}

// ---------- Visões enviadas aos celulares ----------
function placar(sala, paraId) {
  return [...sala.jogadores.entries()]
    .map(([id, p]) => ({ ...E.resumoPublico(p.st), cor: p.cor, ordem: p.ordem, eu: id === paraId,
      feito: sala.tipo === 'espera' ? (p.st.feito || p.st.rodada >= sala.rodadaSync) : false }))
    .sort(E.compararPlacar);
}

function infoSala(sala, paraId) {
  const lista = [...sala.jogadores.values()];
  return {
    codigo: sala.codigo, tipo: sala.tipo, status: sala.status, rodadas: sala.rodadas,
    rodadaSync: sala.rodadaSync, fimRodadaEm: sala.fimRodadaEm, agora: Date.now(),
    souAnfitriao: sala.anfitriao === paraId,
    jogando: lista.filter((p) => !p.st.fim).length,
    terminaram: lista.filter((p) => p.st.fim).length,
    total: lista.length, max: sala.tipo === 'espera' ? MAX_ESPERA : MAX_CODIGO,
  };
}

export function transmitir(sala) {
  for (const ws of sala.sockets) {
    const id = ws.jogadorId;
    const p = sala.jogadores.get(id);
    enviar(ws, {
      t: 'estado',
      sala: infoSala(sala, id),
      eu: p ? { ...E.visaoPropria(p.st), cor: p.cor } : null,
      placar: placar(sala, id),
      mural: sala.mural.slice(-15),
    });
  }
}

function anotarMural(sala, texto, cor) {
  sala.mural.push({ texto, cor, em: Date.now() });
  if (sala.mural.length > 30) sala.mural = sala.mural.slice(-30);
}

// ---------- Salas com código ----------
export async function criarSalaCodigo(jog, rodadas) {
  if (!E.RODADAS_OPCOES.includes(rodadas)) rodadas = E.RODADAS_PADRAO;
  const row = await inserirSala('codigo', rodadas, jog.id);
  const sala = new Sala(row);
  salas.set(sala.codigo, sala);
  await adicionarJogador(sala, jog);
  anotarMural(sala, `${jog.apelido} abriu a sala.`, CORES[0]);
  return sala;
}

export async function entrarNaSala(ws, jog, codigo) {
  const sala = await carregarSala(codigo);
  if (!sala) return enviar(ws, { t: 'erro', msg: 'Sala não encontrada. Confira o código.' });
  sairDaSalaAtual(ws);
  if (!sala.jogadores.has(jog.id)) {
    if (sala.tipo !== 'codigo') return enviar(ws, { t: 'erro', msg: 'Essa partida é da sala de espera e já começou.' });
    if (sala.status !== 'aberta') return enviar(ws, { t: 'erro', msg: 'Essa sala já foi encerrada.' });
    if (sala.jogadores.size >= MAX_CODIGO) return enviar(ws, { t: 'erro', msg: `A sala está cheia (${MAX_CODIGO} jogadores).` });
    const p = await adicionarJogador(sala, jog);
    anotarMural(sala, `${jog.apelido} entrou na sala.`, p.cor);
  }
  ws.salaCodigo = sala.codigo;
  sala.sockets.add(ws);
  enviar(ws, { t: 'partida', codigo: sala.codigo, tipo: sala.tipo });
  transmitir(sala);
}

export function sairDaSalaAtual(ws) {
  if (!ws.salaCodigo) return;
  const s = salas.get(ws.salaCodigo);
  if (s) s.sockets.delete(ws);
  ws.salaCodigo = null;
}

export async function encerrarSala(sala, motivo) {
  if (sala.status === 'encerrada') return;
  sala.status = 'encerrada';
  clearTimeout(sala.timer); sala.timer = null; sala.fimRodadaEm = null;
  for (const [id, p] of sala.jogadores) {
    if (!p.st.fim) { p.st.fim = true; p.st.avisos.push({ tipo: 'info', texto: 'Fim do mercado! A conta foi congelada.' }); gravar(sala, id); }
  }
  anotarMural(sala, motivo, '#4F6D7A');
  await pool.query("UPDATE salas SET status = 'encerrada', encerrada_em = now() WHERE codigo = $1", [sala.codigo]).catch(() => {});
  transmitir(sala);
}

// ---------- Ações do jogo ----------
const ACOES = {
  rolar: (st) => E.rolar(st),
  comprar: (st, m) => E.comprar(st, Array.isArray(m.itens) ? m.itens.map(String).slice(0, 7) : []),
  sair_loja: (st) => E.sairDaLoja(st),
  responder: (st, m) => E.responder(st, Number(m.i)),
  pagar: (st) => E.pagar(st),
  ficar: (st) => E.ficarParado(st),
};

export async function agir(ws, jog, msg) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  if (!sala) return enviar(ws, { t: 'erro', msg: 'Você não está em nenhuma sala.' });
  const p = sala.jogadores.get(jog.id);
  if (!p) return enviar(ws, { t: 'erro', msg: 'Você está só assistindo esta sala.' });
  if (sala.status === 'encerrada') return enviar(ws, { t: 'erro', msg: 'O mercado já fechou.' });
  const st = p.st;
  if (sala.tipo === 'espera' && st.rodada !== sala.rodadaSync - 1) {
    return enviar(ws, { t: 'erro', msg: 'Aguarde: a próxima rodada abre para todos juntos.' });
  }
  const fogoAntes = st.fogo, kitAntes = st.kit.length;
  const r = ACOES[msg.t](st, msg);
  if (r.erro) return enviar(ws, { t: 'erro', msg: r.erro });

  if (st.fogo > fogoAntes) {
    anotarMural(sala, `${st.apelido} chegou ao Fogo de Conselho!`, p.cor);
    for (const s of sala.sockets) enviar(s, { t: 'fogo', apelido: st.apelido, meu: s.jogadorId === jog.id });
  }
  if (st.kit.length === E.ITENS.length && kitAntes < E.ITENS.length) anotarMural(sala, `${st.apelido} completou o Kit de Acampamento!`, p.cor);

  if (sala.tipo === 'codigo' && st.feito) {
    E.fecharRodada(st);
    if (st.fim) anotarMural(sala, `${st.apelido} terminou com ${E.pontuacao(st).total} pts.`, p.cor);
  }
  gravar(sala, jog.id);
  if (sala.tipo === 'espera' && todosFeitos(sala)) fecharRodadaSync(sala);
  else transmitir(sala);
}

// ---------- Rodadas sincronizadas (sala de espera) ----------
function todosFeitos(sala) {
  for (const p of sala.jogadores.values()) if (!p.st.fim && !p.st.feito) return false;
  return true;
}

function abrirRodadaSync(sala, gravarNoBanco = true) {
  clearTimeout(sala.timer);
  sala.fimRodadaEm = Date.now() + RODADA_MS();
  sala.timer = setTimeout(() => fecharRodadaSync(sala), RODADA_MS());
  if (gravarNoBanco) pool.query('UPDATE salas SET rodada_sync = $2 WHERE codigo = $1', [sala.codigo, sala.rodadaSync]).catch(() => {});
}

function fecharRodadaSync(sala) {
  if (sala.status !== 'em_jogo') return;
  clearTimeout(sala.timer); sala.timer = null;
  for (const [id, p] of sala.jogadores) {
    const st = p.st;
    if (st.fim || st.rodada !== sala.rodadaSync - 1) continue;
    if (!st.feito) E.tempoEsgotado(st);
    E.fecharRodada(st);
    gravar(sala, id);
  }
  sala.rodadaSync += 1;
  if (sala.rodadaSync > sala.rodadas) {
    const vencedor = placar(sala, null)[0];
    encerrarSala(sala, vencedor ? `Fim do mercado! ${vencedor.apelido} venceu com ${vencedor.pontos} pts.` : 'Fim do mercado!');
    return;
  }
  abrirRodadaSync(sala);
  transmitir(sala);
}

// ---------- Sala de espera ----------
function transmitirFila() {
  const lista = [...fila.values()].sort((a, b) => a.desde - b.desde);
  for (const f of lista) {
    enviar(f.ws, {
      t: 'fila', agora: Date.now(), inicioEm: filaInicioEm, max: MAX_ESPERA,
      jogadores: lista.map((x) => ({ apelido: x.apelido, ficha: x.ficha, eu: x.id === f.id })),
    });
  }
}

function recalcularFila() {
  if (fila.size >= MAX_ESPERA) { iniciarPartidaDaFila(); return; }
  if (fila.size >= 2 && !filaInicioEm) {
    filaInicioEm = Date.now() + CONTAGEM_FILA_MS();
    filaTimer = setTimeout(iniciarPartidaDaFila, CONTAGEM_FILA_MS());
  } else if (fila.size < 2 && filaInicioEm) {
    clearTimeout(filaTimer); filaTimer = null; filaInicioEm = null;
  }
  transmitirFila();
}

export function entrarNaFila(ws, jog) {
  sairDaSalaAtual(ws);
  const atual = fila.get(jog.id);
  if (atual && atual.ws !== ws) enviar(atual.ws, { t: 'fila_saiu', msg: 'Você entrou na fila por outro aparelho.' });
  fila.set(jog.id, { id: jog.id, apelido: jog.apelido, ficha: jog.ficha, desde: atual?.desde || Date.now(), ws });
  ws.naFila = true;
  recalcularFila();
}

export function sairDaFila(ws, jog) {
  const f = fila.get(jog.id);
  if (f && f.ws === ws) { fila.delete(jog.id); ws.naFila = false; recalcularFila(); }
}

async function iniciarPartidaDaFila() {
  clearTimeout(filaTimer); filaTimer = null; filaInicioEm = null;
  const escolhidos = [...fila.values()].sort((a, b) => a.desde - b.desde).slice(0, MAX_ESPERA);
  if (escolhidos.length < 2) { recalcularFila(); return; }
  for (const f of escolhidos) { fila.delete(f.id); f.ws.naFila = false; }
  try {
    const row = await inserirSala('espera', RODADAS_ESPERA, null);
    const sala = new Sala(row);
    salas.set(sala.codigo, sala);
    // Na sala de espera cada ficha é exclusiva: quem chegou primeiro fica com ela.
    const usadas = new Set();
    for (const f of escolhidos) {
      let ficha = f.ficha;
      if (usadas.has(ficha)) ficha = E.FICHAS.find((x) => !usadas.has(x.id)).id;
      usadas.add(ficha);
      const p = await adicionarJogador(sala, { id: f.id, apelido: f.apelido, ficha });
      if (ficha !== f.ficha) p.st.avisos.push({ tipo: 'info', texto: 'Sua ficha já tinha sido escolhida por outro jogador, então você ganhou outra nesta partida.' });
      f.ws.salaCodigo = sala.codigo;
      sala.sockets.add(f.ws);
      enviar(f.ws, { t: 'partida', codigo: sala.codigo, tipo: 'espera' });
    }
    anotarMural(sala, `Partida da sala de espera com ${escolhidos.length} jogadores. Rodada 1 aberta!`, CORES[0]);
    abrirRodadaSync(sala);
    transmitir(sala);
  } catch (e) {
    log.error?.({ err: e }, 'falha ao iniciar partida da fila');
    for (const f of escolhidos) enviar(f.ws, { t: 'erro', msg: 'Não foi possível começar a partida. Entre na fila de novo.' });
  }
  recalcularFila();
}

export function desconectar(ws, jog) {
  if (jog) sairDaFila(ws, jog);
  sairDaSalaAtual(ws);
}

// ---------- Limpeza ----------
export function iniciarFaxina() {
  return setInterval(async () => {
    const limite = Date.now() - INATIVIDADE_MS();
    for (const sala of salas.values()) {
      if (sala.tipo === 'codigo' && sala.status === 'aberta' && sala.ultimaAtividade < limite) {
        await encerrarSala(sala, 'Sala encerrada depois de 2 horas sem jogadas.');
      }
      if (sala.status === 'encerrada' && sala.sockets.size === 0 && sala.ultimaAtividade < limite) salas.delete(sala.codigo);
    }
    await pool.query(
      `UPDATE salas SET status = 'encerrada', encerrada_em = now()
       WHERE tipo = 'codigo' AND status = 'aberta' AND ultima_atividade < now() - ($1 || ' milliseconds')::interval`,
      [String(INATIVIDADE_MS())],
    ).catch(() => {});
  }, Math.min(5 * 60 * 1000, INATIVIDADE_MS()));
}

export const _interno = { salas, fila };
