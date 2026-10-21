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
  assert.deepEqual(E.pontuacao(st), { itens: 70, kitCompleto: 20, cartas: 30, saldo: 4, meta: 0, total: 124 });
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

// ---------- Etapa 1 ----------
const sala = (...nomes) => {
  const ctx = E.novoContexto({});
  nomes.forEach((n, i) => ctx.estados.set(n, E.novoJogador({ apelido: n, ficha: 'f01', seed: 5, ordem: i, sala: true })));
  return ctx;
};

test('B1: dado duplo custa 5 BC, rola dois dados e deixa escolher um', () => {
  const st = E.novoJogador({ apelido: 'Ana', ficha: 'f01', seed: 1 });
  assert.ok(E.dadoDuplo(st, seq(dado(2), dado(5))).ok);
  assert.equal(st.saldo, 95);
  assert.deepEqual(st.pend, { tipo: 'dado', dados: [2, 5] });
  assert.equal(st.extrato.at(-1).v, -5);
  assert.equal(st.saida.find((s) => s.k === 'mov').tipo, 'dado_duplo');
  assert.match(E.escolherDado(st, 2).erro, /um dos dois/);
  E.escolherDado(st, 1, seq(0.5));
  assert.equal(st.pos, 5);
  assert.equal(st.dado, 5);
  assert.equal(st.saida.at(-1).rolagem, 'duplo');
  assert.match(E.rolar(st).erro, /já jogou/);
});

test('B1: dado duplo recusado sem 5 BC e parado só passa a rodada', () => {
  const st = E.novoJogador({ apelido: 'Bia', ficha: 'f01', seed: 1 });
  st.saldo = 4;
  assert.match(E.dadoDuplo(st).erro, /custa 5 BC/);
  assert.equal(st.rolou, false);
  st.saldo = 100; st.skip = 1;
  assert.deepEqual(E.opcoesDaRodada(st), { rolar: true, duplo: false, ajudar: false });
  assert.match(E.ajudar(st).erro, /parado/);
});

test('B1: ajudar no acampamento não anda e ganha 15 BC, mas respeita o teto', () => {
  const st = E.novoJogador({ apelido: 'Caio', ficha: 'f01', seed: 1 });
  assert.ok(E.ajudar(st).ok);
  assert.equal(st.saldo, 115);
  assert.equal(st.pos, 0);
  assert.ok(st.feito);
  assert.equal(st.stats.ajudas, 1);
  const cheio = E.novoJogador({ apelido: 'Duda', ficha: 'f01', seed: 1 });
  cheio.saldo = 290;
  assert.match(E.ajudar(cheio).erro, /300 BC/);
  assert.equal(E.opcoesDaRodada(cheio).ajudar, false);
});

test('B2: no Perdido, arriscar de 4 a 6 é de graça e de 1 a 3 perde a rodada', () => {
  const novo = () => { const st = E.novoJogador({ apelido: 'Edu', ficha: 'f01', seed: 1 }); st.pos = 4; E.rolar(st, seq(dado(1))); return st; };
  const a = novo();
  assert.equal(a.pend.tipo, 'perdido');
  E.arriscar(a, seq(dado(4)));
  assert.equal(a.skip, 0);
  assert.equal(a.saldo, 100);
  const b = novo();
  E.arriscar(b, seq(dado(3)));
  assert.equal(b.skip, 1);
  assert.equal(b.saldo, 100);
});

test('B4: acertar Tempestade evita o revés e toda carta certa vale 10 pts', () => {
  const novo = () => { const st = E.novoJogador({ apelido: 'Fê', ficha: 'f01', seed: 1 }); st.pos = 3; return st; };
  const certa = (st) => E.cartaMostrada(st, st.pend.carta).certa;
  const a = novo();
  E.rolar(a, seq(dado(1), 0.5)); // casa 4 = Tempestade; 0.5 sorteia a "Ponte quebrada" (8 BC)
  assert.equal(E.cartaPorId(a.pend.carta).tipo, 'tempestade');
  E.responder(a, certa(a));
  assert.equal(a.saldo, 100);
  assert.equal(a.resposta.evitou, true);
  assert.equal(E.pontuacao(a).cartas, 10);
  const b = novo();
  E.rolar(b, seq(dado(1), 0.5));
  const pior = [0, 1, 2].find((i) => i !== certa(b));
  E.responder(b, pior);
  assert.ok(b.saldo < 100 || b.skip > 0 || b.pos !== 4, 'o revés acontece quando erra');
  const c = E.novoJogador({ apelido: 'Gi', ficha: 'f01', seed: 1 });
  E.rolar(c, seq(dado(2), 0.5)); // Bússola: acertar não muda o efeito
  E.responder(c, E.cartaMostrada(c, c.pend.carta).certa);
  assert.equal(c.resposta.evitou, false);
});

