import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALAVRAS } from '../server/palavras.js';
import { normalizarPalavras, novasPalavras } from '../server/conta.js';
import { modoEmail, enviarCodigo, codigoDeTeste } from '../server/email.js';

test('a lista do código de recuperação tem 256 palavras simples e únicas', () => {
  assert.equal(PALAVRAS.length, 256);
  assert.equal(new Set(PALAVRAS).size, 256);
  for (const p of PALAVRAS) assert.match(p, /^[a-z]{3,11}$/, p);
});

test('o código de recuperação são 6 palavras da lista', () => {
  for (let i = 0; i < 50; i++) {
    const c = novasPalavras();
    assert.equal(c.length, 6);
    assert.ok(c.every((p) => PALAVRAS.includes(p)));
  }
  assert.notDeepEqual(novasPalavras(), novasPalavras());
});

test('as palavras são lidas sem acento, maiúscula ou pontuação, e só valem 6 da lista', () => {
  const c = ['onca', 'lobo', 'coruja', 'raposa', 'tucano', 'arara'];
  assert.deepEqual(normalizarPalavras('onca lobo coruja raposa tucano arara'), c);
  assert.deepEqual(normalizarPalavras('  Onça, LOBO - coruja\nraposa;tucano  arara. '), c);
  assert.equal(normalizarPalavras('onca lobo coruja raposa tucano'), null, 'faltou uma');
  assert.equal(normalizarPalavras('onca lobo coruja raposa tucano arara onca'), null, 'sobrou uma');
  assert.equal(normalizarPalavras('onca lobo coruja raposa tucano zzzzzz'), null, 'palavra fora da lista');
  assert.equal(normalizarPalavras(null), null);
  assert.equal(normalizarPalavras(123456), null);
});

test('e-mail: desligado sem configuração, e nunca envia de verdade nos testes', async () => {
  const antes = { ...process.env };
  try {
    delete process.env.EMAIL_MODO; delete process.env.SMTP_URL;
    assert.equal(modoEmail(), 'desligado');
    await assert.rejects(() => enviarCodigo('a@b.com', '123456'), /não está configurado/);
    process.env.SMTP_URL = 'smtp://x';
    assert.equal(modoEmail(), 'smtp');
    process.env.EMAIL_MODO = 'teste';
    await enviarCodigo('a@b.com', '654321');
    assert.equal(codigoDeTeste('a@b.com'), '654321');
    process.env.EMAIL_MODO = 'log';
    const linhas = [];
    await enviarCodigo('c@d.com', '111111', { info: (m) => linhas.push(m) });
    assert.match(linhas[0], /111111/);
    assert.equal(codigoDeTeste('c@d.com'), undefined, 'o código de teste só existe no modo teste');
  } finally {
    for (const k of ['EMAIL_MODO', 'SMTP_URL']) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
});
