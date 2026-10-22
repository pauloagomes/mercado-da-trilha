import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { RIVAIS, ESTRATEGIAS, novoJogoSolo, jogarRodadaBot, rivaisJogam } from '../public/js/rivais.js';

// O jogador "eu" joga com a estratégia do comprador, e depois de cada rodada os rivais o alcançam,
// do mesmo jeito que o jogo sozinho faz na tela.
function partidaSolo(seed) {
  const rng = E.rngComSemente(seed);
  const ctx = novoJogoSolo({ apelido: 'Eu', ficha: 'f01', rodadas: 12, seed });
  const eu = ctx.estados.get('eu');
  for (let i = 0; i < 40 && !eu.fim; i++) {
    jogarRodadaBot(ctx, 'eu', ESTRATEGIAS.comprador, rng);
    E.fecharRodada(eu);
    E.passarRodadasPerdidas(eu);
    rivaisJogam(ctx, rng);
  }
  return ctx;
}

test('A6: o jogo sozinho tem 3 rivais com apelido, ficha e estratégia fixos', () => {
  assert.equal(RIVAIS.length, 3);
  assert.equal(new Set(RIVAIS.map((r) => r.apelido)).size, 3);
  assert.equal(new Set(RIVAIS.map((r) => r.ficha)).size, 3);
  for (const r of RIVAIS) assert.ok(ESTRATEGIAS[r.estrategia]);
  const ctx = novoJogoSolo({ apelido: 'Eu', ficha: 'f01', rodadas: 8, seed: 4 });
  assert.deepEqual([...ctx.estados.keys()], ['eu', 'r1', 'r2', 'r3']);
  assert.ok(ctx.pontes && typeof ctx.pontes === 'object', 'as pontes funcionam também no solo');
  assert.equal(new Set([...ctx.estados.values()].map((s) => s.meta)).size, 4, 'cada um com uma meta');
});

test('A6: os rivais terminam junto e o saldo nunca sai de 0 a 300 BC', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const ctx = partidaSolo(seed);
    for (const [id, st] of ctx.estados) {
      assert.ok(st.fim, `${id} não terminou na partida ${seed}`);
      assert.equal(st.rodada, 12, `${id} rodada ${st.rodada}`);
      assert.ok(st.saldo >= 0 && st.saldo <= E.SALDO_MAX, `${id} saldo ${st.saldo}`);
    }
  }
});

test('A6: guardião da ponte e cartas de sala funcionam sem internet', () => {
  let gratificacoes = 0, cartasDeSala = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const ctx = partidaSolo(seed);
    for (const st of ctx.estados.values()) {
      gratificacoes += st.stats.gratificacoes;
      cartasDeSala += st.sacadas.filter((id) => E.cartaPorId(id).sala).length;
    }
  }
  assert.ok(gratificacoes > 50, `${gratificacoes} gratificações em 100 partidas`);
  assert.ok(cartasDeSala > 100, `${cartasDeSala} cartas de sala em 100 partidas`);
});

test('A6: as estratégias jogam de jeitos diferentes', () => {
  const resumo = { r1: [], r2: [], r3: [] };
  for (let seed = 1; seed <= 150; seed++) {
    const ctx = partidaSolo(seed);
    for (const id of Object.keys(resumo)) resumo[id].push(ctx.estados.get(id));
  }
  const media = (id, f) => resumo[id].reduce((s, st) => s + f(st), 0) / resumo[id].length;
  assert.ok(media('r3', (s) => s.kit.length) > media('r1', (s) => s.kit.length), 'o comprador leva mais itens que o apressado');
  assert.ok(media('r2', (s) => s.saldo) > media('r3', (s) => s.saldo), 'o poupador termina com mais saldo que o comprador');
  assert.ok(media('r3', (s) => s.stats.duplos) > 2, 'o comprador usa o dado duplo');
  assert.equal(media('r1', (s) => s.stats.duplos), 0, 'o apressado nunca usa');
});
