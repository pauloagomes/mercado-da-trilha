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
export const DADO_DUPLO_CUSTO = 5;
export const AJUDA_GANHO = 15;
export const GRATIFICACAO = 3;
export const PTS_CARTA = 10;
export const VERSAO_ESTADO = 2;
export const REACOES = ['Boa!', 'Uau', 'Ai!', 'Valeu', 'Bora', 'Fogo!'];
export const REACAO_INTERVALO_MS = 3000;
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
// O efeito acontece; acertar dá +10 pts, evita o revés das cartas de Tempestade e, em "Contador esperto", dá o crédito.
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

// Cartas de sala (A2): valem para todos os jogadores da sala e só saem em salas, nunca no jogo sozinho.
// Quem tirou a carta ganha 5 BC. Em carta de Tempestade, quem acerta a pergunta fica de fora do revés.
export const GANHO_CARTA_SALA = 5;
export const CARTAS_SALA = [
  { id: 'salamutirao', tipo: 'bussola', sala: true, titulo: 'Mutirão no acampamento',
    historia: 'Todo o acampamento fez um mutirão: cada conta recebe 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Todo mundo recebeu um crédito sem ter feito nada. Onde cada um confere o que entrou?',
    opcoes: ['No extrato da própria conta, com o saldo depois do crédito', 'Só o chefe do evento consegue ver', 'Só no fim do evento'],
    certa: 0, porque: 'Todo crédito entra no extrato e gera aviso na hora, mesmo quando você não fez nada.',
    efeitoSala: (alvo) => creditar(alvo, 10, 'Mutirão no acampamento') },
  { id: 'salajanta', tipo: 'bussola', sala: true, titulo: 'Janta da patrulha',
    historia: 'A janta rendeu bem: quem tem Panela ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Você tem 295 BC e recebe um crédito de 10 BC. O que acontece?',
    opcoes: ['O crédito é recusado inteiro', 'Entram 5 BC, até o limite', 'Entram os 10 BC e o limite sobe'],
    certa: 0, porque: 'O saldo máximo é 300 BC. Um crédito que passaria do limite é recusado inteiro.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('panela')) creditar(alvo, 10, 'Janta da patrulha'); } },
  { id: 'salachuva', tipo: 'tempestade', sala: true, titulo: 'Chuva no acampamento',
    historia: 'Choveu em todo o acampamento: quem não tem Lona paga 5 BC de reparo. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Chegou um aviso de gasto de 5 BC e você não fez nenhuma compra. O que fazer?',
    opcoes: ['Conferir o aviso e o extrato: o motivo está descrito ali', 'Ignorar, porque deve ser engano', 'Pedir o valor de volta ao colega ao lado'],
    certa: 0, porque: 'O aviso de gasto chega na hora, mesmo quando você não fez nada, e o extrato diz de onde veio.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('lona')) cobrarDaSala(alvo, 5, 'Reparo da chuva no acampamento'); } },
  { id: 'salaventania', tipo: 'tempestade', sala: true, titulo: 'Ventania',
    historia: 'Uma ventania derrubou as barracas: quem não tem Corda paga 5 BC. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Se o saldo não cobre um pagamento, o que a conta pré-paga faz?',
    opcoes: ['Recusa o pagamento: não existe saldo negativo', 'Deixa o saldo negativo para pagar depois', 'Pede emprestado a um colega'],
    certa: 0, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('corda')) cobrarDaSala(alvo, 5, 'Estragos da ventania'); } },
];

