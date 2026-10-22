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
const INTERVALO_MS = () => ms('INTERVALO_MS', E.VOTO_S * 1000);
const INATIVIDADE_MS = () => ms('INATIVIDADE_MS', 2 * 60 * 60 * 1000);

const salas = new Map();           // codigo -> Sala
const fila = new Map();            // jogadorId -> { id, apelido, ficha, nivel, desde, ws }
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
    // F6: a missão sai da semente; só o vencedor precisa ficar gravado
    this.missao = { id: E.missaoDaPartida(r.semente).id, vencedor: r.missao?.vencedor ?? null };
    this.pontes = r.pontes || {};  // casa do tabuleiro -> jogadorId do guardião
    this.cenas = [];               // o que aconteceu nas últimas jogadas, para os outros celulares animarem
    this.cenaN = 0;
    this.gravando = Promise.resolve();
    this.janela = null;            // intervalo entre rodadas (votação de evento e leilão), só na sala de espera
    this.voto = null;
    this.leilao = null;
    this.leilaoFeito = false;
    this.patrulhasN = 0;           // A4: quantas patrulhas o anfitrião sorteou (0 = sem patrulhas)
    this.mestreEm = 0;
    this.revanche = null;          // E4: janela de 20 s da sala de espera
    this.revancheCodigo = null;    // E4: código da sala nova, quando o anfitrião reabre
    this.revancheFeita = false;
    this.rodadaSync = r.rodada_sync || 1;
    this.jogadores = new Map();  // jogadorId -> { partId, ordem, cor, st, ultimaReacao }
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
  const st = E.novoJogador({ apelido: jog.apelido, ficha: jog.ficha, rodadas: sala.rodadas, seed: sala.semente, ordem, sala: true, nivel: jog.nivel });
  st.saida = [];
  const r = await pool.query(
    `INSERT INTO participacoes (sala_codigo, jogador_id, ordem, cor, saldo_bc, estado, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (sala_codigo, jogador_id) DO UPDATE SET atualizado_em = now() RETURNING id`,
    [sala.codigo, jog.id, ordem, cor, st.saldo, E.visaoPropria(st), st.meta],
  );
  const p = { partId: r.rows[0].id, ordem, cor, st, ultimaReacao: 0, limite: 0, estendido: false, patrulha: null };
  if (sala.patrulhasN) {
    // quem chega com as patrulhas já sorteadas entra na que tem menos gente
    const conta = Array.from({ length: sala.patrulhasN }, (_, i) => [...sala.jogadores.values()].filter((x) => x.patrulha === i).length);
    p.patrulha = conta.indexOf(Math.min(...conta));
    pool.query('UPDATE participacoes SET patrulha = $2 WHERE id = $1', [p.partId, p.patrulha]).catch(() => {});
  }
  sala.jogadores.set(jog.id, p);
  return p;
}

// Grava um ou mais jogadores na mesma transação (o pagador do pedágio e o guardião que recebeu a gratificação).
function gravar(sala, ...ids) {
  const itens = [...new Set(ids)].map((id) => [id, sala.jogadores.get(id)]).filter(([, p]) => p)
    .map(([id, p]) => ({ id, p, st: p.st, saida: p.st.saida.splice(0), pontos: E.pontuacao(p.st).total }));
  if (!itens.length) return;
  const pontes = JSON.stringify(sala.pontes), missao = JSON.stringify(sala.missao);
  sala.gravando = sala.gravando.then(async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      for (const { id, p, st, saida, pontos } of itens) {
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
            await c.query('INSERT INTO jogadas (sala_codigo, jogador_id, rodada, dado, casa, rolagem) VALUES ($1, $2, $3, $4, $5, $6)',
              [sala.codigo, id, s.rodada, s.dado, s.casa, s.rolagem]);
          }
        }
      }
      await c.query('UPDATE salas SET pontes = $2, missao = $3 WHERE codigo = $1', [sala.codigo, pontes, missao]);
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
    const st = { ...row.estado, saida: [], cena: [] };
    sala.jogadores.set(row.jogador_id, { partId: row.id, ordem: row.ordem, cor: row.cor, st, ultimaReacao: 0, limite: 0, estendido: false, patrulha: row.patrulha });
    if (row.patrulha != null) sala.patrulhasN = Math.max(sala.patrulhasN, row.patrulha + 1);
  }
  if (salas.has(codigo)) return salas.get(codigo); // outra requisição carregou junto
  salas.set(codigo, sala);
  if (sala.tipo === 'espera' && sala.status === 'em_jogo') abrirRodadaSync(sala, false);
  return sala;
}

