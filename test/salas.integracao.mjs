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
  console.log('INTEGRAÇÃO OK');
} finally {
  await pool.query('DELETE FROM salas WHERE codigo = $1', [sala.codigo]);
  await pool.query('DELETE FROM jogadores WHERE id = ANY($1)', [[ana.id, beto.id]]);
  await pool.end();
}
