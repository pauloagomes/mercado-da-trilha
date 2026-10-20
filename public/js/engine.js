// Mercado da Trilha — motor do jogo.
// Módulo puro, sem DOM e sem rede: roda no navegador (Jogar sozinho)
// e no servidor (salas), garantindo as mesmas regras nos dois lados.

export const MOEDA = 'BC';
export const SALDO_INICIAL = 100;
export const SALDO_MAX = 300;
export const MESADA = 30;
export const DEPOSITO = 40;
export const FOGO_BONUS = 20;
export const PERDIDO_TAXA = 10;
export const TEMPO_RODADA_S = 45;
export const RODADAS_OPCOES = [8, 12, 16];
export const RODADAS_PADRAO = 12;

export const CASAS = {
  partida:    { nome: 'Partida' },
  agencia:    { nome: 'Agência BadenCoin' },
  util:       { nome: 'Loja de utilidades', loja: true },
  exp:        { nome: 'Loja do Explorador', loja: true },
  enf:        { nome: 'Enfermaria', loja: true },
  pedagio:    { nome: 'Pedágio da Ponte' },
  bussola:    { nome: 'Bússola' },
  tempestade: { nome: 'Tempestade' },
  perdido:    { nome: 'Perdido na Trilha' },
  fogo:       { nome: 'Fogo de Conselho' },
};

// 20 casas, sentido horário a partir da Partida.
export const TABULEIRO = [
  'partida', 'util', 'bussola', 'exp', 'tempestade', 'perdido', 'agencia', 'util', 'pedagio', 'tempestade',
  'enf', 'exp', 'fogo', 'util', 'pedagio', 'agencia', 'bussola', 'exp', 'enf', 'tempestade',
];

export const ITENS = [
  { id: 'corda',    nome: 'Corda',                  loja: 'util', preco: 15 },
  { id: 'lona',     nome: 'Lona',                   loja: 'util', preco: 25 },
  { id: 'panela',   nome: 'Panela',                 loja: 'util', preco: 20 },
  { id: 'mapa',     nome: 'Mapa',                   loja: 'exp',  preco: 10 },
  { id: 'bussola',  nome: 'Bússola',                loja: 'exp',  preco: 18 },
  { id: 'lanterna', nome: 'Lanterna',               loja: 'exp',  preco: 22 },
  { id: 'kitps',    nome: 'Kit primeiros socorros', loja: 'enf',  preco: 30 },
];
export const LOJAS = ['util', 'exp', 'enf'];

export const FICHAS = [
  { id: 'f01', nome: 'Lobinha de tranças' },
  { id: 'f02', nome: 'Lobinho de boné' },
  { id: 'f03', nome: 'Escoteira de cabelo cacheado' },
  { id: 'f04', nome: 'Escoteiro de óculos' },
  { id: 'f05', nome: 'Escoteira de hijab' },
  { id: 'f06', nome: 'Escoteiro cadeirante' },
  { id: 'f07', nome: 'Sênior de cabelo crespo' },
  { id: 'f08', nome: 'Sênior de cabelo liso' },
  { id: 'f09', nome: 'Pioneira de rabo de cavalo' },
  { id: 'f10', nome: 'Pioneiro de barba' },
  { id: 'f11', nome: 'Chefe de chapéu' },
  { id: 'f12', nome: 'Chefe de cabelos brancos' },
];

