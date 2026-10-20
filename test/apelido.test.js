import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparApelido, apelidoProibido } from '../server/apelido.js';

test('limpeza tira símbolos, junta espaços e corta em 20', () => {
  assert.equal(limparApelido('  Lobo   <b>Veloz</b>!! '), 'Lobo bVelozb');
  assert.equal(limparApelido('a'.repeat(30)).length, 20);
});

test('apelidos comuns passam', () => {
  for (const a of ['Lobo Veloz', 'Ana', 'Paulo', 'Cunha', 'Escudo', 'Disputa', 'Computador', 'Viaduto', 'Boston', 'Porangatu',
    'Deputado', 'Cuca', 'Pinto', 'Macaco Prego', 'Raposa_2014', 'Coruja.Sabia']) {
    assert.equal(apelidoProibido(a), false, a);
  }
});

test('palavrões e variações são recusados', () => {
  for (const a of ['merda', 'MERDA', 'Mérda', 'm3rd4', 'm.e.r.d.a', 'm e r d a', 'porrrrra', 'Lobo Caralho', 'cu', 'cuuu', 'Cu Doce',
    'puta', 'PUTA da trilha', 'fdp', 'bosta123', 'idiota', 'Hitler', 'f0da']) {
    assert.equal(apelidoProibido(a), true, a);
  }
});