// Metas secretas (B3): cada jogador recebe uma e só a vê completa no fim. Premiam gastar com cuidado.
export const METAS = [
  { id: 'poupador',  nome: 'Termine com 80 BC ou mais', pts: 15, ok: (st) => st.saldo >= 80 },
  { id: 'lanterna',  nome: 'Compre a Lanterna antes da rodada 6', pts: 10, ok: (st) => st.stats.lanterna != null && st.stats.lanterna < 6 },
  { id: 'piso',      nome: 'Nunca fique abaixo de 20 BC', pts: 15, ok: (st) => st.stats.minSaldo >= 20 },
  { id: 'cartas',    nome: 'Acerte 3 cartas', pts: 10, ok: (st) => st.acertos >= 3 },
  { id: 'semrecusa', nome: 'Não tenha nenhum pagamento recusado', pts: 10, ok: (st) => st.stats.recusas === 0 },
  { id: 'cinco',     nome: 'Monte um kit com 5 itens ou mais', pts: 10, ok: (st) => st.kit.length >= 5 },
  { id: 'lojas',     nome: 'Compre em 3 lojas diferentes', pts: 10, ok: (st) => st.stats.lojas.length >= 3 },
  { id: 'fogo',      nome: 'Chegue ao Fogo de Conselho', pts: 10, ok: (st) => st.fogo > 0 },
  { id: 'ajuda',     nome: 'Ajude no acampamento 2 vezes', pts: 10, ok: (st) => st.stats.ajudas >= 2 },
  { id: 'rico',      nome: 'Chegue a 200 BC ou mais em algum momento', pts: 10, ok: (st) => st.stats.maxSaldo >= 200 },
  { id: 'semperder', nome: 'Não perca nenhuma rodada', pts: 10, ok: (st) => st.stats.perdidas === 0 },
  { id: 'duplo',     nome: 'Use o dado duplo 2 vezes', pts: 10, ok: (st) => st.stats.duplos >= 2 },
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

function hashTexto(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
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

// F1: a ordem das 3 opções de cada carta muda a cada partida, igual para a sala toda.
export function ordemOpcoes(seed, cartaId) {
  const r = rngComSemente((seed ^ hashTexto(cartaId)) >>> 0);
  const ordem = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem; // ordem[k] = índice original da opção mostrada na posição k
}

export function cartaPorId(id) { return CARTAS.find((c) => c.id === id) || CARTAS_SALA.find((c) => c.id === id); }

// A carta como o jogador vê: opções embaralhadas e "certa" apontando para a posição mostrada.
export function cartaMostrada(st, id) {
  const c = cartaPorId(id), ordem = ordemOpcoes(st.seed, id);
  return { ...c, opcoes: ordem.map((k) => c.opcoes[k]), certa: ordem.indexOf(c.certa) };
}

// B3: cada jogador da sala recebe uma meta diferente (até 12), na ordem embaralhada pela semente.
export function metaDoJogador(seed, ordem) {
  const r = rngComSemente((seed ^ 0x9E3779B9) >>> 0);
  const ids = METAS.map((m) => m.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids[ordem % ids.length];
}
export function metaCumprida(st) {
  const m = METAS.find((x) => x.id === st.meta);
  return !!m && m.ok(st);
}

// ---------- Estado de um jogador ----------
export function novoJogador({ apelido, ficha, rodadas = RODADAS_PADRAO, seed = 1, ordem = 0, sala = false }) {
  return {
    v: VERSAO_ESTADO, apelido, ficha, rodadas, seed, sala,
    pos: 0, rodada: 0, saldo: SALDO_INICIAL, kit: [], acertos: 0,
    skip: 0, desconto: 0, extra: 0,
    rolou: false, feito: false, dado: null, pend: null, resposta: null, ultimo: null,
    fim: false, fogo: 0,
    meta: metaDoJogador(seed, ordem),
    stats: { minSaldo: SALDO_INICIAL, maxSaldo: SALDO_INICIAL, recusas: 0, perdidas: 0, ajudas: 0, duplos: 0, lojas: [], lanterna: null },
    eventos: eventosDaPartida(seed, rodadas),
    extrato: [{ d: 'Saldo inicial', v: SALDO_INICIAL, s: SALDO_INICIAL }],
    avisos: [{ tipo: 'info', texto: `Bem-vindo, ${apelido}! Sua conta BadenCoin começa com ${SALDO_INICIAL} BC.` }],
    saida: [], // movimentos e jogadas novos, para o servidor gravar (o navegador ignora)
    cena: [],  // o que aconteceu na última jogada, para as telas animarem (quem chama esvazia)
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
  st.stats.minSaldo = Math.min(st.stats.minSaldo, st.saldo);
  st.stats.maxSaldo = Math.max(st.stats.maxSaldo, st.saldo);
}
function recusar(st, valor, d) {
  st.stats.recusas += 1;
  st.cena.push({ t: 'recusa', v: valor, d });
}

export function creditar(st, valor, d, tipo = 'credito') {
  if (st.saldo + valor > SALDO_MAX) {
    aviso(st, 'alerta', `Crédito de ${valor} BC recusado: a conta passaria do saldo máximo de ${SALDO_MAX} BC.`);
    st.cena.push({ t: 'recusa', v: valor, d, credito: true });
    return false;
  }
  const antes = st.saldo;
  st.saldo += valor;
  movimento(st, tipo, valor, d);
  aviso(st, 'ok', `+${valor} BC (${d}). Saldo: ${antes} → ${st.saldo} BC.`);
  st.cena.push({ t: 'credito', v: valor, d, saldo: st.saldo });
  return true;
}

const TIPO_DEBITO = { loja: 'compra', dado: 'dado_duplo', pedagio: 'pedagio' };

export function debitar(st, valor, d, onde) {
  if (st.saldo < valor) return false;
  st.saldo -= valor;
  movimento(st, TIPO_DEBITO[onde] || 'pedagio', -valor, d);
  aviso(st, 'gasto', `Gasto de ${valor} BC: ${d}. Saldo: ${st.saldo} BC.`);
  st.cena.push({ t: 'gasto', v: valor, d, saldo: st.saldo });
  return true;
}

function pagarOuParar(st, valor, d) {
  if (!debitar(st, valor, d, 'pedagio')) {
    st.skip = Math.max(st.skip, 1);
    recusar(st, valor, d);
    aviso(st, 'alerta', `Pagamento de ${valor} BC recusado: saldo de ${st.saldo} BC não cobre. Você perde a próxima rodada.`);
  }
}

// Cobrança que veio de uma carta de sala: o jogador não fez nada, então recusar não tira a vez dele.
function cobrarDaSala(st, valor, d) {
  if (!debitar(st, valor, d, 'pedagio')) {
    recusar(st, valor, d);
    aviso(st, 'alerta', `Pagamento de ${valor} BC recusado: saldo de ${st.saldo} BC não cobre (${d}).`);
  }
}

function andar(st, passos, resolver, rng) {
  const dir = passos < 0 ? -1 : 1, de = st.pos;
  let cruzou = false;
  for (let i = 0; i < Math.abs(passos); i++) {
    st.pos = (st.pos + dir + TABULEIRO.length) % TABULEIRO.length;
    if (dir > 0 && st.pos === 0) { cruzou = true; creditar(st, MESADA, 'Mesada da Partida'); }
  }
  st.cena.push({ t: 'andou', de, para: st.pos, passos, cruzou });
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

// Cartas que podem sair nesta casa: as de sala só aparecem em salas.
export function baralho(st, tipo) {
  return [...CARTAS, ...(st.sala ? CARTAS_SALA : [])].filter((c) => c.tipo === tipo);
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
    st.cena.push({ t: 'fogo' });
  } else if (CASAS[casa].loja) {
    if (lojaFechada(st, casa)) aviso(st, 'alerta', `${CASAS[casa].nome} está fechada por queda de energia.`);
    else st.pend = { tipo: 'loja', loja: casa };
  } else if (casa === 'pedagio') {
    st.pend = { tipo: 'pedagio', valor: 2 + Math.floor(rng() * 11) };
  } else if (casa === 'perdido') {
    st.pend = { tipo: 'perdido', valor: PERDIDO_TAXA };
  } else if (casa === 'bussola' || casa === 'tempestade') {
    const pool = baralho(st, casa);
    st.pend = { tipo: 'carta', carta: pool[Math.floor(rng() * pool.length)].id };
  }
  st.feito = !st.pend;
}

// ---------- Ações do jogador ----------
// Cada ação devolve { ok: true } ou { erro: 'mensagem' } e altera st no lugar.

// B1: o que o jogador pode escolher antes de rolar.
export function opcoesDaRodada(st) {
  if (st.fim || st.rolou) return { rolar: false, duplo: false, ajudar: false };
  if (st.skip > 0) return { rolar: true, duplo: false, ajudar: false };
  return { rolar: true, duplo: st.saldo >= DADO_DUPLO_CUSTO, ajudar: st.saldo + AJUDA_GANHO <= SALDO_MAX };
}

function registrarJogada(st, dado, rolagem) {
  st.saida.push({ k: 'jogada', rodada: rodadaAtual(st), dado, casa: TABULEIRO[st.pos], rolagem });
}

export function rolar(st, rng = Math.random) {
  if (st.fim) return { erro: 'A partida já terminou.' };
  if (st.rolou) return { erro: 'Você já jogou nesta rodada.' };
  st.rolou = true; st.resposta = null;
  if (st.skip > 0) {
    st.skip -= 1; st.dado = null; st.feito = true;
    st.stats.perdidas += 1;
    st.ultimo = 'Você perdeu esta rodada.';
    aviso(st, 'alerta', 'Rodada perdida.');
    st.cena.push({ t: 'perdeu' });
    registrarJogada(st, null, 'normal');
    return { ok: true };
  }
  const d = 1 + Math.floor(rng() * 6);
  st.dado = d;
  st.cena.push({ t: 'dado', v: [d] });
  andar(st, d, true, rng);
  st.ultimo = `Tirou ${d} e caiu em ${CASAS[TABULEIRO[st.pos]].nome}.`;
  registrarJogada(st, d, 'normal');
  return { ok: true };
}

// B1: paga 5 BC, rola dois dados e escolhe um deles.
export function dadoDuplo(st, rng = Math.random) {
  if (st.fim) return { erro: 'A partida já terminou.' };
  if (st.rolou) return { erro: 'Você já jogou nesta rodada.' };
  if (st.skip > 0) return { erro: 'Você está parado: esta rodada só passa.' };
  if (st.saldo < DADO_DUPLO_CUSTO) return { erro: `O dado duplo custa ${DADO_DUPLO_CUSTO} BC e você tem ${st.saldo} BC.` };
  debitar(st, DADO_DUPLO_CUSTO, 'Dado duplo', 'dado');
  st.rolou = true; st.resposta = null; st.feito = false;
  st.stats.duplos += 1;
  const a = 1 + Math.floor(rng() * 6), b = 1 + Math.floor(rng() * 6);
  st.pend = { tipo: 'dado', dados: [a, b] };
  st.cena.push({ t: 'dado', v: [a, b] });
  st.ultimo = `Dado duplo: saiu ${a} e ${b}. Escolha um.`;
  return { ok: true };
}

export function escolherDado(st, i, rng = Math.random) {
  if (!st.pend || st.pend.tipo !== 'dado') return { erro: 'Não há dado para escolher.' };
  if (i !== 0 && i !== 1) return { erro: 'Escolha um dos dois dados.' };
  const d = st.pend.dados[i];
  st.pend = null; st.dado = d;
  st.cena.push({ t: 'escolheu', v: d, i });
  andar(st, d, true, rng);
  st.ultimo = `Dado duplo: ficou com ${d} e caiu em ${CASAS[TABULEIRO[st.pos]].nome}.`;
  registrarJogada(st, d, 'duplo');
  return { ok: true };
}

// B1: não anda e ganha 15 BC (se a conta aguentar).
export function ajudar(st) {
  if (st.fim) return { erro: 'A partida já terminou.' };
  if (st.rolou) return { erro: 'Você já jogou nesta rodada.' };
  if (st.skip > 0) return { erro: 'Você está parado: esta rodada só passa.' };
  if (st.saldo + AJUDA_GANHO > SALDO_MAX) return { erro: `Sua conta passaria do saldo máximo de ${SALDO_MAX} BC. Role o dado.` };
  st.rolou = true; st.resposta = null; st.dado = null;
  st.stats.ajudas += 1;
  creditar(st, AJUDA_GANHO, 'Ajuda no acampamento');
  st.feito = true;
  st.ultimo = `Ajudou no acampamento e ganhou ${AJUDA_GANHO} BC.`;
  registrarJogada(st, null, 'ajuda');
  return { ok: true };
}

export function comprar(st, ids) {
  if (!st.pend || st.pend.tipo !== 'loja') return { erro: 'Você não está numa loja.' };
  const { itens, total } = totalCompra(st, ids || []);
  if (!itens.length) return { erro: 'Escolha pelo menos um item que ainda não está no seu kit.' };
  const nome = CASAS[st.pend.loja].nome;
  if (!debitar(st, total, `${itens.map((i) => i.nome).join(', ')} na ${nome}`, 'loja')) {
    recusar(st, total, nome);
    return { erro: `Compra recusada: você tem ${st.saldo} BC e a compra custa ${total} BC.` };
  }
  st.kit.push(...itens.map((i) => i.id));
  if (!st.stats.lojas.includes(st.pend.loja)) st.stats.lojas.push(st.pend.loja);
  if (itens.some((i) => i.id === 'lanterna') && st.stats.lanterna == null) st.stats.lanterna = rodadaAtual(st);
  st.desconto = 0; st.extra = 0;
  if (st.kit.length === ITENS.length) {
    aviso(st, 'ok', 'Kit de Acampamento completo! +20 pts.');
    st.cena.push({ t: 'kit' });
  }
  st.ultimo = `Comprou ${itens.map((i) => i.nome).join(', ')} por ${total} BC.`;
  st.pend = null; st.feito = true;
  return { ok: true };
}

export function sairDaLoja(st) {
  if (!st.pend || st.pend.tipo !== 'loja') return { erro: 'Você não está numa loja.' };
  st.pend = null; st.feito = true; st.ultimo = 'Saiu da loja sem comprar.';
  return { ok: true };
}

// A2: efeito de uma carta que vale para a sala toda. `estados` são os jogadores da sala.
export function cartaDeSala(estados, quem, c, ok) {
  for (const alvo of estados) {
    if (alvo.fim) continue;
    if (alvo !== quem) {
      aviso(alvo, 'info', `${quem.apelido} tirou "${c.titulo}": ${c.historia.split(' Quem tirou')[0]}`);
      alvo.cena.push({ t: 'sala', de: quem.apelido, carta: c.titulo });
    }
    const poupado = alvo === quem && ok && c.tipo === 'tempestade';
    if (poupado) aviso(alvo, 'ok', `Você acertou a pergunta e ficou de fora do revés "${c.titulo}".`);
    else c.efeitoSala(alvo);
  }
  creditar(quem, GANHO_CARTA_SALA, `Prêmio por tirar "${c.titulo}"`);
}

export function responder(st, i, rng = Math.random, estados = null) {
  if (!st.pend || st.pend.tipo !== 'carta') return { erro: 'Não há carta para responder.' };
  const c = cartaMostrada(st, st.pend.carta);
  const ok = i === c.certa;
  if (ok) st.acertos += 1;
  st.pend = null; st.feito = true;
  // B4: acertar uma carta de Tempestade evita o revés.
  const evitou = ok && c.tipo === 'tempestade';
  st.resposta = { carta: c.id, escolha: i, ok, evitou };
  st.cena.push({ t: 'carta', ok, evitou });
  if (c.sala) cartaDeSala(estados || [st], st, c, ok);
  else if (evitou) aviso(st, 'ok', `Você acertou a pergunta e evitou o revés "${c.titulo}".`);
  else c.efeito(st, ok, rng);
  st.ultimo = ok ? `Acertou a carta ${c.titulo}. +${PTS_CARTA} pts.` : `Errou a carta ${c.titulo}.`;
  return { ok: true };
}

// A1: quem paga o pedágio deixa o valor no caixa do evento, e o guardião da ponte ganha 3 BC de gratificação.
export function pagarPedagio(pagador, guardiao) {
  const { valor } = pagador.pend;
  if (!debitar(pagador, valor, 'Pedágio da Ponte (caixa do evento)', 'pedagio')) return false;
  if (guardiao && guardiao !== pagador && !guardiao.fim) {
    if (creditar(guardiao, GRATIFICACAO, `Gratificação de guardião: pedágio pago por ${pagador.apelido}`, 'gratificacao')) {
      guardiao.cena.push({ t: 'gratificacao', de: pagador.apelido });
    }
  }
  return true;
}

// Quem para num pedágio assume a ponte; o guardião anterior fica registrado para a gratificação.
export function assumirPonte(pontes, jogId, st) {
  if (!pontes || !st.pend || st.pend.tipo !== 'pedagio' || 'ponte' in st.pend) return;
  st.pend.ponte = st.pos;
  st.pend.guardiao = pontes[st.pos] && pontes[st.pos] !== jogId ? pontes[st.pos] : null;
  pontes[st.pos] = jogId;
  st.cena.push({ t: 'ponte', pos: st.pos });
}

export function pagar(st, guardiao = null) {
  if (!st.pend || (st.pend.tipo !== 'pedagio' && st.pend.tipo !== 'perdido')) return { erro: 'Não há nada para pagar.' };
  const { tipo, valor } = st.pend;
  const ok = tipo === 'pedagio' ? pagarPedagio(st, guardiao) : debitar(st, valor, 'Saída da trilha', 'pedagio');
  st.pend = null; st.feito = true;
  if (ok) st.ultimo = `Pagou ${valor} BC (${tipo === 'pedagio' ? 'Pedágio da Ponte' : 'Saída da trilha'}).`;
  else {
    st.skip = Math.max(st.skip, 1);
    recusar(st, valor, tipo);
    aviso(st, 'alerta', `Pagamento de ${valor} BC recusado: saldo de ${st.saldo} BC não cobre. Você perde a próxima rodada.`);
    st.ultimo = 'Sem saldo: perde a próxima rodada.';
  }
  return { ok: true };
}

// B2: no Perdido, em vez de pagar 10 BC, rola o dado: de 4 a 6 acha a trilha de graça, de 1 a 3 perde a próxima rodada.
export function arriscar(st, rng = Math.random) {
  if (!st.pend || st.pend.tipo !== 'perdido') return { erro: 'Você não está perdido.' };
  const d = 1 + Math.floor(rng() * 6);
  st.pend = null; st.feito = true;
  st.cena.push({ t: 'arriscou', v: d });
  if (d >= 4) {
    aviso(st, 'ok', `Tirou ${d}: você achou a trilha sem pagar nada.`);
    st.ultimo = `Arriscou, tirou ${d} e achou a trilha de graça.`;
  } else {
    st.skip = Math.max(st.skip, 1);
    aviso(st, 'alerta', `Tirou ${d}: continuou perdido e vai passar a próxima rodada procurando a trilha.`);
    st.ultimo = `Arriscou, tirou ${d} e perde a próxima rodada.`;
  }
  return { ok: true };
}

// Tempo esgotado (sala de espera): o sistema joga pelo jogador. Com `ctx`, vale o que vale na sala
// (cartas de sala e guardião da ponte); sem ele, é o jogo de uma pessoa só.
export function tempoEsgotado(st, rng = Math.random, ctx = null, id = null) {
  if (st.fim) return;
  if (!st.rolou) rolar(st, rng);
  if (st.pend?.tipo === 'dado') escolherDado(st, 0, rng);
  if (ctx) assumirPonte(ctx.pontes, id, st);
  if (st.pend) {
    if (st.pend.tipo === 'loja') sairDaLoja(st);
    else if (st.pend.tipo === 'carta') responder(st, -1, rng, ctx ? [...ctx.estados.values()] : null);
    else if (st.pend.tipo === 'pedagio') pagar(st, ctx?.estados.get(st.pend.guardiao) || null);
    else if (st.pend.tipo === 'perdido') { if (st.saldo >= st.pend.valor) pagar(st); else arriscar(st, rng); }
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
  const cartas = st.acertos * PTS_CARTA;
  const saldo = Math.floor(st.saldo / 10);
  // A meta secreta só conta quando a partida acaba, para não entregar a meta pelo placar.
  const meta = st.fim && metaCumprida(st) ? METAS.find((m) => m.id === st.meta).pts : 0;
  return { itens, kitCompleto, cartas, saldo, meta, total: itens + kitCompleto + cartas + saldo + meta };
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
    meta: st.fim ? { id: st.meta, ok: metaCumprida(st) } : null, // revelada só no fim
  };
}

// Visão do próprio jogador, sem a fila interna de gravação.
export function visaoPropria(st) {
  const { saida, ...resto } = st;
  return resto;
}

// ---------- Motor da sala ----------
// `ctx` = { estados: Map(id -> estado), pontes: { casa: id } | null }. As mesmas funções servem ao servidor,
// ao jogo sozinho (um só estado, sem pontes) e à simulação.
export function novoContexto(pontes = null) { return { estados: new Map(), pontes }; }

export function esvaziarCena(st) { const c = st.cena; st.cena = []; return c; }

const ACOES_MOTOR = {
  rolar: (st, m, rng) => rolar(st, rng),
  dado_duplo: (st, m, rng) => dadoDuplo(st, rng),
  escolher_dado: (st, m, rng) => escolherDado(st, Number(m.i), rng),
  ajudar: (st) => ajudar(st),
  comprar: (st, m) => comprar(st, Array.isArray(m.itens) ? m.itens.map(String).slice(0, 7) : []),
  sair_loja: (st) => sairDaLoja(st),
  responder: (st, m, rng, ctx) => responder(st, Number(m.i), rng, [...ctx.estados.values()]),
  pagar: (st, m, rng, ctx) => pagar(st, st.pend?.tipo === 'pedagio' ? ctx.estados.get(st.pend.guardiao) || null : null),
  arriscar: (st, m, rng) => arriscar(st, rng),
};
export const ACOES_DO_JOGO = Object.keys(ACOES_MOTOR);

// Aplica uma ação do jogador `id`. Devolve { erro } ou { ok, afetados: [ids que mudaram] }.
export function agirNaSala(ctx, id, msg, rng = Math.random) {
  const st = ctx.estados.get(id);
  const fn = ACOES_MOTOR[msg.t];
  if (!st || !fn) return { erro: 'Ação inválida.' };
  const antes = new Map([...ctx.estados].map(([k, s]) => [k, s.cena.length]));
  const r = fn(st, msg, rng, ctx);
  if (r.erro) return r;
  assumirPonte(ctx.pontes, id, st);
  const afetados = [...ctx.estados].filter(([k, s]) => k === id || s.cena.length !== antes.get(k)).map(([k]) => k);
  return { ok: true, afetados };
}
