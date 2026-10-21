// Faixas-alvo de balanceamento (RFC "Mercado da Trilha mais divertido e interativo").
// Cada etapa só fecha com esta simulação verde. `ETAPA` guarda a faixa da etapa atual;
// `LANCAMENTO` é a meta do RFC para ir ao ar, que as etapas seguintes precisam alcançar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { ETAPA, FAIXAS, medirSolo, medirMesa, REFERENCIA, ESPERTO, SEM_ESCOLHAS, CUIDADOSO, SO_AJUDA, jogarPartida } from './sim.js';

const N = Number(process.env.SIM_PARTIDAS) || 1500;

let medidas;
function medir() {
  if (medidas) return medidas;
  const solo = medirSolo(E, { n: N, politica: REFERENCIA });
  const mesa = medirMesa(E, { n: N, base: REFERENCIA });
  const antes = medirSolo(E, { n: N, politica: SEM_ESCOLHAS });
  medidas = { solo, mesa, antes, todas: { semEscolha: solo.semEscolha, venceQuemSabe: mesa.venceQuemSabe, recusou: solo.recusou } };
  return medidas;
}

for (const [chave, f] of Object.entries(FAIXAS)) {
  test(`simulação (etapa ${ETAPA}): ${f.rotulo}`, () => {
    const v = medir().todas[chave], [min, max] = f.etapa;
    assert.ok(v >= min && v <= max, `${f.rotulo}: ${v.toFixed(3)} fora de ${min} a ${max} (meta de lançamento: ${f.lancamento.join(' a ')})`);
  });
}

test('simulação: o dado duplo compensa para quem escolhe bem, mas não é obrigatório', () => {
  const { solo, antes } = medir();
  const bom = medirSolo(E, { n: N, politica: ESPERTO });
  const ganhoBom = bom.pontos - antes.pontos, ganhoSimples = solo.pontos - antes.pontos;
  assert.ok(ganhoBom > 0 && ganhoBom <= 8, `escolhendo bem, o dado duplo rende ${ganhoBom.toFixed(1)} pts por partida (esperado de 0 a 8)`);
  assert.ok(ganhoSimples >= -8, `escolhendo só pela loja, o dado duplo custa ${ganhoSimples.toFixed(1)} pts (esperado de -8 a 8)`);
  assert.ok(solo.duplos >= 3 && solo.duplos <= 9, `${solo.duplos.toFixed(1)} dados duplos por partida`);
});

test('simulação: o kit completo continua possível e não é garantido', () => {
  const { solo } = medir();
  assert.ok(solo.kitCompleto >= 0.3 && solo.kitCompleto <= 0.7, `kit completo em ${(solo.kitCompleto * 100).toFixed(0)}% das partidas`);
});

test('simulação: "Ajudar no acampamento" não vira a melhor jogada', () => {
  const soAjuda = medirSolo(E, { n: Math.min(N, 600), politica: SO_AJUDA });
  const cuidadoso = medirSolo(E, { n: Math.min(N, 600), politica: CUIDADOSO });
  const { solo } = medir();
  assert.ok(soAjuda.pontos < solo.pontos - 20, `só ajudar faz ${soAjuda.pontos.toFixed(0)} pts contra ${solo.pontos.toFixed(0)}`);
  assert.ok(cuidadoso.pontos - solo.pontos <= 6, `ajudar quando o saldo baixa rende ${(cuidadoso.pontos - solo.pontos).toFixed(1)} pts a mais`);
});

test('simulação: a mesma semente dá a mesma partida', () => {
  const a = jogarPartida(E, [REFERENCIA, REFERENCIA], { seed: 123 }).map((j) => [j.pontos.total, j.st.saldo]);
  const b = jogarPartida(E, [REFERENCIA, REFERENCIA], { seed: 123 }).map((j) => [j.pontos.total, j.st.saldo]);
  assert.deepEqual(a, b);
});

test('simulação: toda partida termina e o saldo nunca sai de 0 a 300 BC', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const j of jogarPartida(E, [REFERENCIA, CUIDADOSO, REFERENCIA], { seed })) {
      assert.ok(j.st.fim, `partida ${seed} não terminou`);
      assert.ok(j.st.saldo >= 0 && j.st.saldo <= E.SALDO_MAX, `saldo ${j.st.saldo} fora da faixa na partida ${seed}`);
    }
  }
});
