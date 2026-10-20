import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const dado = (n) => (n - 1) / 6 + 0.01; // valor do rng que faz o dado dar n

test('tabuleiro tem 20 casas com as quantidades do plano', () => {
  const c = (k) => E.TABULEIRO.filter((x) => x === k).length;
  assert.equal(E.TABULEIRO.length, 20);
  assert.deepEqual(
    [c('partida'), c('agencia'), c('util'), c('exp'), c('enf'), c('pedagio'), c('bussola'), c('tempestade'), c('perdido'), c('fogo')],
    [1, 2, 3, 3, 2, 2, 2, 3, 1, 1],
  );
  assert.equal(E.CARTAS.length, 11);
  assert.equal(E.ITENS.reduce((s, i) => s + i.preco, 0), 140);
  assert.equal(E.FICHAS.length, 12);
});

test('compra na loja debita, gera aviso e entra no kit', () => {
  const st = E.novoJogador({ apelido: 'Ana', ficha: 'f01', rodadas: 12, seed: 7 });
  E.rolar(st, seq(dado(1))); // casa 1 = Loja de utilidades
  assert.equal(st.pend.tipo, 'loja');
  const r = E.comprar(st, ['corda', 'panela']);
  assert.ok(r.ok);
  assert.equal(st.saldo, 65);
  assert.deepEqual(st.kit, ['corda', 'panela']);
  assert.equal(st.avisos.at(-1).tipo, 'gasto');
  assert.ok(E.fecharRodada(st));
  assert.equal(st.rodada, 1);
});

test('saldo insuficiente recusa a compra e mantém a loja aberta', () => {
  const st = E.novoJogador({ apelido: 'Bia', ficha: 'f02', seed: 1 });
  st.saldo = 10;
  E.rolar(st, seq(dado(1)));
  const r = E.comprar(st, ['lona']);
  assert.match(r.erro, /recusada/);
  assert.equal(st.pend.tipo, 'loja');
  assert.equal(st.saldo, 10);
});

test('saldo máximo de 300 BC recusa crédito inteiro', () => {
  const st = E.novoJogador({ apelido: 'Caio', ficha: 'f03', seed: 1 });
  st.saldo = 280;
  assert.equal(E.creditar(st, 30, 'teste'), false);
  assert.equal(st.saldo, 280);
  assert.equal(E.creditar(st, 20, 'teste'), true);
  assert.equal(st.saldo, 300);
});

test('passar pela Partida dá mesada', () => {
  const st = E.novoJogador({ apelido: 'Duda', ficha: 'f04', seed: 1 });
  st.pos = 18;
  E.rolar(st, seq(dado(3), 0.5)); // 18 -> 19 -> 0 -> 1
  assert.equal(st.pos, 1);
  assert.equal(st.saldo, 130);
});

test('saldo zerado: continua jogando até o fim', () => {
  const st = E.novoJogador({ apelido: 'Edu', ficha: 'f05', rodadas: 8, seed: 3 });
  st.saldo = 0;
  let rodadas = 0;
  const rng = seq(0.3, 0.7, 0.1, 0.9, 0.5);
  while (!st.fim && rodadas < 50) {
    E.rolar(st, rng);
    E.tempoEsgotado(st, rng);
    E.fecharRodada(st);
    rodadas++;
  }
  assert.ok(st.fim);
  assert.equal(st.rodada, 8);
});

test('tempo esgotado: carta conta como errada e loja sai sem comprar', () => {
  const st = E.novoJogador({ apelido: 'Fê', ficha: 'f06', seed: 1 });
  E.rolar(st, seq(dado(2), 0)); // casa 2 = Bússola
  assert.equal(st.pend.tipo, 'carta');
  E.tempoEsgotado(st);
  assert.equal(st.resposta.ok, false);
  assert.ok(st.feito);
});

test('pontuação e desempate', () => {
  const st = E.novoJogador({ apelido: 'Gil', ficha: 'f07', seed: 1 });
  st.kit = E.ITENS.map((i) => i.id); st.acertos = 3; st.saldo = 45;
  assert.deepEqual(E.pontuacao(st), { itens: 70, kitCompleto: 20, cartas: 15, saldo: 4, total: 109 });
  const lista = [{ pontos: 50, saldo: 10, acertos: 1 }, { pontos: 50, saldo: 30, acertos: 0 }, { pontos: 60, saldo: 0, acertos: 0 }];
  lista.sort(E.compararPlacar);
  assert.deepEqual(lista.map((x) => x.pontos + '/' + x.saldo), ['60/0', '50/30', '50/10']);
});

test('eventos são iguais para a mesma semente', () => {
  assert.deepEqual(E.eventosDaPartida(42, 12), E.eventosDaPartida(42, 12));
  const ev = E.eventosDaPartida(42, 12);
  assert.equal(ev.fechada.rodada, 4);
  assert.equal(ev.feira.rodada, 8);
});

test('pedágio sem saldo faz perder a próxima rodada', () => {
  const st = E.novoJogador({ apelido: 'Hugo', ficha: 'f08', seed: 1 });
  st.pos = 7; st.saldo = 1;
  E.rolar(st, seq(dado(1), 0.99)); // casa 8 = pedágio, valor 12
  assert.equal(st.pend.tipo, 'pedagio');
  E.pagar(st);
  assert.equal(st.skip, 1);
  E.fecharRodada(st);
  E.rolar(st);
  assert.equal(st.dado, null);
  assert.equal(st.skip, 0);
});