// Cartas: cada uma tem uma situação, uma pergunta de 3 opções e um efeito.
// O efeito sempre acontece; acertar dá +5 pts (e, em "Contador esperto", o crédito).
// "app" é a linha opcional que liga a regra ao Trilha HUB, mostrada depois da resposta.
export const CARTAS = [
  { id: 'vovo', tipo: 'bussola', titulo: 'Mesada do Vovô',
    historia: 'O avô mandou 30 BC de presente para a sua conta.',
    pergunta: 'Se esse presente fizesse a conta passar de 300 BC, o que aconteceria?',
    opcoes: ['O crédito entraria só até 300 BC', 'O crédito seria recusado inteiro', 'O crédito entraria inteiro'],
    certa: 1, porque: 'O saldo máximo é 300 BC. Um crédito que passaria do limite é recusado inteiro.',
    app: 'A carteira de evento do Trilha HUB também tem saldo máximo por participante.',
    efeito: (st) => creditar(st, 30, 'Presente do Vovô') },
  { id: 'contador', tipo: 'bussola', titulo: 'Contador esperto',
    historia: 'O Banco premia quem sabe onde conferir cada movimentação.',
    pergunta: 'Onde você confere cada entrada e saída da sua conta?',
    opcoes: ['No extrato', 'Só no placar', 'Em lugar nenhum'],
    certa: 0, porque: 'O extrato mostra cada movimentação e o saldo depois dela.',
    app: 'No Trilha HUB, o extrato completo chega por link no WhatsApp.',
    efeito: (st, ok) => { if (ok) creditar(st, 10, 'Prêmio do Contador esperto'); } },
  { id: 'ajudante', tipo: 'bussola', titulo: 'Ajudante da Loja de utilidades',
    historia: 'Você ajudou a montar a Loja de utilidades e ganhou 20 BC.',
    pergunta: 'Onde esse crédito aparece?',
    opcoes: ['No extrato, com o saldo depois dele', 'Só no fim do jogo', 'Não aparece'],
    certa: 0, porque: 'Todo crédito entra no extrato na hora, com o saldo atualizado.',
    efeito: (st) => creditar(st, 20, 'Ajuda na Loja de utilidades') },
  { id: 'promo', tipo: 'bussola', titulo: 'Promoção relâmpago',
    historia: 'Sua próxima compra sai 5 BC mais barata.',
    pergunta: 'Como saber quanto foi cobrado de verdade?',
    opcoes: ['Pelo aviso de gasto, que mostra o valor e o saldo', 'Perguntando a outro jogador', 'Não dá para saber'],
    certa: 0, porque: 'Cada gasto gera um aviso com o valor cobrado e o saldo que sobrou.',
    efeito: (st) => { st.desconto = 5; aviso(st, 'info', 'Promoção guardada: 5 BC de desconto na próxima compra.'); } },
  { id: 'achado', tipo: 'bussola', titulo: 'Achado devolvido',
    historia: 'Você achou uma carteira no chão e devolveu ao dono, que agradeceu com 15 BC.',
    pergunta: 'Se você achar o cartão ou o QR de pagamento de outra pessoa no acampamento, o que faz?',
    opcoes: ['Usa até acabar o saldo', 'Entrega para a chefia ou para o caixa do evento', 'Guarda para você'],
    certa: 1, porque: 'O saldo é de outra pessoa. Entregar para a chefia permite bloquear e devolver.',
    efeito: (st) => creditar(st, 15, 'Agradecimento pelo achado') },
  { id: 'mutirao', tipo: 'bussola', titulo: 'Mutirão da patrulha',
    historia: 'A patrulha fez um mutirão e você avança 3 casas.',
    pergunta: 'Na carteira do evento, quem pode gastar o saldo da sua conta?',
    opcoes: ['Qualquer pessoa', 'Só quem tem o seu QR ou pulseira vinculada', 'Só os chefes'],
    certa: 1, porque: 'Só gasta quem apresenta um QR ligado à sua conta. Por isso eles devem ser bem guardados.',
    app: 'No Trilha HUB, cada pulseira vinculada aparece no aviso de gasto com o apelido dela.',
    efeito: (st) => andar(st, 3, false) },
  { id: 'celular', tipo: 'tempestade', titulo: 'Celular caiu na barraca',
    historia: 'O celular caiu na barraca e você passa a próxima rodada procurando.',
    pergunta: 'Por que cuidar bem do celular no acampamento?',
    opcoes: ['Porque nele estão a conta e os avisos de gasto', 'Porque o jogo precisa dele', 'Não faz diferença'],
    certa: 0, porque: 'A conta e os avisos ficam no celular. Perder o aparelho é perder o controle dos gastos.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você vai passar a próxima rodada procurando o celular.'); } },
  { id: 'lojista', tipo: 'tempestade', titulo: 'Lojista distraído',
    historia: 'O lojista está distraído: sua próxima compra vai custar 5 BC a mais.',
    pergunta: 'Como perceber um valor errado?',
    opcoes: ['Conferindo o aviso de gasto logo depois da compra', 'Esperando o fim do evento', 'Não tem como'],
    certa: 0, porque: 'O aviso de gasto chega na hora. Conferir na hora é o jeito de pegar erros.',
    efeito: (st) => { st.extra = 5; aviso(st, 'alerta', 'Atenção: a próxima compra vai custar 5 BC a mais.'); } },
  { id: 'ponte', tipo: 'tempestade', titulo: 'Ponte quebrada',
    historia: 'A ponte quebrou e você paga 8 BC de pedágio extra.',
    pergunta: 'Pedágio é um gasto de valor avulso. O que acontece se o saldo não cobrir?',
    opcoes: ['O saldo fica negativo', 'O pagamento é recusado', 'Paga depois'],
    certa: 1, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado.',
    efeito: (st) => pagarOuParar(st, 8, 'Pedágio extra da ponte quebrada') },
  { id: 'chuva', tipo: 'tempestade', titulo: 'Chuva forte',
    historia: 'Chuva forte na trilha! Você volta 2 casas.',
    pergunta: 'Antes de gastar, o que vale a pena conferir?',
    opcoes: ['O saldo da conta', 'A previsão do tempo', 'Nada'],
    certa: 0, porque: 'Conferir o saldo antes evita compras recusadas.',
    efeito: (st) => andar(st, -2, false) },
  { id: 'lona', tipo: 'tempestade', titulo: 'Furou a lona da barraca',
    historia: 'A lona da barraca furou e o conserto custa 5 BC.',
    pergunta: 'Um gasto inesperado apareceu. Onde ele fica registrado?',
    opcoes: ['No extrato e no aviso de gasto', 'Em lugar nenhum', 'Só num papel'],
    certa: 0, porque: 'Todo gasto, até o inesperado, entra no extrato e gera aviso.',
    efeito: (st) => pagarOuParar(st, 5, 'Conserto da lona') },
];

