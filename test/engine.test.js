import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const dado = (n) => (n - 1) / 6 + 0.01; // valor do rng que faz o dado dar n

test('tabuleiro tem 20 casas com as quantidades do plano', () => {
  const c = (k) => E.TABULEIRO.filter((x) => x === k).length;
  assert.equal(E.TABULEIRO.length, 20);
  assert.deepEqual(
    [c('partida'), c('agencia'), c('util'), c('exp'), c('enf'), c('pedagio'), c('bussola'), c('tempestade'), c('perdido'), c('fogo'), c('troca')],
    [1, 1, 3, 3, 2, 2, 2, 3, 1, 1, 1],
  );
  assert.equal(E.CARTAS.length + E.CARTAS_SALA.length, 36);
  assert.equal(E.CARTAS.length, 24);
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
  assert.deepEqual(E.pontuacao(st), { itens: 70, kitCompleto: 20, cartas: 30, saldo: 4, meta: 0, canivete: 0, missao: 0, total: 124 });
  const lista = [{ pontos: 50, saldo: 10, acertos: 1 }, { pontos: 50, saldo: 30, acertos: 0 }, { pontos: 60, saldo: 0, acertos: 0 }];
  lista.sort(E.compararPlacar);
  assert.deepEqual(lista.map((x) => x.pontos + '/' + x.saldo), ['60/0', '50/30', '50/10']);
});

