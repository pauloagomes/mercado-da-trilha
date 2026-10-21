// Simulação de partidas com o motor do jogo (as métricas de design do RFC).
// Serve ao npm test (test/balanceamento.test.js) e ao comando `npm run simular`.
// Recebe o módulo do motor por parâmetro para poder comparar com uma versão antiga.

export const ETAPA = 1;

// Meta final (RFC) e faixa mínima que a etapa atual precisa cumprir.
// `etapa` é a faixa que a etapa atual precisa cumprir; `lancamento` é a meta do RFC para ir ao ar.
export const FAIXAS = {
  semEscolha:    { rotulo: 'Rodadas sem nenhuma escolha, em 12', lancamento: [0, 1],       etapa: [0, 1] },
  venceQuemSabe: { rotulo: 'Quem sabe as regras vence numa mesa de 4', lancamento: [0.44, 1], etapa: [0.4, 1] },
  recusou:       { rotulo: 'Partidas com pagamento recusado', lancamento: [0.3, 0.5],      etapa: [0.12, 0.5] },
};

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

// Nota do dado para o jogador de referência do RFC: só interessa cair numa loja aberta com item útil.
function notaDaCasa(E, st, d) {
  const casa = E.TABULEIRO[(st.pos + d) % E.TABULEIRO.length];
  if (!E.CASAS[casa].loja || E.lojaFechada(st, casa)) return 0;
  return E.ITENS.some((i) => i.loja === casa && !st.kit.includes(i.id) && E.precoItem(st, i) <= st.saldo) ? 1 : 0;
}

// Quem escolhe bem também mira agência, fogo e Partida e foge de pedágio, tempestade e Perdido.
function notaBoa(E, st, d) {
  const pos = (st.pos + d) % E.TABULEIRO.length, casa = E.TABULEIRO[pos];
  const base = notaDaCasa(E, st, d) * 6 + (pos < st.pos ? 3 : 0);
  return base + ({ agencia: 3, fogo: 4, partida: 3, bussola: 2, pedagio: -1, tempestade: -2, perdido: -2 }[casa] ?? 0);
}

function melhorDado(E, st, pol) {
  const [a, b] = st.pend.dados, nota = pol.escolheBem ? notaBoa : notaDaCasa;
  return nota(E, st, b) > nota(E, st, a) ? 1 : 0;
}

function escolherCompra(E, st, pol = {}) {
  const itens = E.ITENS.filter((i) => i.loja === st.pend.loja && !st.kit.includes(i.id))
    .sort((a, b) => (pol.ordemCompra === 'cara' ? E.precoItem(st, b) - E.precoItem(st, a) : E.precoItem(st, a) - E.precoItem(st, b)));
  const ids = [];
  for (const i of itens) if (E.totalCompra(st, [...ids, i.id]).total <= st.saldo) ids.push(i.id);
  return ids;
}

function respostaDaCarta(E, st, p, rng) {
  const c = E.cartaMostrada ? E.cartaMostrada(st, st.pend.carta) : E.CARTAS.find((x) => x.id === st.pend.carta);
  if (rng() < p) return c.certa;
  const erradas = [0, 1, 2].filter((i) => i !== c.certa);
  return erradas[Math.floor(rng() * 2)];
}

