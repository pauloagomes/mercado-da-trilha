// Simulação de partidas com o motor do jogo (as métricas de design do RFC).
// Serve ao npm test (test/balanceamento.test.js) e ao comando `npm run simular`.
// Recebe o módulo do motor por parâmetro para poder comparar com uma versão antiga.

export const ETAPA = 3;

// Meta final (RFC) e faixa mínima que a etapa atual precisa cumprir.
// `etapa` é a faixa que a etapa atual precisa cumprir; `lancamento` é a meta do RFC para ir ao ar.
export const FAIXAS = {
  semEscolha:    { rotulo: 'Rodadas sem nenhuma escolha, em 12', lancamento: [0, 1],       etapa: [0, 1] },
  venceQuemSabe: { rotulo: 'Quem sabe as regras vence numa mesa de 4', lancamento: [0.44, 1], etapa: [0.44, 1] },
  semComemoracao: { rotulo: 'Partidas sem nenhuma comemoração', lancamento: [0, 0], etapa: [0, 0.01] },
  repeticao:     { rotulo: 'Cartas já vistas, em 3 partidas seguidas', lancamento: [0, 0.15], etapa: [0, 0.15] },
  recusou:       { rotulo: 'Partidas com pagamento recusado', lancamento: [0.3, 0.5],      etapa: [0.12, 0.5] },
};

import { jogarRodadaBot } from '../public/js/rivais.js';

// Jogador de referência do RFC: compra tudo o que cabe no saldo, compra o dado duplo com 25 BC ou mais
// quando falta item no kit, escolhe o dado que leva a uma loja útil e acerta 80% das cartas.
// `pagaSempre`: no Perdido clica em "Pagar" mesmo sem saldo, como o jogador de referência do RFC.
export const REFERENCIA = { conhecimento: 0.8, duplo: true, ajuda: false, pagaSempre: true };
// Igual, mas sem nenhuma das escolhas novas: é o jogo de antes (linha de base).
export const SEM_ESCOLHAS = { ...REFERENCIA, duplo: false };
// Igual à referência, mas escolhendo bem o dado.
export const ESPERTO = { ...REFERENCIA, escolheBem: true };
// Jogador cuidadoso: também usa "Ajudar no acampamento" quando o saldo está abaixo de 15 BC.
export const CUIDADOSO = { ...REFERENCIA, ajuda: true };
// Joga sempre "Ajudar no acampamento": a estratégia que não pode compensar.
export const SO_AJUDA = { ...REFERENCIA, duplo: false, ajuda: true, sempreAjuda: true };

/**
 * Joga uma partida com `politicas.length` jogadores. Com mais de um, é uma sala (cartas de sala e pontes).
 * Devolve, por jogador, o estado final e as medidas da partida.
 */
export function jogarPartida(E, politicas, { rodadas = 12, seed = 1, vistas = [] } = {}) {
  const rng = E.rngComSemente(seed * 7919 + 13);
  const sala = politicas.length > 1;
  const ctx = E.novoContexto ? E.novoContexto(sala ? {} : null) : { estados: new Map() };
  politicas.forEach((_, i) => {
    ctx.estados.set(i, E.novoJogador({ apelido: `J${i}`, ficha: 'f01', rodadas, seed, ordem: i, sala, vistas }));
  });
  const medidas = politicas.map(() => ({ semEscolha: 0, recusou: false, comemorou: false, cartasVistas: [] }));
  for (let r = 0; r < rodadas; r++) {
    politicas.forEach((pol, i) => {
      const st = ctx.estados.get(i);
      // Rodada perdida passa sozinha (C6): quem já avançou além de `r` não joga de novo.
      if (st.fim || st.rodada > r) return;
      // Cada carta é contada uma vez, quando sai.
      const vistas = st.sacadas.length;
      if (!jogarRodadaBot(ctx, i, pol, rng)) medidas[i].semEscolha += 1;
      medidas[i].cartasVistas.push(...st.sacadas.slice(vistas));
      E.fecharRodada(st);
      E.passarRodadasPerdidas(st);
    });
  }
  return politicas.map((_, i) => {
    const st = ctx.estados.get(i), m = medidas[i];
    if (st.stats) { m.recusou = st.stats.recusas > 0; m.tetoRecusado = st.stats.creditosRecusados > 0; m.semEscolha += st.stats.perdidas; }
    // Comemoração: Fogo de Conselho, kit completo, carta certa (brilho), meta cumprida ou insígnia no resultado.
    m.comemorou = st.fogo > 0 || st.kit.length === E.ITENS.length || st.acertos > 0 || E.metaCumprida(st) || E.insigniasDaPartida(st).length > 0;
    m.pontos = E.pontuacao(st);
    return { st, ...m };
  });
}