test('F1: as opções são embaralhadas pela semente, iguais para a sala toda', () => {
  assert.deepEqual(E.ordemOpcoes(42, 'vovo'), E.ordemOpcoes(42, 'vovo'));
  for (const c of E.CARTAS) {
    const ordem = E.ordemOpcoes(7, c.id);
    assert.deepEqual([...ordem].sort(), [0, 1, 2]);
    const m = E.cartaMostrada({ seed: 7 }, c.id);
    assert.equal(m.opcoes[m.certa], c.opcoes[c.certa], 'a certa continua sendo a mesma resposta');
  }
  const posicoes = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const c of E.CARTAS) posicoes.add(E.cartaMostrada({ seed }, c.id).certa);
  assert.deepEqual([...posicoes].sort(), [0, 1, 2], 'a resposta certa aparece nas 3 posições');
});

test('B3: 12 metas, uma por jogador da sala, e a meta só pontua no fim', () => {
  assert.equal(E.METAS.length, 12);
  const ids = new Set(Array.from({ length: 12 }, (_, i) => E.metaDoJogador(99, i)));
  assert.equal(ids.size, 12);
  const st = E.novoJogador({ apelido: 'Hugo', ficha: 'f01', seed: 1 });
  st.meta = 'poupador'; st.saldo = 90;
  assert.equal(E.metaCumprida(st), true);
  assert.equal(E.pontuacao(st).meta, 0, 'em andamento não entrega a meta');
  st.fim = true;
  assert.equal(E.pontuacao(st).meta, 15);
  st.meta = 'piso'; st.stats.minSaldo = 19;
  assert.equal(E.pontuacao(st).meta, 0);
});

test('metas: lanterna antes da rodada 6 e recusas contadas', () => {
  const st = E.novoJogador({ apelido: 'Ivo', ficha: 'f01', seed: 1 });
  st.meta = 'lanterna';
  st.pos = 2;
  E.rolar(st, seq(dado(1))); // casa 3 = Loja do Explorador
  E.comprar(st, ['lanterna']);
  assert.equal(st.stats.lanterna, 1);
  assert.equal(E.metaCumprida(st), true);
  st.pend = { tipo: 'loja', loja: 'exp' }; st.saldo = 1;
  E.comprar(st, ['mapa']);
  assert.equal(st.stats.recusas, 1);
});

test('A1: o guardião da ponte ganha 3 BC e o pedágio vai para o caixa do evento', () => {
  const ctx = sala('Ana', 'Beto');
  const ana = ctx.estados.get('Ana'), beto = ctx.estados.get('Beto');
  ana.pos = 7; beto.pos = 7;
  assert.ok(E.agirNaSala(ctx, 'Ana', { t: 'rolar' }, seq(dado(1), 0.0)).ok); // pedágio de 2 BC
  assert.equal(ctx.pontes[8], 'Ana');
  assert.equal(ana.pend.guardiao, null);
  E.agirNaSala(ctx, 'Ana', { t: 'pagar' });
  assert.equal(ana.saldo, 98);
  const r = E.agirNaSala(ctx, 'Beto', { t: 'rolar' }, seq(dado(1), 0.99)); // pedágio de 12 BC
  assert.equal(beto.pend.guardiao, 'Ana');
  assert.equal(ctx.pontes[8], 'Beto', 'quem para na ponte assume');
  assert.deepEqual(r.afetados, ['Beto']);
  const p = E.agirNaSala(ctx, 'Beto', { t: 'pagar' });
  assert.equal(beto.saldo, 88);
  assert.equal(ana.saldo, 101);
  assert.deepEqual(p.afetados.sort(), ['Ana', 'Beto']);
  assert.equal(ana.saida.at(-1).tipo, 'gratificacao');
  assert.ok(ana.cena.some((c) => c.t === 'gratificacao'));
});

