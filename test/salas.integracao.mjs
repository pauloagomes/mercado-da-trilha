// Integração das salas com o PostgreSQL, sem subir o servidor HTTP.
// Uso: DATABASE_URL=postgres://... node test/salas.integracao.mjs
// Força o dado (Math.random fixo) para montar cenas que o acaso quase nunca repete:
// pedágio com guardião, dado duplo, ajudar no acampamento, carta de sala e reação rápida.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool, migrar } from '../server/db.js';
import * as S from '../server/salas.js';
import * as E from '../public/js/engine.js';

await migrar({ info() {} });

async function novoJogador(apelido) {
  const r = await pool.query(
    'INSERT INTO jogadores (token_hash, apelido, ficha) VALUES ($1, $2, $3) RETURNING id',
    [crypto.randomUUID(), apelido, 'f01'],
  );
  return { id: r.rows[0].id, apelido, ficha: 'f01' };
}
function falso(jog) {
  return { readyState: 1, jogadorId: jog.id, msgs: [], send(m) { this.msgs.push(JSON.parse(m)); },
    ultimo(tipo) { return [...this.msgs].reverse().find((m) => m.t === tipo); } };
}
const dadoFixo = (d, resto = 0.01) => { let n = 0; Math.random = () => (n++ === 0 ? (d - 1) / 6 + 0.01 : resto); };

const ana = await novoJogador('Ana'), beto = await novoJogador('Beto');
const wsA = falso(ana), wsB = falso(beto);
const sala = await S.criarSalaCodigo(ana, 8);
await S.entrarNaSala(wsA, ana, sala.codigo);
await S.entrarNaSala(wsB, beto, sala.codigo);
const pa = sala.jogadores.get(ana.id), pb = sala.jogadores.get(beto.id);
assert.notEqual(pa.st.meta, pb.st.meta, 'cada jogador da sala recebe uma meta diferente');

const rows = async (sql, args) => (await pool.query(sql, args)).rows;
const movs = (p) => rows('SELECT tipo, valor_bc, saldo_depois FROM movimentos WHERE participacao_id = $1 ORDER BY id', [p.partId]);