// E1: confere as insígnias de quem terminou. A de "Campeão da mesa" só sai quando todos terminaram.
function conferirInsignias(sala) {
  const lista = [...sala.jogadores.entries()];
  const todosFim = lista.length > 0 && lista.every(([, p]) => p.st.fim);
  const ranking = todosFim ? placar(sala, null).map((x) => x.ordem) : [];
  const origem = 'sala';
  for (const [id, p] of lista) {
    if (!p.st.fim) continue;
    const pos = todosFim ? ranking.indexOf(p.ordem) + 1 : 0;
    const ids = E.insigniasDaPartida(p.st, { pos, total: todosFim ? lista.length : 1 });
    p.st.insignias ||= [];
    const novas = ids.filter((i) => !p.st.insignias.includes(i));
    if (!novas.length) continue;
    p.st.insignias.push(...novas);
    for (const insignia of novas) {
      pool.query('INSERT INTO insignias (jogador_id, insignia, origem) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, insignia, origem]).catch(() => {});
    }
    gravar(sala, id);
  }
}

// ---------- Visões enviadas aos celulares ----------
function placar(sala, paraId) {
  return [...sala.jogadores.entries()]
    .map(([id, p]) => ({ ...E.resumoPublico(p.st), cor: p.cor, ordem: p.ordem, eu: id === paraId, patrulha: p.patrulha,
      insignias: p.st.insignias || [],
      feito: sala.tipo === 'espera' ? (p.st.feito || p.st.rodada >= sala.rodadaSync) : false }))
    .sort(E.compararPlacar);
}

// A4: média de pontos por patrulha, para a patrulha maior não ser favorecida.
const NOMES_PATRULHA = ['Lobos', 'Corujas', 'Raposas', 'Águias', 'Onças', 'Tucanos'];
function patrulhasPublicas(sala) {
  if (!sala.patrulhasN) return null;
  return Array.from({ length: sala.patrulhasN }, (_, i) => {
    const m = [...sala.jogadores.values()].filter((p) => p.patrulha === i);
    const pts = m.reduce((s, p) => s + E.pontuacao(p.st).total, 0);
    return { n: i, nome: NOMES_PATRULHA[i], membros: m.length, media: m.length ? Math.round((pts / m.length) * 10) / 10 : 0 };
  }).sort((a, b) => b.media - a.media);
}

function infoSala(sala, paraId) {
  const lista = [...sala.jogadores.values()];
  return {
    codigo: sala.codigo, tipo: sala.tipo, status: sala.status, rodadas: sala.rodadas,
    rodadaSync: sala.rodadaSync, fimRodadaEm: sala.fimRodadaEm, agora: Date.now(),
    souAnfitriao: sala.anfitriao === paraId,
    baseMs: RODADA_MS(),
    missao: { nome: E.missaoPorId(sala.missao.id).nome, itens: E.missaoPorId(sala.missao.id).itens, desc: E.descreverMissao(sala.missao), pts: E.MISSAO_PTS,
      vencedor: sala.missao.vencedor ? sala.jogadores.get(sala.missao.vencedor)?.st.apelido || null : null },
    ofertas: lista.filter((p) => p !== sala.jogadores.get(paraId) && E.ofertaAtiva(p.st)).map((p) => ({
      de: p.ordem, apelido: p.st.apelido, dar: p.st.oferta.dar, querer: p.st.oferta.querer,
      possoAceitar: sala.jogadores.has(paraId) && E.podeAceitar(sala.jogadores.get(paraId).st, p.st),
    })),
    pendentes: sala.tipo === 'espera' && sala.status === 'em_jogo' && !sala.janela
      ? lista.filter((p) => !p.st.fim && !p.st.feito && p.st.rodada === sala.rodadaSync - 1).map((p) => p.st.apelido) : [],
    voto: sala.voto ? {
      fimEm: sala.janela?.fim, rodada: sala.voto.rodada, votaram: sala.voto.votos.size,
      meuVoto: sala.voto.votos.get(paraId) ?? null,
      opcoes: sala.voto.opcoes.map((ev) => ({ tipo: ev.tipo, nome: E.EVENTOS[ev.tipo].nome, texto: E.descreverEvento(ev) })),
    } : null,
    leilao: sala.leilao ? {
      fimEm: sala.leilao.fim, deram: sala.leilao.lances.size, meuLance: sala.leilao.lances.get(paraId) ?? null,
      pts: E.CANIVETE_PTS, lances: E.LANCES,
    } : null,
    patrulhas: patrulhasPublicas(sala),
    revanche: sala.revanche ? { fimEm: sala.revanche.fim, aceitaram: sala.revanche.aceitos.size, euAceitei: sala.revanche.aceitos.has(paraId) } : null,
    revancheCodigo: sala.revancheCodigo,
    podeMestre: sala.tipo === 'codigo' && sala.status === 'aberta' && sala.anfitriao === paraId,
    podeLeilao: sala.tipo === 'codigo' && sala.status === 'aberta' && !sala.leilaoFeito && sala.anfitriao === paraId,
    jogando: lista.filter((p) => !p.st.fim).length,
    terminaram: lista.filter((p) => p.st.fim).length,
    total: lista.length, max: sala.tipo === 'espera' ? MAX_ESPERA : MAX_CODIGO,
  };
}

// Guardião de cada ponte, pela ordem do jogador (o id interno não sai do servidor).
function pontesPublicas(sala) {
  const r = {};
  for (const [pos, id] of Object.entries(sala.pontes)) {
    const p = sala.jogadores.get(id);
    if (p) r[pos] = p.ordem;
  }
  return r;
}

// O que o jogador vê de si: o guardião anterior da ponte chega pelo apelido, nunca pelo id interno.
function visaoDoJogador(sala, p) {
  const v = { ...E.visaoPropria(p.st), cor: p.cor, ordem: p.ordem };
  if (v.pend?.guardiao) {
    const g = sala.jogadores.get(v.pend.guardiao);
    v.pend = { ...v.pend, guardiao: undefined, guardiaoApelido: g?.st.apelido || null };
  }
  return v;
}

export function transmitir(sala) {
  for (const ws of sala.sockets) {
    const id = ws.jogadorId;
    const p = sala.jogadores.get(id);
    enviar(ws, {
      t: 'estado',
      sala: infoSala(sala, id),
      eu: p ? visaoDoJogador(sala, p) : null,
      placar: placar(sala, id),
      mural: sala.mural.slice(-15),
      pontes: pontesPublicas(sala),
      cenas: sala.cenas,
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
  clearTimeout(sala.janela?.timer); clearTimeout(sala.leilao?.timer); sala.janela = null; sala.voto = null; sala.leilao = null;
  for (const [id, p] of sala.jogadores) {
    if (!p.st.fim) { p.st.fim = true; p.st.avisos.push({ tipo: 'info', texto: 'Fim do mercado! A conta foi congelada.' }); gravar(sala, id); }
  }
  anotarMural(sala, motivo, '#4F6D7A');
  conferirInsignias(sala);
  await pool.query("UPDATE salas SET status = 'encerrada', encerrada_em = now() WHERE codigo = $1", [sala.codigo]).catch(() => {});
  transmitir(sala);
}

// ---------- Ações do jogo ----------
const ACOES = new Set(E.ACOES_DO_JOGO);

// O motor da sala trabalha sobre os estados dos jogadores e as pontes da sala.
function contexto(sala) {
  const ctx = E.novoContexto(sala.pontes);
  ctx.missao = sala.missao;
  ctx.ofertas = true; // A7: nas salas dá para oferecer troca aos outros jogadores
  for (const [id, p] of sala.jogadores) ctx.estados.set(id, p.st);
  return ctx;
}

// Esvazia a cena de cada jogador (o que aconteceu na jogada) para os celulares animarem
// e anota no mural o que merece. Devolve os jogadores que tiveram novidade.
function recolherCenas(sala) {
  const ids = [];
  for (const [id, p] of sala.jogadores) {
    const cena = E.esvaziarCena(p.st);
    if (!cena.length) continue;
    ids.push(id);
    sala.cenas.push({ n: ++sala.cenaN, ordem: p.ordem, cena });
    for (const ev of cena) {
      if (ev.t === 'fogo') anotarMural(sala, `${p.st.apelido} chegou ao Fogo de Conselho!`, p.cor);
      else if (ev.t === 'kit') anotarMural(sala, `${p.st.apelido} completou o Kit de Acampamento!`, p.cor);
      else if (ev.t === 'ponte') anotarMural(sala, `${p.st.apelido} assumiu a ponte.`, p.cor);
      else if (ev.t === 'missao') anotarMural(sala, `${p.st.apelido} cumpriu a missão da sala primeiro: ${ev.nome} (+${E.MISSAO_PTS} pts).`, p.cor);
      else if (ev.t === 'troca') anotarMural(sala, `${p.st.apelido} fez uma troca na Feira (${E.ITENS.find((i) => i.id === ev.dar).nome} por ${E.ITENS.find((i) => i.id === ev.querer).nome}).`, p.cor);
      else if (ev.t === 'carta') {
        const c = E.cartaPorId(p.st.resposta?.carta);
        if (c?.sala) anotarMural(sala, `${p.st.apelido} tirou a carta de sala "${c.titulo}".`, p.cor);
      }
    }
  }
  if (sala.cenas.length > 16) sala.cenas = sala.cenas.slice(-16);
  return ids;
}

export async function agir(ws, jog, msg) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  if (!sala) return enviar(ws, { t: 'erro', msg: 'Você não está em nenhuma sala.' });
  const p = sala.jogadores.get(jog.id);
  if (!p) return enviar(ws, { t: 'erro', msg: 'Você está só assistindo esta sala.' });
  if (sala.status === 'encerrada') return enviar(ws, { t: 'erro', msg: 'O mercado já fechou.' });
  if (!ACOES.has(msg.t)) return;
  const st = p.st;
  if (sala.janela) return enviar(ws, { t: 'erro', msg: 'Aguarde o fim da votação: a próxima rodada já abre.' });
  if (sala.tipo === 'espera' && st.rodada !== sala.rodadaSync - 1) {
    return enviar(ws, { t: 'erro', msg: 'Aguarde: a próxima rodada abre para todos juntos.' });
  }
  if (msg.t === 'aceitar_troca') {
    const alvo = [...sala.jogadores].find(([, x]) => x.ordem === Number(msg.de));
    if (!alvo) return enviar(ws, { t: 'erro', msg: 'Essa oferta não existe mais.' });
    msg = { t: msg.t, de: alvo[0] };
  }
  const r = E.agirNaSala(contexto(sala), jog.id, msg);
  if (r.erro) return enviar(ws, { t: 'erro', msg: r.erro });

  if (sala.tipo === 'codigo' && st.feito) {
    E.fecharRodada(st);
    E.passarRodadasPerdidas(st);
    if (st.fim) { anotarMural(sala, `${st.apelido} terminou com ${E.pontuacao(st).total} pts.`, p.cor); conferirInsignias(sala); }
  }
  // C6: quem cai numa loja ou carta ganha mais um tempo para decidir.
  if (sala.tipo === 'espera' && st.pend && !p.estendido && ['loja', 'carta', 'dado'].includes(st.pend.tipo)) {
    p.estendido = true; p.limite = Math.max(p.limite, Date.now() + RODADA_MS());
  }
  gravar(sala, jog.id, ...r.afetados, ...recolherCenas(sala));
  if (sala.tipo === 'espera') {
    recalcularRelogio(sala);
    if (todosFeitos(sala)) { fecharRodadaSync(sala); return; }
  }
  transmitir(sala);
}

// A3: reação rápida de uma lista fixa, sem alvo e no máximo uma a cada 3 s por jogador.
export function reagir(ws, jog, msg) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  const p = sala?.jogadores.get(jog.id);
  if (!p || sala.status === 'encerrada') return;
  const i = Number(msg.i);
  if (!Number.isInteger(i) || i < 0 || i >= E.REACOES.length) return;
  const agora = Date.now();
  if (agora - p.ultimaReacao < E.REACAO_INTERVALO_MS - 300) return;
  p.ultimaReacao = agora;
  const texto = `${p.st.apelido}: ${E.REACOES[i]}`;
  anotarMural(sala, texto, p.cor);
  // Vai direto aos celulares, sem reenviar o estado inteiro a cada reação.
  for (const s of sala.sockets) enviar(s, { t: 'reacao', ordem: p.ordem, i, texto, cor: p.cor });
  tocarAtividade(sala);
}

// ---------- Rodadas sincronizadas (sala de espera) ----------
function todosFeitos(sala) {
  for (const p of sala.jogadores.values()) if (!p.st.fim && !p.st.feito) return false;
  return true;
}

// C6: cada jogador tem o seu limite (20 s, mais 20 s se cair numa loja ou carta); a rodada fecha
// quando todos terminam ou quando o último limite chega.
function recalcularRelogio(sala) {
  clearTimeout(sala.timer); sala.timer = null;
  const limites = [...sala.jogadores.values()]
    .filter((p) => !p.st.fim && !p.st.feito && p.st.rodada === sala.rodadaSync - 1).map((p) => p.limite);
  if (!limites.length) { sala.fimRodadaEm = null; return; }
  sala.fimRodadaEm = Math.max(...limites);
  sala.timer = setTimeout(() => fecharRodadaSync(sala), Math.max(0, sala.fimRodadaEm - Date.now()));
}

function abrirRodadaSync(sala, gravarNoBanco = true) {
  clearTimeout(sala.timer);
  const agora = Date.now(), perdidas = [];
  for (const [id, p] of sala.jogadores) {
    if (p.st.fim || p.st.rodada !== sala.rodadaSync - 1) continue;
    p.limite = agora + RODADA_MS(); p.estendido = false;
    if (E.rodadaPerdida(p.st)) perdidas.push(id); // rodada perdida passa sozinha, sem clique
  }
  recalcularRelogio(sala);
  if (gravarNoBanco) pool.query('UPDATE salas SET rodada_sync = $2 WHERE codigo = $1', [sala.codigo, sala.rodadaSync]).catch(() => {});
  if (perdidas.length) gravar(sala, ...perdidas, ...recolherCenas(sala));
  if (todosFeitos(sala)) setImmediate(() => fecharRodadaSync(sala));
}

// Fim do tempo (ou de todos prontos): joga por quem não jogou e abre, se houver, a janela de
// votação de evento e de leilão ANTES de a rodada seguinte começar (o evento já entra nela).
function fecharRodadaSync(sala) {
  if (sala.status !== 'em_jogo' || sala.janela) return;
  clearTimeout(sala.timer); sala.timer = null;
  const ctx = contexto(sala), tocados = new Set();
  for (const [id, p] of sala.jogadores) {
    if (p.st.fim || p.st.rodada !== sala.rodadaSync - 1) continue;
    if (!p.st.feito) E.tempoEsgotado(p.st, Math.random, ctx, id);
    tocados.add(id);
  }
  gravar(sala, ...tocados, ...recolherCenas(sala));
  const k = sala.rodadaSync, abrir = [];
  if (k + 2 <= sala.rodadas && (k + 2) % 3 === 0) abrir.push('voto');
  if (k + 1 === E.rodadaDoLeilao(sala.rodadas)) abrir.push('leilao');
  if (abrir.length && [...sala.jogadores.values()].some((p) => !p.st.fim)) abrirJanela(sala, abrir);
  else concluirRodadaSync(sala);
}

function concluirRodadaSync(sala) {
  const tocados = new Set();
  for (const [id, p] of sala.jogadores) {
    if (p.st.oferta) { p.st.oferta = null; tocados.add(id); } // A7: na sala de espera a oferta vale só na rodada
    if (p.st.fim || p.st.rodada !== sala.rodadaSync - 1) continue;
    E.fecharRodada(p.st);
    tocados.add(id);
  }
  gravar(sala, ...tocados, ...recolherCenas(sala));
  sala.rodadaSync += 1;
  if (sala.rodadaSync > sala.rodadas) {
    const vencedor = placar(sala, null)[0];
    encerrarSala(sala, vencedor ? `Fim do mercado! ${vencedor.apelido} venceu com ${vencedor.pontos} pts.` : 'Fim do mercado!');
    return;
  }
  abrirRodadaSync(sala);
  transmitir(sala);
}

// ---------- Janela entre rodadas: votação de evento (A5) e leilão do Canivete (C3) ----------
function abrirJanela(sala, tipos) {
  const k = sala.rodadaSync, fim = Date.now() + INTERVALO_MS();
  if (tipos.includes('voto')) {
    sala.voto = { rodada: k + 2, opcoes: E.opcoesDoEvento(sala.semente, (k + 2) / 3 - 1), votos: new Map() };
  }
  if (tipos.includes('leilao')) sala.leilao = { fim, lances: new Map(), rodada: k + 1 };
  sala.fimRodadaEm = null;
  sala.janela = { fim, timer: setTimeout(() => fecharJanela(sala), INTERVALO_MS()) };
  anotarMural(sala, tipos.includes('leilao') ? 'Leilão do Canivete e votação abertos por 10 s!' : 'Votação do próximo evento aberta por 10 s!', CORES[0]);
  transmitir(sala);
}

function resolverVoto(sala) {
  const v = sala.voto; if (!v) return [];
  const cont = [0, 0];
  for (const i of v.votos.values()) cont[i] += 1;
  const esc = cont[0] + cont[1] === 0 || cont[0] > cont[1] ? 0 : cont[1] > cont[0] ? 1 : Math.floor(Math.random() * 2); // empate sorteia
  const ev = v.opcoes[esc];
  for (const p of sala.jogadores.values()) E.definirEvento(p.st, v.rodada, ev);
  anotarMural(sala, `Evento da rodada ${v.rodada}: ${E.descreverEvento(ev)} (${cont[esc]} x ${cont[1 - esc]}).`, CORES[0]);
  pool.query(
    `INSERT INTO eventos_sala (sala_codigo, rodada, tipo, loja, origem) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (sala_codigo, rodada) DO UPDATE SET tipo = $3, loja = $4, origem = $5`,
    [sala.codigo, v.rodada, ev.tipo, ev.loja || null, cont[0] + cont[1] ? 'votacao' : 'sorteio'],
  ).catch(() => {});
  sala.voto = null;
  return [...sala.jogadores.keys()];
}

function resolverLeilaoDaSala(sala) {
  const l = sala.leilao; if (!l) return [];
  const lances = [...sala.jogadores].filter(([, p]) => !p.st.fim)
    .map(([id, p]) => ({ id, valor: l.lances.get(id) ?? 0, saldo: p.st.saldo, ordem: p.ordem }));
  const venc = E.resolverLeilao(lances);
  const tocados = [];
  if (venc) {
    const p = sala.jogadores.get(venc.id);
    E.vencerLeilao(p.st, venc.valor);
    tocados.push(venc.id);
    anotarMural(sala, `${p.st.apelido} levou o Canivete no leilão por ${venc.valor} BC (+${E.CANIVETE_PTS} pts).`, p.cor);
  } else anotarMural(sala, 'Ninguém deu lance no Canivete: o leilão acabou sem vencedor.', CORES[0]);
  for (const x of lances) {
    pool.query(
      `INSERT INTO lances (sala_codigo, rodada, jogador_id, valor_bc, ganhou) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sala_codigo, rodada, jogador_id) DO NOTHING`,
      [sala.codigo, l.rodada, x.id, x.valor, venc?.id === x.id],
    ).catch(() => {});
  }
  sala.leilao = null;
  return tocados;
}

function fecharJanela(sala) {
  if (!sala.janela) return;
  clearTimeout(sala.janela.timer);
  const tocados = [...resolverVoto(sala), ...resolverLeilaoDaSala(sala)];
  sala.janela = null;
  gravar(sala, ...tocados, ...recolherCenas(sala));
  if (sala.status === 'em_jogo') concluirRodadaSync(sala);
}

// Fecha antes dos 10 s quando todo mundo já votou e deu lance.
const todosEnviaram = (sala, mapa) => [...sala.jogadores].filter(([, p]) => !p.st.fim).every(([id]) => mapa.has(id));
function janelaCompleta(sala) {
  return (!sala.voto || todosEnviaram(sala, sala.voto.votos)) && (!sala.leilao || todosEnviaram(sala, sala.leilao.lances));
}

export function votarEvento(ws, jog, msg) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  const p = sala?.jogadores.get(jog.id), i = Number(msg.i);
  if (!p || !sala.voto || p.st.fim) return enviar(ws, { t: 'erro', msg: 'Não há votação aberta agora.' });
  if (i !== 0 && i !== 1) return;
  sala.voto.votos.set(jog.id, i);
  if (sala.janela && janelaCompleta(sala)) fecharJanela(sala); else transmitir(sala);
}

export function darLance(ws, jog, msg) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  const p = sala?.jogadores.get(jog.id), valor = Number(msg.valor);
  if (!p || !sala.leilao || p.st.fim) return enviar(ws, { t: 'erro', msg: 'Não há leilão aberto agora.' });
  if (!E.LANCES.includes(valor)) return enviar(ws, { t: 'erro', msg: 'Escolha um dos valores de lance.' });
  if (!E.lanceValido(p.st, valor)) return enviar(ws, { t: 'erro', msg: `Seu saldo é ${p.st.saldo} BC: não dá para oferecer ${valor} BC.` });
  sala.leilao.lances.set(jog.id, valor);
  if (sala.janela && janelaCompleta(sala)) fecharJanela(sala);
  else if (!sala.janela && todosEnviaram(sala, sala.leilao.lances)) fecharLeilaoCodigo(sala);
  else transmitir(sala);
}