test('A1: gratificação acima de 300 BC é recusada e pedágio recusado não paga ninguém', () => {
  const ctx = sala('Ana', 'Beto');
  const ana = ctx.estados.get('Ana'), beto = ctx.estados.get('Beto');
  ctx.pontes[8] = 'Ana';
  ana.saldo = 299; beto.pos = 7;
  E.agirNaSala(ctx, 'Beto', { t: 'rolar' }, seq(dado(1), 0.5));
  E.agirNaSala(ctx, 'Beto', { t: 'pagar' });
  assert.equal(ana.saldo, 299);
  assert.match(ana.avisos.at(-1).texto, /recusado/);
  const c2 = sala('Ana', 'Beto');
  c2.pontes[8] = 'Ana';
  c2.estados.get('Beto').pos = 7; c2.estados.get('Beto').saldo = 1;
  E.agirNaSala(c2, 'Beto', { t: 'rolar' }, seq(dado(1), 0.99));
  E.agirNaSala(c2, 'Beto', { t: 'pagar' });
  assert.equal(c2.estados.get('Ana').saldo, 100);
  assert.equal(c2.estados.get('Beto').skip, 1);
});

test('A2: carta de sala atinge a sala toda e quem tirou ganha 5 BC', () => {
  const ctx = sala('Ana', 'Beto', 'Caio');
  const [ana, beto, caio] = ['Ana', 'Beto', 'Caio'].map((n) => ctx.estados.get(n));
  beto.kit = ['lona'];
  ana.pend = { tipo: 'carta', carta: 'salachuva' }; ana.rolou = true;
  const certa = E.cartaMostrada(ana, 'salachuva').certa;
  const errada = [0, 1, 2].find((i) => i !== certa);
  const r = E.agirNaSala(ctx, 'Ana', { t: 'responder', i: errada });
  assert.equal(ana.saldo, 100, 'quem errou paga 5 BC (sem Lona) e ganha 5 BC por tirar a carta');
  assert.equal(beto.saldo, 100, 'Beto tem Lona');
  assert.equal(caio.saldo, 95);
  assert.deepEqual(r.afetados.sort(), ['Ana', 'Beto', 'Caio']);
  assert.match(caio.avisos.find((a) => /Chuva no acampamento/.test(a.texto)).texto, /Ana tirou/);
});

test('A2: acertar a pergunta de uma carta de sala de Tempestade poupa só quem tirou', () => {
  const ctx = sala('Ana', 'Beto');
  const ana = ctx.estados.get('Ana'), beto = ctx.estados.get('Beto');
  ana.pend = { tipo: 'carta', carta: 'salaventania' }; ana.rolou = true;
  E.agirNaSala(ctx, 'Ana', { t: 'responder', i: E.cartaMostrada(ana, 'salaventania').certa });
  assert.equal(ana.saldo, 105, 'poupada do revés e com o prêmio');
  assert.equal(beto.saldo, 95);
  const mutirao = sala('Ana', 'Beto');
  const a2 = mutirao.estados.get('Ana');
  a2.pend = { tipo: 'carta', carta: 'salamutirao' }; a2.rolou = true;
  E.agirNaSala(mutirao, 'Ana', { t: 'responder', i: E.cartaMostrada(a2, 'salamutirao').certa });
  assert.equal(a2.saldo, 115);
  assert.equal(mutirao.estados.get('Beto').saldo, 110);
});

test('A2: carta de sala não sai no jogo sozinho e a recusa de quem não tirou não tira a vez dele', () => {
  const solo = E.novoJogador({ apelido: 'Duda', ficha: 'f01', seed: 1 });
  assert.ok(E.baralho(solo, 'tempestade').every((c) => !c.sala));
  assert.ok(E.baralho({ ...solo, sala: true }, 'tempestade').some((c) => c.sala));
  const ctx = sala('Ana', 'Beto');
  const beto = ctx.estados.get('Beto'); beto.saldo = 2;
  const ana = ctx.estados.get('Ana');
  ana.pend = { tipo: 'carta', carta: 'salachuva' }; ana.rolou = true;
  E.agirNaSala(ctx, 'Ana', { t: 'responder', i: (E.cartaMostrada(ana, 'salachuva').certa + 1) % 3 });
  assert.equal(beto.saldo, 2);
  assert.equal(beto.skip, 0);
  assert.equal(beto.stats.recusas, 1);
});

test('tempo esgotado joga todas as pendências, inclusive dado duplo e Perdido sem saldo', () => {
  const st = E.novoJogador({ apelido: 'Joel', ficha: 'f01', seed: 1 });
  st.rolou = true; st.pend = { tipo: 'dado', dados: [1, 2] };
  E.tempoEsgotado(st, seq(0.5));
  assert.equal(st.pend, null);
  assert.ok(st.feito);
  const p = E.novoJogador({ apelido: 'Kel', ficha: 'f01', seed: 1 });
  p.rolou = true; p.saldo = 3; p.pend = { tipo: 'perdido', valor: 10 };
  E.tempoEsgotado(p, seq(dado(2)));
  assert.equal(p.skip, 1);
});