// ---------- Aleatoriedade com semente (eventos iguais para toda a sala) ----------
export function rngComSemente(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function eventosDaPartida(seed, rodadas) {
  const r = rngComSemente(seed);
  const l1 = LOJAS[Math.floor(r() * LOJAS.length)];
  const l2 = LOJAS[Math.floor(r() * LOJAS.length)];
  return {
    fechada: { rodada: Math.max(2, Math.round(rodadas * 0.35)), loja: l1, duracao: 2 },
    feira:   { rodada: Math.max(3, Math.round(rodadas * 0.65)), loja: l2, duracao: 2, desconto: 5 },
  };
}

// ---------- Estado de um jogador ----------
export function novoJogador({ apelido, ficha, rodadas = RODADAS_PADRAO, seed = 1 }) {
  return {
    v: 1, apelido, ficha, rodadas,
    pos: 0, rodada: 0, saldo: SALDO_INICIAL, kit: [], acertos: 0,
    skip: 0, desconto: 0, extra: 0,
    rolou: false, feito: false, dado: null, pend: null, resposta: null, ultimo: null,
    fim: false, fogo: 0,
    eventos: eventosDaPartida(seed, rodadas),
    extrato: [{ d: 'Saldo inicial', v: SALDO_INICIAL, s: SALDO_INICIAL }],
    avisos: [{ tipo: 'info', texto: `Bem-vindo, ${apelido}! Sua conta BadenCoin começa com ${SALDO_INICIAL} BC.` }],
    saida: [], // movimentos e jogadas novos, para o servidor gravar (o navegador ignora)
  };
}

export function rodadaAtual(st) { return Math.min(st.rodada + 1, st.rodadas); }

function aviso(st, tipo, texto) {
  st.avisos.push({ tipo, texto });
  if (st.avisos.length > 12) st.avisos = st.avisos.slice(-12);
}
function movimento(st, tipo, valor, d) {
  st.extrato.push({ d, v: valor, s: st.saldo });
  if (st.extrato.length > 10) st.extrato = st.extrato.slice(-10);
  st.saida.push({ k: 'mov', tipo, valor, saldo: st.saldo, d });
}

export function creditar(st, valor, d) {
  if (st.saldo + valor > SALDO_MAX) {
    aviso(st, 'alerta', `Crédito de ${valor} BC recusado: a conta passaria do saldo máximo de ${SALDO_MAX} BC.`);
    return false;
  }
  const antes = st.saldo;
  st.saldo += valor;
  movimento(st, 'credito', valor, d);
  aviso(st, 'ok', `+${valor} BC (${d}). Saldo: ${antes} → ${st.saldo} BC.`);
  return true;
}

export function debitar(st, valor, d, onde) {
  if (st.saldo < valor) return false;
  st.saldo -= valor;
  movimento(st, onde === 'loja' ? 'compra' : 'pedagio', -valor, d);
  aviso(st, 'gasto', `Gasto de ${valor} BC: ${d}. Saldo: ${st.saldo} BC.`);
  return true;
}

function pagarOuParar(st, valor, d) {
  if (!debitar(st, valor, d, 'pedagio')) {
    st.skip = Math.max(st.skip, 1);
    aviso(st, 'alerta', `Pagamento de ${valor} BC recusado: saldo de ${st.saldo} BC não cobre. Você perde a próxima rodada.`);
  }
}

function andar(st, passos, resolver, rng) {
  const dir = passos < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(passos); i++) {
    st.pos = (st.pos + dir + TABULEIRO.length) % TABULEIRO.length;
    if (dir > 0 && st.pos === 0) creditar(st, MESADA, 'Mesada da Partida');
  }
  if (resolver) resolverCasa(st, rng);
}