// C3 nas salas com código: o anfitrião abre o leilão quando quiser, uma vez por sala.
export function abrirLeilaoCodigo(ws, jog) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  if (!sala || sala.tipo !== 'codigo' || sala.anfitriao !== jog.id) return;
  if (sala.status !== 'aberta' || sala.leilaoFeito || sala.leilao) return enviar(ws, { t: 'erro', msg: 'O leilão desta sala já aconteceu.' });
  sala.leilaoFeito = true;
  sala.leilao = { fim: Date.now() + INTERVALO_MS(), lances: new Map(), rodada: 0 };
  sala.leilao.timer = setTimeout(() => fecharLeilaoCodigo(sala), INTERVALO_MS());
  anotarMural(sala, 'O anfitrião abriu o leilão do Canivete por 10 s!', CORES[0]);
  transmitir(sala);
}

function fecharLeilaoCodigo(sala) {
  if (!sala.leilao) return;
  clearTimeout(sala.leilao.timer);
  const tocados = resolverLeilaoDaSala(sala);
  gravar(sala, ...tocados, ...recolherCenas(sala));
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
  fila.set(jog.id, { id: jog.id, apelido: jog.apelido, ficha: jog.ficha, nivel: jog.nivel, desde: atual?.desde || Date.now(), ws });
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
  await abrirPartidaEspera(escolhidos, `Partida da sala de espera com ${escolhidos.length} jogadores. Rodada 1 aberta!`);
  recalcularFila();
}