try {
  // ---- A1: guardião da ponte, pagador e guardião gravados juntos
  pa.st.pos = 7; pb.st.pos = 7;
  dadoFixo(1, 0.0); // dado 1, pedágio de 2 BC
  await S.agir(wsA, ana, { t: 'rolar' });
  assert.equal(pa.st.pend.tipo, 'pedagio');
  assert.equal(sala.pontes['8'], ana.id, 'quem para primeiro vira guardião');
  await S.agir(wsA, ana, { t: 'pagar' });
  assert.equal(pa.st.saldo, 98);

  dadoFixo(1, 0.99); // pedágio de 12 BC
  await S.agir(wsB, beto, { t: 'rolar' });
  assert.equal(sala.pontes['8'], beto.id, 'Beto assume a ponte');
  await S.agir(wsB, beto, { t: 'pagar' });
  await sala.gravando;
  assert.equal(pb.st.saldo, 88);
  assert.equal(pa.st.saldo, 101, 'Ana recebe 3 BC de gratificação');
  assert.deepEqual((await movs(pa)).map((m) => m.tipo), ['pedagio', 'gratificacao']);
  assert.deepEqual((await movs(pb)).map((m) => m.tipo), ['pedagio']);
  const [{ pontes }] = await rows('SELECT pontes FROM salas WHERE codigo = $1', [sala.codigo]);
  assert.equal(pontes['8'], beto.id, 'o guardião fica gravado no banco');
  const est = wsA.ultimo('estado');
  assert.equal(est.pontes['8'], pb.ordem, 'os celulares recebem o guardião pela ordem, não pelo id');
  assert.ok(!JSON.stringify(est).includes(beto.id), 'nenhum id interno de jogador sai para os celulares');
  assert.ok(est.cenas.some((c) => c.ordem === pa.ordem && c.cena.some((e) => e.t === 'gratificacao')));
  assert.ok(sala.mural.some((m) => /Beto assumiu a ponte/.test(m.texto)));

  // ---- B1: dado duplo e ajudar no acampamento
  pa.st.pos = 0; pa.st.saldo = 100;
  dadoFixo(2); // o primeiro dado dá 2 e o segundo, 1
  await S.agir(wsA, ana, { t: 'dado_duplo' });
  assert.equal(pa.st.pend.tipo, 'dado');
  assert.equal(pa.st.saldo, 95);
  await S.agir(wsA, ana, { t: 'escolher_dado', i: 0 });
  await S.agir(wsB, beto, { t: 'ajudar' });
  await sala.gravando;
  assert.ok((await movs(pa)).some((m) => m.tipo === 'dado_duplo' && m.valor_bc === -5));
  assert.ok((await movs(pb)).some((m) => m.tipo === 'credito' && m.valor_bc === 15));
  const jogadas = await rows('SELECT rolagem FROM jogadas WHERE sala_codigo = $1 ORDER BY id', [sala.codigo]);
  assert.ok(jogadas.some((j) => j.rolagem === 'duplo') && jogadas.some((j) => j.rolagem === 'ajuda'));

  // ---- Erro não muda nada: dado duplo sem saldo
  pa.st.rolou = false; pa.st.feito = false; pa.st.pend = null; pa.st.saldo = 3;
  const antes = pa.st.saldo;
  await S.agir(wsA, ana, { t: 'dado_duplo' });
  assert.equal(wsA.ultimo('erro').msg.includes('custa 5 BC'), true);
  assert.equal(pa.st.saldo, antes);

  // ---- A2: carta de sala atinge o outro jogador e vai para o banco
  pa.st.saldo = 100; pb.st.saldo = 100; pb.st.kit = []; pa.st.rolou = true; pa.st.feito = false;
  pa.st.pend = { tipo: 'carta', carta: 'salachuva' };
  const errada = (E.cartaMostrada(pa.st, 'salachuva').certa + 1) % 3;
  await S.agir(wsA, ana, { t: 'responder', i: errada });
  await sala.gravando;
  assert.equal(pb.st.saldo, 95, 'Beto não tem Lona e paga 5 BC');
  assert.ok((await movs(pb)).some((m) => m.valor_bc === -5 && m.tipo === 'pedagio'), 'a cobrança de Beto foi gravada');
  assert.ok(wsB.ultimo('estado').eu.avisos.some((a) => /Ana tirou "Chuva no acampamento"/.test(a.texto)));

  // ---- A3: reação rápida, uma a cada 3 s por jogador
  wsB.msgs.length = 0;
  S.reagir(wsA, ana, { i: 2 });
  S.reagir(wsA, ana, { i: 3 });
  S.reagir(wsA, ana, { i: 99 });
  const reacoes = wsB.msgs.filter((m) => m.t === 'reacao');
  assert.equal(reacoes.length, 1, 'só a primeira reação passa');
  assert.deepEqual([reacoes[0].ordem, reacoes[0].i], [pa.ordem, 2]);
  assert.equal(reacoes[0].texto, 'Ana: Ai!');

  // ---- Recarregar a sala do banco devolve guardiões e estados v2
  S._interno.salas.delete(sala.codigo);
  const volta = await S.carregarSala(sala.codigo);
  assert.equal(volta.pontes['8'], beto.id);
  assert.equal(volta.jogadores.get(beto.id).st.v, E.VERSAO_ESTADO);
  assert.deepEqual(volta.jogadores.get(ana.id).st.cena, []);
  console.log('sala com código ok');

  // ---- Etapa 2: sala de espera com janela de votação, leilão e rodada perdida automática
  process.env.CONTAGEM_FILA_MS = '30'; process.env.RODADA_MS = '600000'; process.env.INTERVALO_MS = '600000';
  const wa = falso(ana), wb = falso(beto);
  S.entrarNaFila(wa, ana); S.entrarNaFila(wb, beto);
  const ate = async (c, ms = 3000) => { const t0 = Date.now(); while (!c()) { if (Date.now() - t0 > ms) throw new Error('tempo esgotado'); await new Promise((r) => setTimeout(r, 20)); } };
  await ate(() => wa.ultimo('partida') && wb.ultimo('partida'));
  const esp = S._interno.salas.get(wa.ultimo('partida').codigo);
  const A = esp.jogadores.get(ana.id), B = esp.jogadores.get(beto.id);
  try {
    const ajudam = async () => { await S.agir(wa, ana, { t: 'ajudar' }); await S.agir(wb, beto, { t: 'ajudar' }); };
    await ajudam();
    assert.ok(esp.janela && esp.voto, 'depois da rodada 1 abre a votação do evento da rodada 3');
    assert.equal(esp.voto.rodada, 3);
    assert.equal(esp.rodadaSync, 1, 'a rodada 2 só abre depois da votação');
    assert.match(wa.ultimo('estado').sala.voto.opcoes[0].texto, /\w/);
    await S.agir(wa, ana, { t: 'ajudar' }); assert.match(wa.ultimo('erro').msg, /votação/);
    const [, opB] = E.opcoesDoEvento(esp.semente, 0);
    S.votarEvento(wa, ana, { i: 1 }); S.votarEvento(wb, beto, { i: 1 });
    await esp.gravando;
    assert.ok(!esp.janela && esp.rodadaSync === 2, 'todos votaram: a janela fecha antes dos 10 s');
    assert.equal(A.st.agenda.find((e) => e.rodada === 3).tipo, opB.tipo);
    assert.equal(B.st.agenda.find((e) => e.rodada === 3).tipo, opB.tipo);
    assert.match(A.st.avisos.map((a) => a.texto).join('|'), /Na próxima rodada: /, 'o evento é anunciado na rodada 2');
    const [ev] = await rows('SELECT tipo, origem FROM eventos_sala WHERE sala_codigo = $1 AND rodada = 3', [esp.codigo]);
    assert.deepEqual([ev.tipo, ev.origem], [opB.tipo, 'votacao']);

    for (const k of [2, 3, 4]) {
      await ajudam();
      if (esp.voto) { S.votarEvento(wa, ana, { i: 0 }); S.votarEvento(wb, beto, { i: 0 }); }
    }
    await ajudam(); // fecha a rodada 5: abre o leilão (o canivete é na rodada 6)
    assert.ok(esp.leilao, 'leilão aberto antes da rodada 6');
    A.st.saldo = 60; B.st.saldo = 50;
    B.st.skip = 1; // vai perder a rodada 6, que deve passar sozinha
    S.darLance(wa, ana, { valor: 40 });
    S.darLance(wb, beto, { valor: 40 }); // empate: ganha quem tem menos saldo (Beto, 50 BC)
    await esp.gravando;
    assert.ok(!esp.leilao, 'todos deram lance: o leilão fecha');
    assert.equal(A.st.canivete || B.st.canivete, true);
    const dono = B.st.canivete ? B : A;
    const [lance] = await rows('SELECT valor_bc, ganhou FROM lances WHERE sala_codigo = $1 AND ganhou', [esp.codigo]);
    assert.ok(lance, 'o lance vencedor foi gravado');
    const [mv] = await rows("SELECT tipo, valor_bc FROM movimentos WHERE participacao_id = $1 AND tipo = 'leilao'", [dono.partId]);
    assert.equal(mv.valor_bc, -lance.valor_bc);
    assert.equal(esp.rodadaSync, 6);
    assert.equal(dono, B, 'no empate ganha quem tem menos saldo');
    assert.equal(B.st.feito, true, 'a rodada perdida de Beto passou sozinha');
    assert.equal(B.st.stats.perdidas, 1);
    assert.equal(wa.ultimo('estado').sala.pendentes.includes('Beto'), false);
    console.log('sala de espera ok');
  } finally {
    await pool.query('DELETE FROM salas WHERE codigo = $1', [esp.codigo]);
  }
  console.log('INTEGRAÇÃO OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await pool.query('DELETE FROM salas WHERE codigo = $1', [sala.codigo]);
  await pool.query('DELETE FROM jogadores WHERE id = ANY($1)', [[ana.id, beto.id]]);
  await pool.end();
  process.exit(process.exitCode ?? 0); // os timers das salas manteriam o processo vivo
}