export function lojaFechada(st, loja) {
  const e = st.eventos.fechada, n = rodadaAtual(st);
  return e.loja === loja && n >= e.rodada && n < e.rodada + e.duracao;
}
export function descontoFeira(st, loja) {
  const e = st.eventos.feira, n = rodadaAtual(st);
  return e.loja === loja && n >= e.rodada && n < e.rodada + e.duracao ? e.desconto : 0;
}
export function precoItem(st, item) { return Math.max(0, item.preco - descontoFeira(st, item.loja)); }

export function totalCompra(st, ids) {
  const itens = ITENS.filter((i) => ids.includes(i.id) && !st.kit.includes(i.id) && st.pend && i.loja === st.pend.loja);
  if (!itens.length) return { itens, total: 0 };
  const bruto = itens.reduce((s, i) => s + precoItem(st, i), 0);
  return { itens, total: Math.max(0, bruto - st.desconto + st.extra) };
}

function resolverCasa(st, rng) {
  const casa = TABULEIRO[st.pos];
  st.pend = null;
  if (casa === 'agencia') {
    if (st.saldo + DEPOSITO > SALDO_MAX) aviso(st, 'alerta', `Depósito de ${DEPOSITO} BC recusado: a conta passaria de ${SALDO_MAX} BC.`);
    else creditar(st, DEPOSITO, 'Depósito na Agência BadenCoin');
  } else if (casa === 'fogo') {
    creditar(st, FOGO_BONUS, 'Fogo de Conselho');
    st.fogo += 1;
  } else if (CASAS[casa].loja) {
    if (lojaFechada(st, casa)) aviso(st, 'alerta', `${CASAS[casa].nome} está fechada por queda de energia.`);
    else st.pend = { tipo: 'loja', loja: casa };
  } else if (casa === 'pedagio') {
    st.pend = { tipo: 'pedagio', valor: 2 + Math.floor(rng() * 11) };
  } else if (casa === 'perdido') {
    st.pend = { tipo: 'perdido', valor: PERDIDO_TAXA };
  } else if (casa === 'bussola' || casa === 'tempestade') {
    const pool = CARTAS.filter((c) => c.tipo === casa);
    st.pend = { tipo: 'carta', carta: pool[Math.floor(rng() * pool.length)].id };
  }
  st.feito = !st.pend;
}