// Cria a partida da sala de espera para estes jogadores (vindos da fila ou de uma revanche).
async function abrirPartidaEspera(escolhidos, aviso) {
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
      const p = await adicionarJogador(sala, { id: f.id, apelido: f.apelido, ficha, nivel: f.nivel });
      if (ficha !== f.ficha) p.st.avisos.push({ tipo: 'info', texto: 'Sua ficha já tinha sido escolhida por outro jogador, então você ganhou outra nesta partida.' });
      sairDaSalaAtual(f.ws);
      f.ws.salaCodigo = sala.codigo;
      sala.sockets.add(f.ws);
      enviar(f.ws, { t: 'partida', codigo: sala.codigo, tipo: 'espera', nova: true });
    }
    anotarMural(sala, aviso, CORES[0]);
    abrirRodadaSync(sala);
    transmitir(sala);
  } catch (e) {
    log.error?.({ err: e }, 'falha ao iniciar partida da fila');
    for (const f of escolhidos) enviar(f.ws, { t: 'erro', msg: 'Não foi possível começar a partida. Tente de novo.' });
  }
}

// ---------- Patrulhas (A4), Mestre do mercado (C7) e revanche (E4) ----------
const anfitriaoDe = (ws, jog) => {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  return sala && sala.tipo === 'codigo' && sala.anfitriao === jog.id ? sala : null;
};