const media = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/** Partidas de uma pessoa só: escolhas, kit completo, pagamento recusado e saldo final. */
export function medirSolo(E, { n = 3000, politica = REFERENCIA, rodadas = 12 } = {}) {
  const jogos = [];
  for (let s = 1; s <= n; s++) jogos.push(jogarPartida(E, [politica], { rodadas, seed: s })[0]);
  return {
    semEscolha: media(jogos.map((j) => j.semEscolha)),
    kitCompleto: media(jogos.map((j) => (j.st.kit.length === E.ITENS.length ? 1 : 0))),
    recusou: media(jogos.map((j) => (j.recusou ? 1 : 0))),
    tetoRecusado: media(jogos.map((j) => (j.tetoRecusado ? 1 : 0))),
    semComemoracao: media(jogos.map((j) => (j.comemorou ? 0 : 1))),
    saldoFinal: media(jogos.map((j) => j.st.saldo)),
    pontos: media(jogos.map((j) => j.pontos.total)),
    duplos: media(jogos.map((j) => j.st.stats?.duplos ?? 0)),
  };
}

/** Mesa de 4: quem acerta tudo contra três rivais que acertam metade (acaso: 25%). */
export function medirMesa(E, { n = 3000, rodadas = 12, base = REFERENCIA } = {}) {
  const sabe = { ...base, conhecimento: 1 }, chuta = { ...base, conhecimento: 0.5 };
  let vitorias = 0, recusas = 0;
  for (let s = 1; s <= n; s++) {
    const jogo = jogarPartida(E, [sabe, chuta, chuta, chuta], { rodadas, seed: s });
    const lista = jogo.map((j, i) => ({ i, pontos: j.pontos.total, saldo: j.st.saldo, acertos: j.st.acertos }));
    lista.sort(E.compararPlacar);
    const top = lista.filter((x) => E.compararPlacar(x, lista[0]) === 0);
    if (top.some((x) => x.i === 0)) vitorias += 1 / top.length;
    if (jogo[0].recusou) recusas += 1;
  }
  return { venceQuemSabe: vitorias / n, recusouNaMesa: recusas / n };
}

/**
 * Das cartas tiradas em 3 partidas seguidas do mesmo jogador, quantas já tinham aparecido.
 * Como no aparelho, as cartas das últimas partidas (até 24) vão para o fim do baralho da próxima.
 */
export function medirRepeticao(E, { n = 1500, politica = REFERENCIA } = {}) {
  let tiradas = 0, repetidas = 0;
  for (let s = 1; s <= n; s++) {
    const vistasNaSequencia = new Set();
    let memoria = [];
    for (let k = 0; k < 3; k++) {
      const [j] = jogarPartida(E, [politica], { seed: s * 3 + k, vistas: memoria });
      for (const c of j.cartasVistas) { tiradas += 1; if (vistasNaSequencia.has(c)) repetidas += 1; vistasNaSequencia.add(c); }
      memoria = [...memoria, ...j.cartasVistas].slice(-24);
    }
  }
  return repetidas / tiradas;
}