// ---------- Ações do jogador ----------
// Cada ação devolve { ok: true } ou { erro: 'mensagem' } e altera st no lugar.
export function rolar(st, rng = Math.random) {
  if (st.fim) return { erro: 'A partida já terminou.' };
  if (st.rolou) return { erro: 'Você já rolou o dado nesta rodada.' };
  st.rolou = true; st.resposta = null;
  if (st.skip > 0) {
    st.skip -= 1; st.dado = null; st.feito = true;
    st.ultimo = 'Você perdeu esta rodada.';
    aviso(st, 'alerta', 'Rodada perdida.');
    st.saida.push({ k: 'jogada', rodada: rodadaAtual(st), dado: null, casa: TABULEIRO[st.pos] });
    return { ok: true };
  }
  const d = 1 + Math.floor(rng() * 6);
  st.dado = d;
  andar(st, d, true, rng);
  st.ultimo = `Tirou ${d} e caiu em ${CASAS[TABULEIRO[st.pos]].nome}.`;
  st.saida.push({ k: 'jogada', rodada: rodadaAtual(st), dado: d, casa: TABULEIRO[st.pos] });
  return { ok: true };
}

export function comprar(st, ids) {
  if (!st.pend || st.pend.tipo !== 'loja') return { erro: 'Você não está numa loja.' };
  const { itens, total } = totalCompra(st, ids || []);
  if (!itens.length) return { erro: 'Escolha pelo menos um item que ainda não está no seu kit.' };
  const nome = CASAS[st.pend.loja].nome;
  if (!debitar(st, total, `${itens.map((i) => i.nome).join(', ')} na ${nome}`, 'loja')) {
    return { erro: `Compra recusada: você tem ${st.saldo} BC e a compra custa ${total} BC.` };
  }
  st.kit.push(...itens.map((i) => i.id));
  st.desconto = 0; st.extra = 0;
  if (st.kit.length === ITENS.length) aviso(st, 'ok', 'Kit de Acampamento completo! +20 pts.');
  st.ultimo = `Comprou ${itens.map((i) => i.nome).join(', ')} por ${total} BC.`;
  st.pend = null; st.feito = true;
  return { ok: true };
}

export function sairDaLoja(st) {
  if (!st.pend || st.pend.tipo !== 'loja') return { erro: 'Você não está numa loja.' };
  st.pend = null; st.feito = true; st.ultimo = 'Saiu da loja sem comprar.';
  return { ok: true };
}

export function responder(st, i, rng = Math.random) {
  if (!st.pend || st.pend.tipo !== 'carta') return { erro: 'Não há carta para responder.' };
  const c = CARTAS.find((x) => x.id === st.pend.carta);
  const ok = i === c.certa;
  if (ok) st.acertos += 1;
  st.pend = null; st.feito = true;
  st.resposta = { carta: c.id, escolha: i, ok };
  c.efeito(st, ok, rng);
  st.ultimo = ok ? `Acertou a carta ${c.titulo}. +5 pts.` : `Errou a carta ${c.titulo}.`;
  return { ok: true };
}