// O anfitrião escolhe quantas patrulhas (2 a 6) e o sistema sorteia quem fica em cada uma.
export async function sortearPatrulhas(ws, jog, msg) {
  const sala = anfitriaoDe(ws, jog);
  if (!sala || sala.status !== 'aberta') return;
  const n = Number(msg.n);
  if (!Number.isInteger(n) || n < 2 || n > 6) return enviar(ws, { t: 'erro', msg: 'Escolha de 2 a 6 patrulhas.' });
  const ids = [...sala.jogadores.keys()];
  if (ids.length < n) return enviar(ws, { t: 'erro', msg: `Para ${n} patrulhas a sala precisa de pelo menos ${n} jogadores.` });
  for (let i = ids.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  ids.forEach((id, i) => { sala.jogadores.get(id).patrulha = i % n; });
  sala.patrulhasN = n;
  await pool.query(
    'UPDATE participacoes SET patrulha = x.pat FROM (SELECT unnest($1::bigint[]) AS id, unnest($2::smallint[]) AS pat) x WHERE participacoes.id = x.id',
    [ids.map((id) => sala.jogadores.get(id).partId), ids.map((id) => sala.jogadores.get(id).patrulha)],
  ).catch((e) => log.error?.({ err: e }, 'falha ao gravar patrulhas'));
  anotarMural(sala, `O anfitrião sorteou ${n} patrulhas.`, CORES[0]);
  tocarAtividade(sala);
  transmitir(sala);
}

// O anfitrião chama um evento para a sala toda na hora, na rodada em que cada um estiver.
export function mestreDoMercado(ws, jog, msg) {
  const sala = anfitriaoDe(ws, jog);
  if (!sala || sala.status !== 'aberta') return;
  if (!E.MESTRE_EVENTOS.includes(msg.tipo)) return enviar(ws, { t: 'erro', msg: 'Evento desconhecido.' });
  if (Date.now() - sala.mestreEm < 15_000) return enviar(ws, { t: 'erro', msg: 'Espere alguns segundos entre um evento e outro.' });
  sala.mestreEm = Date.now();
  const loja = E.EVENTOS[msg.tipo].loja ? E.LOJAS[crypto.randomInt(E.LOJAS.length)] : null;
  const tocados = [];
  for (const [id, p] of sala.jogadores) if (E.aplicarEventoAgora(p.st, msg.tipo, loja)) tocados.push(id);
  anotarMural(sala, `O anfitrião chamou: ${E.descreverEvento({ tipo: msg.tipo, loja })}.`, CORES[0]);
  gravar(sala, ...tocados, ...recolherCenas(sala));
  transmitir(sala);
}

// Na sala de espera, quem aceitar a revanche em 20 s joga de novo junto. Na sala com código, o
// anfitrião reabre e todos são levados para a sala nova.
export async function pedirRevanche(ws, jog) {
  const sala = ws.salaCodigo && salas.get(ws.salaCodigo);
  const p = sala?.jogadores.get(jog.id);
  if (!p) return;
  if (sala.tipo === 'codigo') {
    if (sala.anfitriao !== jog.id) return enviar(ws, { t: 'erro', msg: 'Só o anfitrião reabre a sala.' });
    if (sala.revancheCodigo) return;
    if (sala.status === 'aberta') await encerrarSala(sala, 'O anfitrião reabriu a sala para a revanche.');
    const nova = await criarSalaCodigo({ id: jog.id, apelido: jog.apelido, ficha: jog.ficha, nivel: jog.nivel }, sala.rodadas);
    sala.revancheCodigo = nova.codigo;
    for (const s of [...sala.sockets]) {
      if (s === ws) await entrarNaSala(ws, jog, nova.codigo);
      enviar(s, { t: 'revanche_sala', codigo: nova.codigo, de: jog.apelido, proprio: s === ws });
    }
    transmitir(sala);
    return;
  }
  if (sala.status !== 'encerrada') return;
  if (sala.revancheFeita) return enviar(ws, { t: 'erro', msg: 'A revanche desta partida já começou. Entre na fila de novo.' });
  sala.revanche ||= { fim: Date.now() + 20_000, aceitos: new Map() };
  if (!sala.revanche.timer) sala.revanche.timer = setTimeout(() => fecharRevanche(sala), 20_000);
  sala.revanche.aceitos.set(jog.id, ws);
  const conectados = [...sala.jogadores.keys()].filter((id) => [...sala.sockets].some((s) => s.jogadorId === id && s.readyState === 1));
  if (conectados.every((id) => sala.revanche.aceitos.has(id))) fecharRevanche(sala); else transmitir(sala);
}

async function fecharRevanche(sala) {
  const r = sala.revanche; if (!r) return;
  clearTimeout(r.timer); sala.revanche = null; sala.revancheFeita = true;
  const escolhidos = [...r.aceitos].filter(([, w]) => w.readyState === 1).map(([id, w]) => {
    const p = sala.jogadores.get(id);
    return { id, apelido: p.st.apelido, ficha: p.st.ficha, nivel: p.st.nivel, ws: w };
  }).slice(0, MAX_ESPERA);
  if (escolhidos.length < 2) {
    sala.revancheFeita = false;
    for (const f of escolhidos) enviar(f.ws, { t: 'erro', msg: 'A revanche precisa de pelo menos 2 jogadores.' });
    transmitir(sala);
    return;
  }
  await abrirPartidaEspera(escolhidos, `Revanche com ${escolhidos.length} jogadores. Rodada 1 aberta!`);
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