// Joga uma rodada inteira de um jogador e devolve se ele teve alguma escolha de verdade.
function jogarRodada(E, ctx, id, pol, rng, ag) {
  const st = ctx.estados.get(id);
  let escolha = false;
  const op = E.opcoesDaRodada ? E.opcoesDaRodada(st) : { rolar: true, duplo: false, ajudar: false };
  if ([op.rolar, op.duplo, op.ajudar].filter(Boolean).length >= 2) escolha = true;
  let primeira = { t: 'rolar' };
  if (pol.duplo && op.duplo && st.saldo >= (pol.duploMin ?? 25) && st.kit.length < E.ITENS.length) primeira = { t: 'dado_duplo' };
  else if (pol.ajuda && op.ajudar && (pol.sempreAjuda || (st.saldo < 15 && st.kit.length < E.ITENS.length))) primeira = { t: 'ajudar' };
  ag(primeira);
  if (st.pend?.tipo === 'dado') ag({ t: 'escolher_dado', i: melhorDado(E, st, pol) });
  for (let guarda = 0; st.pend && guarda < 5; guarda++) {
    const t = st.pend.tipo;
    if (t === 'loja') {
      const ids = escolherCompra(E, st, pol);
      if (E.ITENS.some((i) => i.loja === st.pend.loja && !st.kit.includes(i.id))) escolha = true;
      ag(ids.length ? { t: 'comprar', itens: ids } : { t: 'sair_loja' });
    } else if (t === 'carta') {
      escolha = true;
      ag({ t: 'responder', i: respostaDaCarta(E, st, pol.conhecimento, rng) });
    } else if (t === 'perdido') {
      escolha = true;
      if (pol.pagaSempre || st.saldo >= st.pend.valor) ag({ t: 'pagar' });
      else ag({ t: E.arriscar ? 'arriscar' : 'ficar' });
    } else ag({ t: 'pagar' });
  }
  return escolha;
}

// Motor antigo (sem agirNaSala): mesmas ações, chamadas direto.
function acaoLegada(E, st, rng, m) {
  const fn = {
    rolar: () => E.rolar(st, rng), comprar: () => E.comprar(st, m.itens), sair_loja: () => E.sairDaLoja(st),
    responder: () => E.responder(st, m.i, rng), pagar: () => E.pagar(st), ficar: () => E.ficarParado(st),
  }[m.t];
  return fn();
}

/**
 * Joga uma partida com `politicas.length` jogadores. Com mais de um, é uma sala (cartas de sala e pontes).
 * Devolve, por jogador, o estado final e as medidas da partida.
 */
export function jogarPartida(E, politicas, { rodadas = 12, seed = 1 } = {}) {
  const rng = E.rngComSemente(seed * 7919 + 13);
  const sala = politicas.length > 1;
  const ctx = E.novoContexto ? E.novoContexto(sala ? {} : null) : { estados: new Map() };
  politicas.forEach((_, i) => {
    ctx.estados.set(i, E.novoJogador({ apelido: `J${i}`, ficha: 'f01', rodadas, seed, ordem: i, sala }));
  });
  const medidas = politicas.map(() => ({ semEscolha: 0, recusou: false, comemorou: false, cartasVistas: [] }));
  for (let r = 0; r < rodadas; r++) {
    politicas.forEach((pol, i) => {
      const st = ctx.estados.get(i);
      if (st.fim) return;
      let pendVisto = null;
      const ag = (m) => {
        const res = E.agirNaSala ? E.agirNaSala(ctx, i, m, rng) : acaoLegada(E, st, rng, m);
        if (res.erro) throw new Error(`${m.t}: ${res.erro}`);
        if (st.pend?.tipo === 'carta' && st.pend !== pendVisto) { pendVisto = st.pend; medidas[i].cartasVistas.push(st.pend.carta); }
        if (!st.stats && st.avisos.some((a) => /Pagamento de \d+ BC recusado/.test(a.texto))) medidas[i].recusou = true;
        return res;
      };
      if (!jogarRodada(E, ctx, i, pol, rng, ag)) medidas[i].semEscolha += 1;
      E.fecharRodada(st);
    });
  }
  return politicas.map((_, i) => {
    const st = ctx.estados.get(i), m = medidas[i];
    if (st.stats) m.recusou = st.stats.recusas > 0;
    m.comemorou = st.fogo > 0 || st.kit.length === E.ITENS.length || st.acertos > 0;
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

/** Das cartas tiradas em 3 partidas seguidas do mesmo jogador, quantas já tinham aparecido. */
export function medirRepeticao(E, { n = 1500, politica = REFERENCIA } = {}) {
  let tiradas = 0, repetidas = 0;
  for (let s = 1; s <= n; s++) {
    const vistas = new Set();
    for (let k = 0; k < 3; k++) {
      const [j] = jogarPartida(E, [politica], { seed: s * 3 + k });
      for (const c of j.cartasVistas) { tiradas += 1; if (vistas.has(c)) repetidas += 1; vistas.add(c); }
    }
  }
  return repetidas / tiradas;
}