export function pagar(st) {
  if (!st.pend || (st.pend.tipo !== 'pedagio' && st.pend.tipo !== 'perdido')) return { erro: 'Não há nada para pagar.' };
  const { tipo, valor } = st.pend;
  st.pend = null; st.feito = true;
  const d = tipo === 'pedagio' ? 'Pedágio da Ponte' : 'Saída da trilha';
  if (debitar(st, valor, d, 'pedagio')) st.ultimo = `Pagou ${valor} BC (${d}).`;
  else {
    st.skip = Math.max(st.skip, 1);
    aviso(st, 'alerta', `Pagamento de ${valor} BC recusado: saldo de ${st.saldo} BC não cobre. Você perde a próxima rodada.`);
    st.ultimo = 'Sem saldo: perde a próxima rodada.';
  }
  return { ok: true };
}

export function ficarParado(st) {
  if (!st.pend || st.pend.tipo !== 'perdido') return { erro: 'Você não está perdido.' };
  st.pend = null; st.feito = true; st.skip = Math.max(st.skip, 1);
  st.ultimo = 'Ficou parado na trilha: perde a próxima rodada.';
  return { ok: true };
}

// Tempo esgotado (sala de espera): o sistema joga pelo jogador.
export function tempoEsgotado(st, rng = Math.random) {
  if (st.fim) return;
  if (!st.rolou) rolar(st, rng);
  if (st.pend) {
    if (st.pend.tipo === 'loja') sairDaLoja(st);
    else if (st.pend.tipo === 'carta') responder(st, -1, rng);
    else if (st.pend.tipo === 'pedagio') pagar(st);
    else if (st.pend.tipo === 'perdido') { if (st.saldo >= st.pend.valor) pagar(st); else ficarParado(st); }
  }
  st.ultimo = (st.ultimo ? st.ultimo + ' ' : '') + '(Tempo esgotado: o sistema jogou por você.)';
}

// Fecha a rodada do jogador. Devolve false se ele ainda não terminou a jogada.
export function fecharRodada(st) {
  if (!st.feito || st.fim) return false;
  st.rodada += 1; st.rolou = false; st.feito = false;
  if (st.rodada >= st.rodadas) {
    st.fim = true;
    aviso(st, 'info', 'Fim do mercado! A conta foi congelada e o que sobrou vira pontos.');
    return true;
  }
  const n = rodadaAtual(st), ef = st.eventos.fechada, fe = st.eventos.feira;
  if (n === ef.rodada) aviso(st, 'alerta', `Queda de energia: a ${CASAS[ef.loja].nome} fica fechada nas rodadas ${ef.rodada} e ${ef.rodada + 1}.`);
  if (n === fe.rodada) aviso(st, 'info', `Feira! ${CASAS[fe.loja].nome} com ${fe.desconto} BC de desconto por item nas rodadas ${fe.rodada} e ${fe.rodada + 1}.`);
  return true;
}

export function pontuacao(st) {
  const itens = st.kit.length * 10;
  const kitCompleto = st.kit.length === ITENS.length ? 20 : 0;
  const cartas = st.acertos * 5;
  const saldo = Math.floor(st.saldo / 10);
  return { itens, kitCompleto, cartas, saldo, total: itens + kitCompleto + cartas + saldo };
}

// Ordena o placar: pontos; desempate por saldo final e depois por cartas acertadas.
export function compararPlacar(a, b) {
  return (b.pontos - a.pontos) || (b.saldo - a.saldo) || (b.acertos - a.acertos);
}

// Visão pública de um jogador (o que os outros veem no placar).
export function resumoPublico(st) {
  return {
    apelido: st.apelido, ficha: st.ficha, pos: st.pos, rodada: st.rodada, fim: st.fim,
    pontos: pontuacao(st).total, saldo: st.saldo, acertos: st.acertos, kit: st.kit.length,
  };
}

// Visão do próprio jogador, sem a fila interna de gravação.
export function visaoPropria(st) {
  const { saida, ...resto } = st;
  return resto;
}
