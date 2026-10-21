// Mercado da Trilha — rivais virtuais (A6) e jogador de simulação.
// Cada rival joga as mesmas ações de um jogador de verdade, pelo motor da sala, com uma estratégia simples.
// O jogo sozinho usa os três rivais; a simulação de balanceamento usa as mesmas estratégias.
import * as E from './engine.js';

// Estratégia = parâmetros de decisão:
//  conhecimento  chance de acertar a pergunta de uma carta
//  duplo/duploMin  usa o dado duplo quando falta item no kit e o saldo é pelo menos `duploMin`
//  ajuda/ajudaAbaixoDe/sempreAjuda  usa "Ajudar no acampamento" quando o saldo fica abaixo de `ajudaAbaixoDe`
//  pagaSempre  no Perdido clica em "Pagar" mesmo sem saldo (senão arrisca o dado)
//  escolheBem  escolhe o dado também por agência, fogo e Partida (senão só por loja com item útil)
//  reserva     só compra se sobrar pelo menos isso; maxItens: quantos itens leva por compra
export const ESTRATEGIAS = {
  comprador: { conhecimento: 0.7, duplo: true, duploMin: 25, ajuda: false, pagaSempre: false, escolheBem: true, reserva: 0, maxItens: 7 },
  poupador:  { conhecimento: 0.85, duplo: false, ajuda: true, ajudaAbaixoDe: 40, pagaSempre: false, escolheBem: true, reserva: 45, maxItens: 2 },
  apressado: { conhecimento: 0.45, duplo: false, ajuda: false, pagaSempre: true, escolheBem: false, reserva: 0, maxItens: 1 },
};

export const RIVAIS = [
  { id: 'r1', apelido: 'Lobo Veloz', ficha: 'f02', cor: '#2B6FA3', estrategia: 'apressado' },
  { id: 'r2', apelido: 'Coruja Atenta', ficha: 'f07', cor: '#2F7A42', estrategia: 'poupador' },
  { id: 'r3', apelido: 'Raposa Esperta', ficha: 'f09', cor: '#7A4FB0', estrategia: 'comprador' },
];

// Nota do dado para quem só olha lojas: cair numa loja aberta com item útil e que cabe no saldo.
function notaLoja(st, d) {
  const casa = E.TABULEIRO[(st.pos + d) % E.TABULEIRO.length];
  if (!E.CASAS[casa].loja || E.lojaFechada(st, casa)) return 0;
  return E.ITENS.some((i) => i.loja === casa && !st.kit.includes(i.id) && E.precoItem(st, i) <= st.saldo) ? 1 : 0;
}
// Quem escolhe bem também mira agência, fogo e Partida e foge de pedágio, tempestade e Perdido.
function notaBoa(st, d) {
  const pos = (st.pos + d) % E.TABULEIRO.length, casa = E.TABULEIRO[pos];
  const base = notaLoja(st, d) * 6 + (pos < st.pos ? 3 : 0);
  return base + ({ agencia: 3, fogo: 4, partida: 3, bussola: 2, pedagio: -1, tempestade: -2, perdido: -2 }[casa] ?? 0);
}
function melhorDado(st, pol) {
  const [a, b] = st.pend.dados, nota = pol.escolheBem ? notaBoa : notaLoja;
  return nota(st, b) > nota(st, a) ? 1 : 0;
}

function escolherCompra(st, pol) {
  const itens = E.ITENS.filter((i) => i.loja === st.pend.loja && !st.kit.includes(i.id))
    .sort((a, b) => (pol.ordemCompra === 'cara' ? E.precoItem(st, b) - E.precoItem(st, a) : E.precoItem(st, a) - E.precoItem(st, b)));
  const ids = [];
  for (const i of itens) {
    if (ids.length >= (pol.maxItens ?? 7)) break;
    if (E.totalCompra(st, [...ids, i.id]).total <= st.saldo - (pol.reserva ?? 0)) ids.push(i.id);
  }
  return ids;
}

function respostaDaCarta(st, conhecimento, rng) {
  const c = E.cartaMostrada(st, st.pend.carta);
  if (rng() < conhecimento) return c.certa;
  const erradas = [0, 1, 2].filter((i) => i !== c.certa);
  return erradas[Math.floor(rng() * 2)];
}

/**
 * Joga uma rodada inteira de `id` pelo motor da sala. Devolve se o jogador teve alguma escolha de verdade
 * (mais de uma jogada possível antes do dado, ou uma decisão na casa).
 */
export function jogarRodadaBot(ctx, id, pol, rng) {
  const st = ctx.estados.get(id);
  const ag = (m) => {
    const r = E.agirNaSala(ctx, id, m, rng);
    if (r.erro) throw new Error(`${m.t}: ${r.erro}`);
    return r;
  };
  let escolha = false;
  const op = E.opcoesDaRodada(st);
  if ([op.rolar, op.duplo, op.ajudar].filter(Boolean).length >= 2) escolha = true;
  const falta = st.kit.length < E.ITENS.length;
  let primeira = { t: 'rolar' };
  if (pol.duplo && op.duplo && st.saldo >= (pol.duploMin ?? 25) && falta) primeira = { t: 'dado_duplo' };
  else if (pol.ajuda && op.ajudar && (pol.sempreAjuda || (st.saldo < (pol.ajudaAbaixoDe ?? 15) && falta))) primeira = { t: 'ajudar' };
  ag(primeira);
  if (st.pend?.tipo === 'dado') ag({ t: 'escolher_dado', i: melhorDado(st, pol) });
  for (let guarda = 0; st.pend && guarda < 5; guarda++) {
    const t = st.pend.tipo;
    if (t === 'loja') {
      const ids = escolherCompra(st, pol);
      if (E.ITENS.some((i) => i.loja === st.pend.loja && !st.kit.includes(i.id))) escolha = true;
      ag(ids.length ? { t: 'comprar', itens: ids } : { t: 'sair_loja' });
    } else if (t === 'carta') {
      escolha = true;
      ag({ t: 'responder', i: respostaDaCarta(st, pol.conhecimento, rng) });
    } else if (t === 'perdido') {
      escolha = true;
      ag({ t: pol.pagaSempre || st.saldo >= st.pend.valor ? 'pagar' : 'arriscar' });
    } else if (t === 'troca') ag({ t: 'sair_troca' });
    else ag({ t: 'pagar' });
  }
  return escolha;
}

/** Os rivais do jogo sozinho jogam as rodadas que ainda faltam para alcançar o jogador. */
export function rivaisJogam(ctx, rng) {
  for (const r of RIVAIS) {
    const st = ctx.estados.get(r.id), ref = ctx.estados.get('eu');
    if (!st) continue;
    for (let guarda = 0; guarda < 20 && !st.fim && st.rodada < ref.rodada; guarda++) {
      jogarRodadaBot(ctx, r.id, ESTRATEGIAS[r.estrategia], rng);
      E.fecharRodada(st);
      E.passarRodadasPerdidas(st);
    }
  }
}

/** Monta o contexto do jogo sozinho com os 3 rivais: uma sala de verdade, só que dentro do aparelho. */
export function novoJogoSolo({ apelido, ficha, rodadas, seed, vistas = [] }) {
  const ctx = E.novoContexto({});
  ctx.missao = E.missaoDaPartida(seed);
  ctx.estados.set('eu', E.novoJogador({ apelido, ficha, rodadas, seed, ordem: 0, sala: true, vistas }));
  RIVAIS.forEach((r, i) => ctx.estados.set(r.id, E.novoJogador({ apelido: r.apelido, ficha: r.ficha, rodadas, seed, ordem: i + 1, sala: true })));
  return ctx;
}
