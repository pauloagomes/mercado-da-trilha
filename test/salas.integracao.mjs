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
  // ---- Etapa 3: patrulhas, Mestre do mercado, insígnias e revanche
  const cris = await novoJogador('Cris');
  const ate3 = async (c, ms = 3000) => { const t0 = Date.now(); while (!c()) { if (Date.now() - t0 > ms) throw new Error('tempo esgotado'); await new Promise((r) => setTimeout(r, 20)); } };
  const criadas = [];
  try {
    const w3 = [falso(ana), falso(beto), falso(cris)];
    const s3 = await S.criarSalaCodigo(ana, 8); criadas.push(s3.codigo);
    for (const [w, j] of [[w3[0], ana], [w3[1], beto], [w3[2], cris]]) await S.entrarNaSala(w, j, s3.codigo);
    const [P1, P2, P3] = [ana, beto, cris].map((j) => s3.jogadores.get(j.id));

    await S.sortearPatrulhas(w3[1], beto, { n: 2 });
    assert.equal(s3.patrulhasN, 0, 'só o anfitrião sorteia');
    await S.sortearPatrulhas(w3[0], ana, { n: 4 });
    assert.match(w3[0].ultimo('erro').msg, /pelo menos 4/);
    await S.sortearPatrulhas(w3[0], ana, { n: 2 });
    const pats = [P1, P2, P3].map((p) => p.patrulha).sort();
    assert.deepEqual(pats, [0, 0, 1].sort().length === 3 ? pats : [], 'cada jogador cai numa patrulha');
    assert.ok(pats.every((x) => x === 0 || x === 1) && new Set(pats).size === 2);
    const est = w3[0].ultimo('estado');
    assert.equal(est.sala.patrulhas.length, 2);
    assert.equal(est.sala.patrulhas.reduce((a, b) => a + b.membros, 0), 3);
    assert.ok(est.placar.every((x) => x.patrulha === 0 || x.patrulha === 1));
    const dbPat = await rows('SELECT patrulha FROM participacoes WHERE sala_codigo = $1 ORDER BY ordem', [s3.codigo]);
    assert.deepEqual(dbPat.map((r) => r.patrulha), [P1, P2, P3].map((p) => p.patrulha), 'as patrulhas ficam gravadas');

    // Mestre do mercado: Visita dos pais na sala toda
    S.mestreDoMercado(w3[1], beto, { tipo: 'visita' });
    assert.equal(P1.st.saldo, 100, 'só o anfitrião chama o Mestre');
    S.mestreDoMercado(w3[0], ana, { tipo: 'mutirao' });
    assert.match(w3[0].ultimo('erro').msg, /desconhecido/);
    S.mestreDoMercado(w3[0], ana, { tipo: 'visita' });
    await s3.gravando;
    assert.deepEqual([P1, P2, P3].map((p) => p.st.saldo), [130, 130, 130]);
    assert.ok(s3.mural.some((m) => /anfitrião chamou: Visita dos pais/.test(m.texto)));
    S.mestreDoMercado(w3[0], ana, { tipo: 'chuva' });
    assert.match(w3[0].ultimo('erro').msg, /Espere/);
    await S.encerrarSala(s3, 'fim de teste');

    // Insígnias e revanche da sala com código
    const wa4 = falso(ana), wb4 = falso(beto);
    const s4 = await S.criarSalaCodigo(ana, 8); criadas.push(s4.codigo);
    await S.entrarNaSala(wa4, ana, s4.codigo); await S.entrarNaSala(wb4, beto, s4.codigo);
    for (let i = 0; i < 8; i++) { await S.agir(wa4, ana, { t: 'ajudar' }); await S.agir(wb4, beto, { t: 'ajudar' }); }
    await s4.gravando;
    const A4 = s4.jogadores.get(ana.id), B4 = s4.jogadores.get(beto.id);
    assert.ok(A4.st.fim && B4.st.fim);
    const insA = (await rows('SELECT insignia FROM insignias WHERE jogador_id = $1', [ana.id])).map((r) => r.insignia);
    const insB = (await rows('SELECT insignia FROM insignias WHERE jogador_id = $1', [beto.id])).map((r) => r.insignia);
    for (const ins of [insA, insB]) assert.ok(ins.includes('cofre') && ins.includes('semrecusa'), `insígnias: ${ins}`);
    assert.equal([A4, B4].filter((p) => p.st.insignias.includes('campeao')).length, 1, 'um só campeão da mesa');
    assert.ok(wa4.ultimo('estado').eu.insignias.includes('cofre'), 'o jogador recebe as insígnias na partida');
    assert.ok(Array.isArray(wa4.ultimo('estado').placar[0].insignias));

    await S.pedirRevanche(wb4, beto);
    assert.match(wb4.ultimo('erro').msg, /anfitrião/);
    assert.equal(s4.revancheCodigo, null);
    assert.equal(s4.status, 'aberta');
    await S.pedirRevanche(wa4, ana); // o anfitrião reabre: a sala atual encerra sozinha
    assert.equal(s4.status, 'encerrada');
    assert.ok(s4.revancheCodigo && s4.revancheCodigo !== s4.codigo);
    criadas.push(s4.revancheCodigo);
    assert.equal(wb4.ultimo('revanche_sala').codigo, s4.revancheCodigo, 'os outros são levados para a sala nova');
    assert.equal(wa4.salaCodigo, s4.revancheCodigo, 'o anfitrião já está na sala nova');
    assert.equal(S._interno.salas.get(s4.revancheCodigo).anfitriao, ana.id);
    console.log('sala com código (etapa 3) ok');

    // Revanche da sala de espera: quem aceitar joga de novo
    const wa5 = falso(ana), wb5 = falso(beto), wc5 = falso(cris);
    S.entrarNaFila(wa5, ana); S.entrarNaFila(wb5, beto); S.entrarNaFila(wc5, cris);
    await ate3(() => wa5.ultimo('partida') && wb5.ultimo('partida') && wc5.ultimo('partida'));
    const e5 = S._interno.salas.get(wa5.ultimo('partida').codigo); criadas.push(e5.codigo);
    await S.pedirRevanche(wa5, ana);
    assert.equal(e5.revanche, null, 'só depois que a partida acaba');
    await S.encerrarSala(e5, 'fim');
    await S.pedirRevanche(wa5, ana);
    assert.equal(wa5.ultimo('estado').sala.revanche.aceitaram, 1);
    await S.pedirRevanche(wb5, beto);
    assert.equal(e5.revanche.aceitos.size, 2);
    wc5.readyState = 3; // Cris saiu: a revanche não espera por quem não está mais lá
    await S.pedirRevanche(wb5, beto);
    await ate3(() => wa5.msgs.filter((m) => m.t === 'partida').length >= 2);
    const nova = S._interno.salas.get(wa5.ultimo('partida').codigo); criadas.push(nova.codigo);
    assert.notEqual(nova.codigo, e5.codigo);
    assert.equal(nova.jogadores.size, 2);
    assert.equal(nova.tipo, 'espera');
    assert.deepEqual([...nova.jogadores.values()].map((p) => p.st.rodada), [0, 0]);
    console.log('revanche ok');
  } finally {
    for (const c of criadas) await pool.query('DELETE FROM salas WHERE codigo = $1', [c]);
    await pool.query('DELETE FROM jogadores WHERE id = $1', [cris.id]);
  }
  // ---- Etapa 4: missão da sala e Feira de Trocas
  const criadas4 = [];
  try {
    const wa6 = falso(ana), wb6 = falso(beto);
    const s6 = await S.criarSalaCodigo(ana, 8); criadas4.push(s6.codigo);
    await S.entrarNaSala(wa6, ana, s6.codigo); await S.entrarNaSala(wb6, beto, s6.codigo);
    const A6 = s6.jogadores.get(ana.id), B6 = s6.jogadores.get(beto.id);
    assert.ok(E.missaoPorId(s6.missao.id), 'toda sala tem uma missão');
    assert.equal(wa6.ultimo('estado').sala.missao.pts, 15);
    assert.deepEqual(s6.missao, { id: E.missaoDaPartida(s6.semente).id, vencedor: null });

    // F6: quem completa o conjunto de itens primeiro leva 15 pts
    s6.missao = { id: 'cozinha', vencedor: null };
    B6.st.kit = ['panela']; B6.st.pos = 1; B6.st.rolou = true; B6.st.pend = { tipo: 'loja', loja: 'util' };
    await S.agir(wb6, beto, { t: 'comprar', itens: ['lona'] });
    await s6.gravando;
    assert.equal(s6.missao.vencedor, beto.id);
    assert.equal(B6.st.missaoPts, 15);
    assert.equal(wa6.ultimo('estado').sala.missao.vencedor, 'Beto');
    assert.ok(s6.mural.some((m) => /Beto cumpriu a missão da sala primeiro/.test(m.texto)));
    const [{ missao }] = await rows('SELECT missao FROM salas WHERE codigo = $1', [s6.codigo]);
    assert.equal(missao.vencedor, beto.id, 'o vencedor fica gravado');
    S._interno.salas.delete(s6.codigo);
    assert.equal((await S.carregarSala(s6.codigo)).missao.vencedor, beto.id, 'e volta depois de um reinício');
    const s6b = S._interno.salas.get(s6.codigo), A6b = s6b.jogadores.get(ana.id), B6b = s6b.jogadores.get(beto.id);

    // A7: oferta de troca aceita por quem tem o item
    A6b.st.kit = ['corda']; A6b.st.pend = { tipo: 'troca' }; A6b.st.rolou = true; A6b.st.feito = false;
    B6b.st.kit = ['mapa']; B6b.st.rolou = false; B6b.st.feito = false; B6b.st.pend = null;
    const wa7 = falso(ana), wb7 = falso(beto);
    await S.entrarNaSala(wa7, ana, s6.codigo); await S.entrarNaSala(wb7, beto, s6.codigo);
    await S.agir(wa7, ana, { t: 'oferecer_troca', dar: 'corda', querer: 'mapa' });
    const oferta = wb7.ultimo('estado').sala.ofertas[0];
    assert.deepEqual([oferta.apelido, oferta.dar, oferta.querer, oferta.possoAceitar], ['Ana', 'corda', 'mapa', true]);
    assert.equal(wa7.ultimo('estado').sala.ofertas.length, 0, 'quem ofereceu não vê a própria oferta na lista');
    await S.agir(wb7, beto, { t: 'aceitar_troca', de: 99 });
    assert.match(wb7.ultimo('erro').msg, /não existe/);
    await S.agir(wb7, beto, { t: 'aceitar_troca', de: oferta.de });
    await s6b.gravando;
    assert.deepEqual(A6b.st.kit, ['mapa']);
    assert.deepEqual(B6b.st.kit, ['corda']);
    assert.equal(A6b.st.oferta, null);
    assert.equal(wb7.ultimo('estado').sala.ofertas.length, 0);
    const [dbA] = await rows('SELECT estado FROM participacoes WHERE id = $1', [A6b.partId]);
    assert.deepEqual(dbA.estado.kit, ['mapa'], 'a troca fica gravada');
    assert.ok(s6b.mural.some((m) => /fez uma troca na Feira/.test(m.texto)));
    console.log('missão e trocas ok');
  } finally {
    for (const c of criadas4) await pool.query('DELETE FROM salas WHERE codigo = $1', [c]);
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