test('eventos são iguais para a mesma semente e vêm a cada 3 rodadas', () => {
  assert.deepEqual(E.agendaDaPartida(42, 12), E.agendaDaPartida(42, 12));
  assert.deepEqual(E.agendaDaPartida(42, 12).map((e) => e.rodada), [3, 6, 9, 12]);
  assert.deepEqual(E.agendaDaPartida(42, 8).map((e) => e.rodada), [3, 6]);
  assert.deepEqual(E.agendaDaPartida(42, 16).map((e) => e.rodada), [3, 6, 9, 12, 15]);
  for (const e of E.agendaDaPartida(7, 12)) assert.ok(E.EVENTOS[e.tipo]);
  assert.equal(new Set(E.agendaDaPartida(7, 12).map((e) => e.tipo)).size, 4, 'sem repetir evento na partida');
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

test('B1: dado duplo nunca tira dois números iguais', () => {
  // O segundo dado sorteia entre as 5 faces que sobram: 0 a 4 viram 1, 2, 4, 5, 6 quando o primeiro é 3.
  const quinto = (k) => k / 5 + 0.01;
  const faces = [0, 1, 2, 3, 4].map((k) => {
    const st = E.novoJogador({ apelido: 'Ana', ficha: 'f01', seed: 1 });
    assert.ok(E.dadoDuplo(st, seq(dado(3), quinto(k))).ok);
    return st.pend.dados;
  });
  assert.deepEqual(faces, [[3, 1], [3, 2], [3, 4], [3, 5], [3, 6]]);
  // Mesmo com um gerador que sempre devolve o mesmo valor, termina e os dados saem diferentes.
  const st = E.novoJogador({ apelido: 'Bia', ficha: 'f01', seed: 1 });
  assert.ok(E.dadoDuplo(st, () => 0.5).ok);
  assert.notEqual(st.pend.dados[0], st.pend.dados[1]);
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
  a.baralho.tempestade.unshift('ponte');
  E.rolar(a, seq(dado(1), 0.5)); // casa 4 = Tempestade; sai a "Ponte quebrada" (8 BC)
  assert.equal(E.cartaPorId(a.pend.carta).tipo, 'tempestade');
  E.responder(a, certa(a));
  assert.equal(a.saldo, 100);
  assert.equal(a.resposta.evitou, true);
  assert.equal(E.pontuacao(a).cartas, 10);
  const b = novo();
  b.baralho.tempestade.unshift('ponte');
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

// ---------- Etapa 2 ----------
const jogo = (extra = {}) => Object.assign(E.novoJogador({ apelido: 'Lia', ficha: 'f01', rodadas: 12, seed: 3 }), extra);
const avancar = (st, ate) => { while (E.rodadaAtual(st) < ate) { st.feito = true; E.fecharRodada(st); } };
const avisos = (st) => st.avisos.map((a) => a.texto).join(' | ');

test('C1: o evento é anunciado uma rodada antes e vale na rodada dele', () => {
  const st = jogo({ agenda: [{ rodada: 3, tipo: 'feira', loja: 'exp' }] });
  avancar(st, 2);
  assert.match(avisos(st), /Na próxima rodada: Feira: Loja do Explorador/);
  assert.ok(st.cena.some((c) => c.t === 'anuncio' && c.tipo === 'feira'));
  assert.equal(E.descontoFeira(st, 'exp'), 0, 'ainda não começou');
  avancar(st, 3);
  assert.equal(E.descontoFeira(st, 'exp'), 5);
  assert.equal(E.descontoFeira(st, 'util'), 0);
  avancar(st, 4);
  assert.equal(E.descontoFeira(st, 'exp'), 5, 'a feira dura 2 rodadas');
  avancar(st, 5);
  assert.equal(E.descontoFeira(st, 'exp'), 0);
});

test('C2: queda de energia fecha a loja por 2 rodadas', () => {
  const st = jogo({ agenda: [{ rodada: 3, tipo: 'energia', loja: 'enf' }] });
  avancar(st, 3);
  assert.equal(E.lojaFechada(st, 'enf'), true);
  avancar(st, 5);
  assert.equal(E.lojaFechada(st, 'enf'), false);
});

test('F4: efeitos em BC dos eventos, com a proteção dos itens', () => {
  const roda = (tipo, extra = {}) => { const st = jogo({ agenda: [{ rodada: 3, tipo }], ...extra }); avancar(st, 3); return st; };
  assert.equal(roda('chuva').saldo, 95);
  assert.equal(roda('chuva', { kit: ['lona'] }).saldo, 100);
  assert.match(avisos(roda('chuva', { kit: ['lona'] })), /Lona protegeu/);
  assert.equal(roda('visita').saldo, 130);
  assert.equal(roda('visita', { saldo: 280 }).saldo, 280, 'a recarga que passaria de 300 BC é recusada inteira');
  assert.equal(roda('visita', { saldo: 280 }).stats.creditosRecusados, 1);
  assert.equal(roda('cantina').saldo, 92);
  assert.equal(roda('cantina', { kit: ['panela'] }).saldo, 100);
  assert.equal(roda('jogo').saldo, 95);
  assert.equal(roda('jogo', { kit: ['lanterna'] }).saldo, 100);
  assert.equal(roda('inspecao').saldo, 92);
  assert.equal(roda('inspecao', { kit: ['kitps'] }).saldo, 100);
  assert.equal(roda('mutirao').saldo, 110);
  const pobre = roda('inspecao', { saldo: 3 });
  assert.equal(pobre.saldo, 3);
  assert.equal(pobre.skip, 0, 'recusa por evento não tira a vez');
  assert.equal(pobre.stats.recusas, 1);
});

test('C4: nas últimas 3 rodadas créditos e cartas certas valem em dobro', () => {
  const st = jogo({ agenda: [] });
  avancar(st, 9);
  assert.equal(E.noite(st), false);
  E.creditar(st, 10, 'x');
  assert.equal(st.saldo, 110);
  avancar(st, 10);
  assert.equal(E.noite(st), true);
  assert.match(avisos(st), /Noite no acampamento/);
  E.creditar(st, 10, 'x');
  assert.equal(st.saldo, 130);
  st.pend = { tipo: 'carta', carta: 'contador' };
  E.responder(st, E.cartaMostrada(st, 'contador').certa);
  assert.equal(st.acertos, 1);
  assert.equal(st.acertosNoite, 1);
  assert.equal(E.pontuacao(st).cartas, 20);
  assert.equal(st.saldo, 150, 'o prêmio da carta também dobra');
});

test('B5: cada item protege de um revés', () => {
  const carta = (id, extra) => { const st = jogo(extra); st.rolou = true; st.pend = { tipo: 'carta', carta: id }; const m = E.cartaMostrada(st, id); E.responder(st, (m.certa + 1) % 3); return st; };
  assert.equal(carta('ponte', {}).saldo, 92);
  assert.equal(carta('ponte', { kit: ['corda'] }).saldo, 100);
  assert.equal(carta('lona', { kit: ['lona'] }).saldo, 100);
  assert.equal(carta('machucado', {}).saldo, 90);
  assert.equal(carta('machucado', { kit: ['kitps'] }).saldo, 100);
  const perdido = jogo({ kit: ['lanterna'], pos: 4 });
  E.rolar(perdido, seq(dado(1)));
  assert.equal(perdido.pend, null, 'com Lanterna não se perde na trilha');
  assert.ok(perdido.feito);
});

test('B5: a Bússola dá um dado duplo de graça, uma vez', () => {
  const st = jogo({ pos: 2 });
  E.rolar(st, seq(dado(1))); // Loja do Explorador
  E.comprar(st, ['bussola']);
  assert.equal(st.duploGratis, 1);
  E.fecharRodada(st);
  assert.equal(E.opcoesDaRodada(st).duplo, true);
  st.saldo = 2;
  assert.equal(E.opcoesDaRodada(st).duplo, true, 'mesmo sem 5 BC');
  const antes = st.saldo;
  assert.ok(E.dadoDuplo(st, seq(dado(1), dado(2))).ok);
  assert.equal(st.saldo, antes);
  assert.equal(st.duploGratis, 0);
  assert.equal(E.opcoesDaRodada(st).duplo, false);
});

test('C3: leilão com lance único e fechado, mínimo de 10 BC, desempate por menor saldo', () => {
  const lances = [{ id: 'a', valor: 20, saldo: 80, ordem: 0 }, { id: 'b', valor: 20, saldo: 50, ordem: 1 }, { id: 'c', valor: 30, saldo: 20, ordem: 2 }];
  assert.equal(E.resolverLeilao(lances).id, 'b', 'o lance de 30 BC é inválido: o saldo é 20 BC');
  assert.equal(E.resolverLeilao([{ id: 'a', valor: 0, saldo: 80, ordem: 0 }]), null, 'ninguém ofereceu');
  const st = jogo({ saldo: 60 });
  assert.equal(E.lanceValido(st, 40), true);
  assert.equal(E.lanceValido(jogo({ saldo: 35 }), 40), false);
  assert.equal(E.lanceValido(st, 25), false);
  assert.ok(E.vencerLeilao(st, 30));
  assert.equal(st.saldo, 30);
  assert.equal(st.saida.at(-1).tipo, 'leilao');
  st.fim = true;
  assert.equal(E.pontuacao(st).canivete, 15);
  assert.equal(E.rodadaDoLeilao(12), 6);
});

test('A5: o evento votado entra na agenda no lugar do sorteado', () => {
  const [a, b] = E.opcoesDoEvento(11, 1);
  assert.notEqual(a.tipo, b.tipo);
  const st = jogo({ seed: 11 });
  E.definirEvento(st, 6, b);
  assert.deepEqual(st.agenda.find((e) => e.rodada === 6), { rodada: 6, ...b });
});

test('C6: rodada perdida passa sozinha', () => {
  const st = jogo({ skip: 2 });
  st.feito = true; E.fecharRodada(st);
  E.passarRodadasPerdidas(st);
  assert.equal(st.rodada, 3, 'as duas rodadas perdidas já passaram');
  assert.equal(st.skip, 0);
  assert.equal(st.stats.perdidas, 2);
  assert.equal(E.rodadaPerdida(st), false);
});

test('F2: nenhuma carta tem alternativa absurda', () => {
  const absurdas = /em lugar nenhum|não faz diferença|não tem como|não dá para saber|^nada$|^não aparece$/i;
  for (const c of [...E.CARTAS, ...E.CARTAS_SALA]) {
    assert.equal(c.opcoes.length, 3, c.id);
    for (const o of c.opcoes) assert.ok(!absurdas.test(o), `${c.id}: "${o}"`);
  }
});

// ---------- Etapa 3 ----------
const todas = () => [...E.CARTAS, ...E.CARTAS_SALA];

test('F3: 36 cartas, 12 de cada tipo, todas bem formadas', () => {
  const por = (f) => todas().filter(f).length;
  assert.equal(por((c) => !c.sala && c.tipo === 'bussola'), 12);
  assert.equal(por((c) => !c.sala && c.tipo === 'tempestade'), 12);
  assert.equal(por((c) => c.sala), 12);
  assert.equal(por((c) => c.sala && c.tipo === 'bussola'), 6);
  assert.equal(new Set(todas().map((c) => c.id)).size, 36);
  for (const c of todas()) {
    assert.equal(c.opcoes.length, 3, c.id);
    assert.ok([0, 1, 2].includes(c.certa), c.id);
    assert.ok(c.titulo && c.historia && c.pergunta && c.porque, c.id);
    assert.equal(new Set(c.opcoes).size, 3, `${c.id}: opções repetidas`);
    const st = jogo({ sala: true, kit: [] });
    if (c.sala) c.efeitoSala(st, true); else c.efeito(st, true, seq(0.5));
    assert.ok(st.saldo >= 0 && st.saldo <= E.SALDO_MAX, c.id);
  }
});

test('F3: o baralho não repete carta até acabar e se refaz sozinho', () => {
  const st = jogo({ sala: false });
  assert.equal(E.baralho(st, 'bussola').length, 12);
  assert.equal(E.baralho({ ...st, sala: true }, 'bussola').length, 18);
  const vistos = new Set();
  for (let i = 0; i < 12; i++) {
    st.pos = 1; st.pend = null; st.rolou = false;
    E.rolar(st, seq(dado(1))); // casa 2 = Bússola
    assert.ok(!vistos.has(st.pend.carta), 'repetiu antes de acabar o baralho');
    vistos.add(st.pend.carta);
    st.pos = 1;
  }
  assert.equal(vistos.size, 12);
  st.pos = 1; st.rolou = false; st.pend = null;
  E.rolar(st, seq(dado(1), 0.3, 0.6, 0.9, 0.1, 0.5, 0.7, 0.2, 0.8, 0.4, 0.05, 0.95, 0.15));
  assert.ok(st.pend.carta, 'o baralho se refaz');
  assert.equal(st.sacadas.length, 13);
});

test('F3: mesma semente, mesmo baralho; cartas vistas voltam por último', () => {
  assert.deepEqual(E.montarBaralho(5, true, []), E.montarBaralho(5, true, []));
  assert.notDeepEqual(E.montarBaralho(5, true, []).bussola, E.montarBaralho(6, true, []).bussola);
  const base = E.montarBaralho(5, false, []).bussola;
  const vistas = base.slice(0, 4);
  const novo = E.montarBaralho(5, false, vistas).bussola;
  assert.deepEqual(novo.slice(-4), vistas, 'as vistas vão para o fim, na ordem em que foram vistas');
  assert.equal(novo.length, 12);
});

test('E1: 12 insígnias conferidas ao fim da partida', () => {
  assert.equal(E.INSIGNIAS.length, 12);
  assert.equal(new Set(E.INSIGNIAS.map((i) => i.id)).size, 12);
  const st = jogo({ kit: ['corda', 'lona', 'panela', 'mapa', 'bussola'], saldo: 160, fim: true, acertos: 3 });
  st.stats.cartas = 3; st.stats.recusas = 0; st.stats.maxSaldo = 260; st.stats.gratificacoes = 3; st.stats.duplos = 4;
  st.stats.kitCompletoRodada = 7; st.canivete = true; st.fogo = 2; st.stats.protecoes = 3; st.meta = 'poupador';
  const todos = E.insigniasDaPartida(st, { pos: 1, total: 4 });
  assert.deepEqual(todos.sort(), E.INSIGNIAS.map((i) => i.id).sort(), 'esta partida ganha as 12');
  const fraca = jogo({ fim: true });
  fraca.stats.recusas = 2;
  assert.deepEqual(E.insigniasDaPartida(fraca, { pos: 2, total: 4 }), []);
  assert.ok(!E.insigniasDaPartida(st, { pos: 1, total: 1 }).includes('campeao'), 'campeão precisa de mesa');
});

test('C7: o Mestre dispara um evento na rodada em que o jogador estiver', () => {
  const st = jogo({ agenda: [] });
  avancar(st, 4);
  assert.ok(E.aplicarEventoAgora(st, 'visita'));
  assert.equal(st.saldo, 130);
  assert.ok(E.aplicarEventoAgora(st, 'feira', 'enf'));
  assert.equal(E.descontoFeira(st, 'enf'), 5);
  avancar(st, 5);
  assert.equal(E.descontoFeira(st, 'enf'), 5, 'a feira do Mestre dura 2 rodadas');
  avancar(st, 6);
  assert.equal(E.descontoFeira(st, 'enf'), 0);
  assert.equal(E.aplicarEventoAgora(st, 'mutirao'), false, 'só os eventos liberados ao Mestre');
  st.fim = true;
  assert.equal(E.aplicarEventoAgora(st, 'chuva'), false);
});

// Joga uma partida do desafio do dia e devolve as ações, como o celular faria.
function jogarDesafio(dia, escolha = 'rolar') {
  const ctx = E.novoDesafio(dia), st = ctx.estados.get('eu'), acoes = [];
  const faz = (m) => { const r = E.passoDoDesafio(ctx, m); assert.ok(r.ok, JSON.stringify([m, r])); acoes.push(m); };
  for (let i = 0; i < 400 && !st.fim; i++) {
    if (!st.rolou) faz({ t: escolha === 'duplo' && st.saldo >= 30 ? 'dado_duplo' : 'rolar' });
    else if (st.pend?.tipo === 'dado') faz({ t: 'escolher_dado', i: 1 });
    else if (st.pend?.tipo === 'loja') {
      const it = E.ITENS.find((x) => x.loja === st.pend.loja && !st.kit.includes(x.id) && E.precoItem(st, x) + st.extra <= st.saldo);
      faz(it ? { t: 'comprar', itens: [it.id] } : { t: 'sair_loja' });
    } else if (st.pend?.tipo === 'carta') faz({ t: 'responder', i: 0 });
    else if (st.pend?.tipo === 'perdido') faz({ t: 'arriscar' });
    else if (st.pend?.tipo === 'troca') faz({ t: 'sair_troca' });
    else faz({ t: 'pagar' });
  }
  return { st, acoes };
}

test('E2: o desafio do dia dá a mesma partida a todos e o servidor reproduz o resultado', () => {
  assert.equal(E.sementeDoDia('2026-10-22'), E.sementeDoDia('2026-10-22'));
  assert.notEqual(E.sementeDoDia('2026-10-22'), E.sementeDoDia('2026-10-23'));
  const a = E.novoDesafio('2026-10-22').estados.get('eu'), b = E.novoDesafio('2026-10-22').estados.get('eu');
  assert.deepEqual(a.agenda, b.agenda);
  assert.deepEqual(a.baralho, b.baralho);
  assert.equal(a.meta, b.meta);
  // o primeiro dado de cada rodada é o mesmo, escolhendo rolar ou dado duplo
  const rolar = E.novoDesafio('2026-10-22'), duplo = E.novoDesafio('2026-10-22');
  E.passoDoDesafio(rolar, { t: 'rolar' });
  E.passoDoDesafio(duplo, { t: 'dado_duplo' });
  assert.equal(rolar.estados.get('eu').dado, duplo.estados.get('eu').pend.dados[0]);
  const { st, acoes } = jogarDesafio('2026-10-22');
  const volta = E.rodarDesafio('2026-10-22', acoes);
  assert.deepEqual(volta.pontos, E.pontuacao(st));
  assert.equal(volta.st.saldo, st.saldo);
  const outra = jogarDesafio('2026-10-22', 'duplo');
  assert.deepEqual(E.rodarDesafio('2026-10-22', outra.acoes).pontos, E.pontuacao(outra.st));
});

test('E2: o servidor recusa ações inválidas, partida incompleta e ações a mais', () => {
  const { acoes } = jogarDesafio('2026-10-22');
  assert.match(E.rodarDesafio('2026-10-22', acoes.slice(0, -3)).erro, /não terminou/);
  assert.match(E.rodarDesafio('2026-10-22', [...acoes, { t: 'rolar' }]).erro, /depois do fim/);
  assert.match(E.rodarDesafio('2026-10-22', [{ t: 'hackear' }]).erro, /inválida/);
  assert.match(E.rodarDesafio('2026-10-22', [{ t: 'comprar', itens: ['lona'] }]).erro, /Ação 1/);
  assert.match(E.rodarDesafio('2026-10-22', 'x').erro, /inválida/);
  assert.match(E.rodarDesafio('2026-10-22', new Array(401).fill({ t: 'rolar' })).erro, /inválida/);
});

// ---------- Etapa 4 ----------
const naTroca = (kit, extra = {}) => { const st = jogo({ kit, ...extra }); st.rolou = true; st.pend = { tipo: 'troca' }; return st; };
const salaCtx = (...nomes) => {
  const ctx = E.novoContexto({}); ctx.ofertas = true;
  nomes.forEach((n, i) => ctx.estados.set(n, E.novoJogador({ apelido: n, ficha: 'f01', seed: 9, ordem: i, sala: true })));
  return ctx;
};

test('A7: a Feira de Trocas é uma casa do tabuleiro e só abre com item no kit', () => {
  assert.equal(E.TABULEIRO[15], 'troca');
  assert.equal(E.CASAS.troca.nome, 'Feira de Trocas');
  const vazio = jogo({ pos: 14 });
  E.rolar(vazio, seq(dado(1)));
  assert.equal(vazio.pend, null, 'sem item não há o que trocar');
  assert.match(vazio.avisos.at(-1).texto, /ainda não tem itens/);
  const com = jogo({ pos: 14, kit: ['corda'] });
  E.rolar(com, seq(dado(1)));
  assert.equal(com.pend.tipo, 'troca');
});

test('A7: o baú troca item por item de igual valor ou menor, sem mexer no saldo', () => {
  const st = naTroca(['lona']); // Lona 25 BC
  assert.match(E.trocarNoBau(st, 'lona', 'lona').erro, /diferente/);
  assert.match(E.trocarNoBau(st, 'panela', 'corda').erro, /no seu kit/);
  assert.match(E.trocarNoBau(st, 'lona', 'kitps').erro, /mesmo ou menos/, 'Kit custa 30 BC');
  assert.ok(E.trocarNoBau(st, 'lona', 'panela').ok); // Panela 20 BC
  assert.deepEqual(st.kit, ['panela']);
  assert.equal(st.saldo, 100);
  assert.ok(st.feito && st.pend === null);
  assert.equal(st.stats.trocas, 1);
  assert.match(E.trocarNoBau(naTroca(['lona', 'panela']), 'lona', 'panela').erro, /já tem/);
  assert.match(E.trocarNoBau(jogo({ kit: ['lona'] }), 'lona', 'panela').erro, /Feira de Trocas/);
});

test('A7: a oferta numa sala vale para quem aceitar primeiro, e nenhum BC muda de conta', () => {
  const ctx = salaCtx('Ana', 'Beto', 'Caio');
  const [ana, beto, caio] = ['Ana', 'Beto', 'Caio'].map((n) => ctx.estados.get(n));
  ana.kit = ['lona']; beto.kit = ['panela']; caio.kit = ['panela', 'lona'];
  ana.pend = { tipo: 'troca' }; ana.rolou = true;
  const r = E.agirNaSala(ctx, 'Ana', { t: 'oferecer_troca', dar: 'lona', querer: 'panela' });
  assert.ok(r.ok && ana.feito);
  assert.deepEqual(ana.oferta, { dar: 'lona', querer: 'panela', rodada: 0 });
  assert.equal(E.podeAceitar(caio, ana), false, 'Caio já tem a Lona');
  assert.equal(E.podeAceitar(ana, ana), false);
  assert.ok(E.podeAceitar(beto, ana));
  const t = E.agirNaSala(ctx, 'Beto', { t: 'aceitar_troca', de: 'Ana' });
  assert.deepEqual(t.afetados.sort(), ['Ana', 'Beto']);
  assert.deepEqual(ana.kit, ['panela']);
  assert.deepEqual(beto.kit, ['lona']);
  assert.deepEqual([ana.saldo, beto.saldo], [100, 100]);
  assert.equal(ana.oferta, null);
  assert.match(E.agirNaSala(ctx, 'Caio', { t: 'aceitar_troca', de: 'Ana' }).erro, /não está mais disponível/, 'só o primeiro leva');
  assert.match(ana.avisos.at(-1).texto, /Beto aceitou/);
});

test('A7: oferecer exige sala, e a oferta vence depois da rodada seguinte', () => {
  const solo = naTroca(['lona']);
  assert.match(E.oferecerTroca(solo, 'lona', 'panela', null).erro, /sala/);
  const st = jogo({ kit: ['lona'] });
  st.oferta = { dar: 'lona', querer: 'panela', rodada: 2 };
  st.rodada = 3; assert.equal(E.ofertaAtiva(st), true);
  st.rodada = 4; assert.equal(E.ofertaAtiva(st), false);
  const fim = jogo({ kit: ['lona'], fim: true }); fim.oferta = { dar: 'lona', querer: 'panela', rodada: 0 };
  assert.equal(E.ofertaAtiva(fim), false);
});

test('A7: tempo esgotado sai da Feira de Trocas', () => {
  const st = naTroca(['corda']);
  E.tempoEsgotado(st, seq(0.5));
  assert.equal(st.pend, null);
  assert.ok(st.feito);
});

test('F5: toda carta tem texto curto de até 15 palavras, já com a pergunta', () => {
  for (const c of [...E.CARTAS, ...E.CARTAS_SALA]) {
    assert.ok(c.curto, `${c.id} sem texto curto`);
    const palavras = c.curto.trim().split(/\s+/).length;
    assert.ok(palavras <= 15, `${c.id}: ${palavras} palavras`);
    assert.ok(c.curto.trim().endsWith('?'), `${c.id}: o texto curto termina na pergunta`);
    assert.ok(c.curto.length < c.historia.length + c.pergunta.length, `${c.id}: não é mais curto que o completo`);
  }
  assert.equal(E.cartaMostrada({ seed: 3 }, 'vovo').curto, 'O vovô mandou 30 BC. E se a conta passar de 300 BC?');
});

test('F6: a missão da sala é igual para todos e quem cumpre primeiro leva 15 pts', () => {
  assert.deepEqual(E.missaoDaPartida(5), E.missaoDaPartida(5));
  assert.equal(new Set(Array.from({ length: 60 }, (_, i) => E.missaoDaPartida(i + 1).id)).size, E.MISSOES.length, 'todas as missões saem');
  const ctx = salaCtx('Ana', 'Beto');
  ctx.missao = { id: 'cozinha', vencedor: null };
  const [ana, beto] = ['Ana', 'Beto'].map((n) => ctx.estados.get(n));
  assert.match(E.descreverMissao(ctx.missao), /Montar a cozinha \(Panela e Lona\)/);
  ana.kit = ['panela']; beto.kit = ['panela', 'lona'];
  assert.equal(E.conferirMissao(ctx), 'Beto');
  assert.equal(ctx.missao.vencedor, 'Beto');
  assert.equal(beto.missaoPts, 15);
  assert.equal(E.pontuacao(beto).missao, 15);
  assert.match(ana.avisos.at(-1).texto, /Beto cumpriu a missão/);
  ana.kit = ['panela', 'lona'];
  assert.equal(E.conferirMissao(ctx), null, 'só o primeiro');
  assert.equal(ana.missaoPts, 0);
});

test('F6: comprar o último item da missão a cumpre na hora, e quem já terminou não ganha', () => {
  const ctx = salaCtx('Ana', 'Beto');
  ctx.missao = { id: 'rota', vencedor: null };
  const ana = ctx.estados.get('Ana'), beto = ctx.estados.get('Beto');
  beto.kit = ['mapa', 'bussola']; beto.fim = true;
  ana.kit = ['mapa']; ana.pend = { tipo: 'loja', loja: 'exp' }; ana.rolou = true;
  const r = E.agirNaSala(ctx, 'Ana', { t: 'comprar', itens: ['bussola'] });
  assert.ok(r.ok);
  assert.equal(ctx.missao.vencedor, 'Ana', 'quem já terminou não conta');
  assert.ok(ana.cena.some((c) => c.t === 'missao'));
});

test('cenário: chuva na rodada do evento Chuva, noite na reta final, dia no resto', () => {
  const st = jogo({ agenda: [{ rodada: 3, tipo: 'chuva' }, { rodada: 6, tipo: 'feira', loja: 'exp' }] });
  assert.equal(E.climaDaRodada(st), 'dia');
  avancar(st, 3);
  assert.equal(E.climaDaRodada(st), 'chuva');
  avancar(st, 4);
  assert.equal(E.climaDaRodada(st), 'dia', 'a chuva dura uma rodada');
  avancar(st, 10);
  assert.equal(E.climaDaRodada(st), 'noite');
  E.aplicarEventoAgora(st, 'chuva');
  assert.equal(E.climaDaRodada(st), 'chuva', 'a chuva do Mestre do mercado também molha o tabuleiro');
});
