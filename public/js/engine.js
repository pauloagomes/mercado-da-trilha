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
export const VERSAO_ESTADO = 5;
export const MISSAO_PTS = 15;         // F6: quem cumpre a missão da sala primeiro
export const NOITE_RODADAS = 3;        // C4: nas últimas 3 rodadas créditos e acertos valem em dobro
export const DESCONTO_FEIRA = 5;
export const LANCES = [0, 10, 20, 30, 40];
export const CANIVETE_PTS = 15;
export const VOTO_S = 10;              // A5 e C3: janela de 10 s entre duas rodadas
export const REACOES = ['Boa!', 'Uau', 'Ai!', 'Valeu', 'Bora', 'Fogo!'];
export const REACAO_INTERVALO_MS = 3000;
export const TEMPO_RODADA_S = 20;   // C6: 20 s para jogar, mais 20 s se cair numa loja ou carta
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
  troca:      { nome: 'Feira de Trocas' },
};

// 20 casas, sentido horário a partir da Partida.
export const TABULEIRO = [
  'partida', 'util', 'bussola', 'exp', 'tempestade', 'perdido', 'agencia', 'util', 'pedagio', 'tempestade',
  'enf', 'exp', 'fogo', 'util', 'pedagio', 'troca', 'bussola', 'exp', 'enf', 'tempestade',
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
    opcoes: ['No extrato', 'No aviso de gasto, que some depois de 24 horas', 'Só o chefe do evento vê'],
    certa: 0, porque: 'O extrato mostra cada movimentação e o saldo depois dela.',
    app: 'No Trilha HUB, o extrato completo chega por link no WhatsApp.',
    efeito: (st, ok) => { if (ok) creditar(st, 10, 'Prêmio do Contador esperto'); } },
  { id: 'ajudante', tipo: 'bussola', titulo: 'Ajudante da Loja de utilidades',
    historia: 'Você ajudou a montar a Loja de utilidades e ganhou 20 BC.',
    pergunta: 'Onde esse crédito aparece?',
    opcoes: ['No extrato, com o saldo depois dele', 'Só quando o evento acaba', 'Só se você pedir um comprovante'],
    certa: 0, porque: 'Todo crédito entra no extrato na hora, com o saldo atualizado.',
    efeito: (st) => creditar(st, 20, 'Ajuda na Loja de utilidades') },
  { id: 'promo', tipo: 'bussola', titulo: 'Promoção relâmpago',
    historia: 'Sua próxima compra sai 5 BC mais barata.',
    pergunta: 'Como saber quanto foi cobrado de verdade?',
    opcoes: ['Pelo aviso de gasto, que mostra o valor e o saldo', 'Pelo preço que estava na vitrine', 'Só no fim do evento, no extrato final'],
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
    opcoes: ['Porque nele estão a conta e os avisos de gasto', 'Porque a carteira só funciona com o celular ligado à tomada', 'Porque o saldo some se o celular for desligado'],
    certa: 0, porque: 'A conta e os avisos ficam no celular. Perder o aparelho é perder o controle dos gastos.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você vai passar a próxima rodada procurando o celular.'); } },
  { id: 'lojista', tipo: 'tempestade', titulo: 'Lojista distraído',
    historia: 'O lojista está distraído: sua próxima compra vai custar 5 BC a mais.',
    pergunta: 'Como perceber um valor errado?',
    opcoes: ['Conferindo o aviso de gasto logo depois da compra', 'Conferindo só o saldo no fim do evento', 'Pedindo o troco em dinheiro'],
    certa: 0, porque: 'O aviso de gasto chega na hora. Conferir na hora é o jeito de pegar erros.',
    efeito: (st) => { st.extra = 5; aviso(st, 'alerta', 'Atenção: a próxima compra vai custar 5 BC a mais.'); } },
  { id: 'ponte', tipo: 'tempestade', titulo: 'Ponte quebrada',
    historia: 'A ponte quebrou e você paga 8 BC de pedágio extra.',
    pergunta: 'Pedágio é um gasto de valor avulso. O que acontece se o saldo não cobrir?',
    opcoes: ['O saldo fica negativo', 'O pagamento é recusado', 'Paga depois'],
    certa: 1, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado.',
    efeito: (st) => { if (!protegido(st, 'corda', 'a ponte quebrada não te atrasou')) pagarOuParar(st, 8, 'Pedágio extra da ponte quebrada'); } },
  { id: 'chuva', tipo: 'tempestade', titulo: 'Chuva forte',
    historia: 'Chuva forte na trilha! Você volta 2 casas.',
    pergunta: 'Antes de gastar, o que vale a pena conferir?',
    opcoes: ['O saldo da conta', 'O limite de crédito disponível', 'A data de validade da pulseira'],
    certa: 0, porque: 'Conferir o saldo antes evita compras recusadas.',
    efeito: (st) => andar(st, -2, false) },
  { id: 'lona', tipo: 'tempestade', titulo: 'Furou a lona da barraca',
    historia: 'A lona da barraca furou e o conserto custa 5 BC.',
    pergunta: 'Um gasto inesperado apareceu. Onde ele fica registrado?',
    opcoes: ['No extrato e no aviso de gasto', 'Só no aviso, e some do extrato', 'Só no caixa do evento'],
    certa: 0, porque: 'Todo gasto, até o inesperado, entra no extrato e gera aviso.',
    efeito: (st) => { if (!protegido(st, 'lona', 'a barraca não furou')) pagarOuParar(st, 5, 'Conserto da lona'); } },
  { id: 'machucado', tipo: 'tempestade', titulo: 'Machucado na trilha',
    historia: 'Você se machucou na trilha e o curativo custa 10 BC.',
    pergunta: 'O curativo foi cobrado e você não reconhece o valor. O que fazer?',
    opcoes: ['Conferir o aviso de gasto e o extrato, e falar com a chefia', 'Esperar o fim do evento para reclamar', 'Pagar de novo para compensar'],
    certa: 0, porque: 'O aviso de gasto e o extrato mostram o que foi cobrado, na hora. Com isso a chefia confere o valor.',
    efeito: (st) => { if (!protegido(st, 'kitps', 'o curativo estava no kit')) pagarOuParar(st, 10, 'Curativo'); } },
  // ---- F3: mais 6 cartas de Bússola e 6 de Tempestade, sobre o que a carteira de evento faz ----
  { id: 'pix', tipo: 'bussola', titulo: 'Recarga por Pix',
    historia: 'Os seus responsáveis fizeram uma recarga por Pix de 25 BC.',
    pergunta: 'Quem põe dinheiro na sua conta durante o evento?',
    opcoes: ['Os responsáveis, por Pix, pelo link da carteira', 'Só a chefia, em dinheiro vivo no caixa', 'Qualquer colega, pelo QR dele'],
    certa: 0, porque: 'Os responsáveis recarregam por Pix e o valor entra na conta na hora, sem levar dinheiro vivo.',
    app: 'No Trilha HUB, a recarga por Pix é feita pelos responsáveis.',
    efeito: (st) => creditar(st, 25, 'Recarga dos responsáveis por Pix') },
  { id: 'whatsapp', tipo: 'bussola', titulo: 'Bônus de pontualidade',
    historia: 'Você chegou na hora à formatura e ganhou 10 BC.',
    pergunta: 'Quando você gasta no evento, quem recebe o aviso?',
    opcoes: ['Os responsáveis, no WhatsApp, com valor e saldo', 'Só o caixa do evento, no fim do dia', 'Ninguém: só você vê no extrato'],
    certa: 0, porque: 'O aviso de gasto chega na hora ao WhatsApp dos responsáveis, com o valor e o saldo.',
    app: 'No Trilha HUB, cada gasto avisa os responsáveis no WhatsApp.',
    efeito: (st) => creditar(st, 10, 'Bônus de pontualidade') },
  { id: 'extratolink', tipo: 'bussola', titulo: 'Extrato no bolso',
    historia: 'Você guardou o extrato do dia e ganhou 12 BC pela boa organização.',
    pergunta: 'Como os responsáveis veem todos os gastos do acampamento?',
    opcoes: ['Por um link de extrato enviado no WhatsApp', 'Pedindo o papel do extrato ao caixa', 'Só olhando o celular do jovem'],
    certa: 0, porque: 'O extrato completo vai por link no WhatsApp, e cada movimentação aparece com o saldo depois dela.',
    app: 'No Trilha HUB, o extrato completo chega por link no WhatsApp.',
    efeito: (st) => creditar(st, 12, 'Prêmio de organização') },
  { id: 'pulseira', tipo: 'bussola', titulo: 'Pulseira nova',
    historia: 'A chefia vinculou a sua pulseira à conta e deu 15 BC de boas-vindas.',
    pergunta: 'Você paga com a pulseira. Como o responsável sabe qual foi usada?',
    opcoes: ['O aviso de gasto mostra o apelido da pulseira', 'O aviso mostra só o valor', 'O aviso mostra só o nome do lojista'],
    certa: 0, porque: 'Cada pulseira vinculada tem um apelido, e ele aparece no aviso de gasto.',
    app: 'No Trilha HUB, cada pulseira vinculada aparece no aviso de gasto com o apelido dela.',
    efeito: (st) => creditar(st, 15, 'Boas-vindas da pulseira') },
  { id: 'teto', tipo: 'bussola', titulo: 'Sobra do patrulheiro',
    historia: 'O seu patrulheiro devolveu uma sobra e mandou 20 BC para a sua conta.',
    pergunta: 'Você tem 290 BC e chega um crédito de 20 BC. O que acontece?',
    opcoes: ['O crédito é recusado inteiro', 'Entram só 10 BC, até o limite', 'O limite da conta sobe para 310 BC'],
    certa: 0, porque: 'O saldo máximo é 300 BC. Um crédito que passaria do limite é recusado inteiro, e o aviso explica o motivo.',
    efeito: (st) => creditar(st, 20, 'Sobra devolvida pelo patrulheiro') },
  { id: 'prepago', tipo: 'bussola', titulo: 'Economia premiada',
    historia: 'A chefia premiou quem economizou: você ganha 10 BC.',
    pergunta: 'Você tenta pagar 25 BC com 20 BC de saldo. O que acontece?',
    opcoes: ['O pagamento é recusado: a conta é pré-paga', 'O pagamento passa e o saldo fica negativo', 'O pagamento passa e a diferença é cobrada depois'],
    certa: 0, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado e o motivo aparece.',
    efeito: (st) => creditar(st, 10, 'Prêmio de economia') },
  { id: 'qrperdido', tipo: 'tempestade', titulo: 'QR perdido',
    historia: 'Você perdeu o QR no caminho e passa a próxima rodada esperando um novo.',
    pergunta: 'Você perdeu o QR de pagamento. O que fazer primeiro?',
    opcoes: ['Avisar a chefia para bloquear o QR', 'Esperar alguém achar e devolver', 'Gastar o saldo antes que usem'],
    certa: 0, porque: 'A chefia bloqueia o QR perdido e o saldo fica protegido. Depois a conta recebe outro QR.',
    app: 'No Trilha HUB, a chefia bloqueia o QR perdido pelo painel do evento.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você perdeu o QR e vai passar a próxima rodada esperando um novo.'); } },
  { id: 'semsaldo', tipo: 'tempestade', titulo: 'Fila da cantina',
    historia: 'A fila da cantina estava enorme e você perde a próxima rodada.',
    pergunta: 'O seu pagamento é recusado por falta de saldo. O que a conta faz?',
    opcoes: ['Recusa o pagamento e mostra o motivo', 'Aprova e deixa o saldo negativo', 'Aprova e cobra na próxima recarga'],
    certa: 0, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado e o aviso diz por quê.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você ficou na fila da cantina e vai perder a próxima rodada.'); } },
  { id: 'recargarec', tipo: 'tempestade', titulo: 'Recarga recusada',
    historia: 'Uma recarga ficou presa no Pix e você volta 2 casas esperando.',
    pergunta: 'Uma recarga por Pix passaria de 300 BC. O que acontece?',
    opcoes: ['A recarga é recusada inteira', 'Entra só até 300 BC e o resto volta por Pix', 'Entra tudo e a conta passa de 300 BC'],
    certa: 0, porque: 'O saldo máximo é 300 BC. A recarga que passaria do limite é recusada inteira.',
    app: 'A carteira de evento do Trilha HUB tem saldo máximo por participante.',
    efeito: (st) => andar(st, -2, false) },
  { id: 'gastoestranho', tipo: 'tempestade', titulo: 'Gasto estranho',
    historia: 'Apareceu um gasto de 9 BC que você não lembra, e a chefia precisou conferir.',
    pergunta: 'No aviso de gasto, como saber qual pulseira foi usada?',
    opcoes: ['O aviso traz o apelido da pulseira', 'O aviso traz só o valor', 'O aviso traz só o nome do lojista'],
    certa: 0, porque: 'O aviso de gasto traz o valor, o saldo e o apelido da pulseira ou do QR que pagou.',
    efeito: (st) => pagarOuParar(st, 9, 'Gasto conferido pela chefia') },
  { id: 'extratotarde', tipo: 'tempestade', titulo: 'Extrato conferido tarde',
    historia: 'Você só conferiu o extrato no fim e perdeu uma cobrança repetida: 10 BC.',
    pergunta: 'Quando conferir o extrato para pegar uma cobrança repetida?',
    opcoes: ['Logo depois do aviso de gasto, na hora', 'Só no último dia do evento', 'Só quando o saldo acabar'],
    certa: 0, porque: 'O aviso chega na hora e o extrato mostra cada movimentação. Conferir na hora é o jeito de pegar erros.',
    efeito: (st) => pagarOuParar(st, 10, 'Cobrança repetida') },
  { id: 'avisoignorado', tipo: 'tempestade', titulo: 'Aviso ignorado',
    historia: 'Você ignorou um aviso de gasto e uma cobrança passou: 6 BC.',
    pergunta: 'Os responsáveis recebem um aviso a cada gasto. Para que serve?',
    opcoes: ['Para conferir na hora se o gasto era esperado', 'Para aprovar cada gasto antes de ele acontecer', 'Para bloquear a conta quando o saldo baixa'],
    certa: 0, porque: 'O aviso chega depois do gasto, com valor e saldo, para conferir na hora se era esperado.',
    efeito: (st) => pagarOuParar(st, 6, 'Cobrança não conferida') },
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
  { id: 'salapix', tipo: 'bussola', sala: true, titulo: 'Recarga coletiva',
    historia: 'Os pais fizeram uma recarga coletiva por Pix: cada conta recebe 8 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Quem faz a recarga na conta de um jovem?',
    opcoes: ['Os responsáveis, por Pix', 'Só a chefia, em dinheiro', 'O próprio jovem, pelo celular do colega'],
    certa: 0, porque: 'Os responsáveis recarregam por Pix e o valor entra na conta na hora.',
    efeitoSala: (alvo) => creditar(alvo, 8, 'Recarga coletiva dos pais') },
  { id: 'salaextrato', tipo: 'bussola', sala: true, titulo: 'Dia de extrato',
    historia: 'Quem tem Mapa organizou o acampamento e ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Como os responsáveis recebem o extrato do evento?',
    opcoes: ['Por um link enviado no WhatsApp', 'Pedindo uma cópia ao caixa', 'Só no fim do evento, por e-mail'],
    certa: 0, porque: 'O extrato completo chega por link no WhatsApp.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('mapa')) creditar(alvo, 10, 'Organização do acampamento'); } },
  { id: 'salaaviso', tipo: 'bussola', sala: true, titulo: 'Aviso para todos',
    historia: 'A chefia mandou um aviso e cada conta ganha 6 BC de brinde. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Um gasto seu apareceu no WhatsApp dos seus responsáveis. Isso é normal?',
    opcoes: ['Sim: cada gasto gera um aviso com valor e saldo', 'Não: só gastos acima de 50 BC geram aviso', 'Não: o aviso só vai para a chefia'],
    certa: 0, porque: 'Todo gasto gera um aviso aos responsáveis, com o valor e o saldo.',
    efeitoSala: (alvo) => creditar(alvo, 6, 'Brinde da chefia') },
  { id: 'salapulseira', tipo: 'bussola', sala: true, titulo: 'Pulseiras em dia',
    historia: 'Quem tem Bússola não se perdeu e ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Duas pulseiras pagaram na mesma cantina. Como separar os gastos?',
    opcoes: ['Cada aviso mostra o apelido da pulseira usada', 'Os gastos se misturam no mesmo aviso', 'O caixa descobre depois, pelo horário'],
    certa: 0, porque: 'Cada pulseira vinculada tem um apelido, e ele aparece no aviso de gasto.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('bussola')) creditar(alvo, 10, 'Caminho certo com a Bússola'); } },
  { id: 'salaqr', tipo: 'tempestade', sala: true, titulo: 'Blecaute no caixa',
    historia: 'Faltou luz no caixa: quem não tem Lanterna paga 5 BC. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Um QR foi perdido no meio do blecaute. O que a chefia faz?',
    opcoes: ['Bloqueia o QR e a conta recebe outro', 'Espera o dono voltar para achar', 'Apaga o saldo da conta'],
    certa: 0, porque: 'A chefia bloqueia o QR perdido, o saldo fica protegido e a conta recebe outro QR.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('lanterna')) cobrarDaSala(alvo, 5, 'Blecaute no caixa'); } },
  { id: 'salarecusa', tipo: 'tempestade', sala: true, titulo: 'Fila na cantina',
    historia: 'A cantina lotou: quem não tem Panela paga 6 BC pelo lanche. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Você quer pagar 6 BC e tem 4 BC. O que a conta faz?',
    opcoes: ['Recusa o pagamento e mostra o motivo', 'Aprova e deixa 2 BC negativos', 'Aprova só metade do valor'],
    certa: 0, porque: 'A conta é pré-paga: sem saldo, o pagamento é recusado inteiro.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('panela')) cobrarDaSala(alvo, 6, 'Lanche na fila da cantina'); } },
  { id: 'salaconferencia', tipo: 'tempestade', sala: true, titulo: 'Conferência geral',
    historia: 'A chefia conferiu as contas: quem não tem Mapa paga 4 BC de taxa de inscrição. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Onde você confere o que foi cobrado numa taxa como essa?',
    opcoes: ['No extrato, que mostra cada movimentação', 'Só no aviso de gasto, que some depois', 'Só perguntando à chefia'],
    certa: 0, porque: 'O extrato mostra cada movimentação e o saldo depois dela.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('mapa')) cobrarDaSala(alvo, 4, 'Taxa de inscrição'); } },
  { id: 'salatombo', tipo: 'tempestade', sala: true, titulo: 'Tombo coletivo',
    historia: 'Uma corrida na trilha deu vários tombos: quem não tem Kit primeiros socorros paga 6 BC de curativo. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Qual é o saldo máximo de uma conta no evento?',
    opcoes: ['300 BC', '500 BC', 'Não há limite'],
    certa: 0, porque: 'O saldo máximo é 300 BC por participante.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('kitps')) cobrarDaSala(alvo, 6, 'Curativo do tombo coletivo'); } },
];

// F5: texto curto para os Lobinhos (até 15 palavras, já com a pergunta), lido junto com o chefe ou o
// responsável. As Escoteiras e os Escoteiros em diante leem a história e a pergunta completas.
const CURTOS = {
  vovo: 'O vovô mandou 30 BC. E se a conta passar de 300 BC?',
  contador: 'Onde você vê cada entrada e saída de BC da sua conta?',
  ajudante: 'Você ganhou 20 BC ajudando. Onde esse crédito aparece?',
  promo: 'Sua próxima compra fica 5 BC mais barata. Como saber o valor cobrado?',
  achado: 'Você achou o QR de outra pessoa. O que você faz?',
  mutirao: 'Você anda 3 casas. Quem pode gastar o saldo da sua conta?',
  pix: 'Seus pais mandaram 25 BC por Pix. Quem pode recarregar a sua conta?',
  whatsapp: 'Você ganhou 10 BC. Quando você gasta, quem recebe o aviso?',
  extratolink: 'Você ganhou 12 BC. Como os responsáveis veem todos os gastos?',
  pulseira: 'Você ganhou 15 BC. Como o responsável sabe qual pulseira pagou?',
  teto: 'Você tem 290 BC e chegam 20 BC. O que acontece?',
  prepago: 'Você ganhou 10 BC. E se pagar 25 BC tendo só 20 BC?',
  celular: 'Você perde uma rodada procurando o celular. Por que cuidar dele?',
  lojista: 'Sua próxima compra custa 5 BC a mais. Como perceber um valor errado?',
  ponte: 'A ponte quebrou e custa 8 BC. E se o saldo não cobrir?',
  chuva: 'Você volta 2 casas na chuva. O que conferir antes de gastar?',
  lona: 'A lona furou e custa 5 BC. Onde esse gasto fica registrado?',
  machucado: 'O curativo custou 10 BC e você não reconhece. O que fazer?',
  qrperdido: 'Você perdeu o QR de pagamento. O que fazer primeiro?',
  semsaldo: 'Você perde uma rodada na fila. E se o pagamento não tiver saldo?',
  recargarec: 'Você volta 2 casas. E se uma recarga passar de 300 BC?',
  gastoestranho: 'Apareceu um gasto de 9 BC. Como saber qual pulseira pagou?',
  extratotarde: 'Você perdeu 10 BC numa cobrança repetida. Quando conferir o extrato?',
  avisoignorado: 'Você ignorou um aviso e perdeu 6 BC. Para que serve o aviso?',
  salamutirao: 'Todos ganham 10 BC. Onde cada um confere o que entrou?',
  salajanta: 'Quem tem Panela ganha 10 BC. E se você tem 295 BC?',
  salachuva: 'Quem não tem Lona paga 5 BC. Veio um aviso de gasto: o que fazer?',
  salaventania: 'Quem não tem Corda paga 5 BC. Sem saldo, o que a conta faz?',
  salapix: 'Todos ganham 8 BC. Quem faz a recarga na conta de um jovem?',
  salaextrato: 'Quem tem Mapa ganha 10 BC. Como os responsáveis recebem o extrato?',
  salaaviso: 'Todos ganham 6 BC. Todo gasto avisa os responsáveis?',
  salapulseira: 'Quem tem Bússola ganha 10 BC. Como separar gastos de duas pulseiras?',
  salaqr: 'Quem não tem Lanterna paga 5 BC. Perderam um QR: o que a chefia faz?',
  salarecusa: 'Sem Panela, paga 6 BC. Pagar 6 BC tendo 4 BC: o que acontece?',
  salaconferencia: 'Quem não tem Mapa paga 4 BC. Onde conferir essa taxa?',
  salatombo: 'Quem não tem Kit primeiros socorros paga 6 BC. Qual é o saldo máximo?',
};
for (const c of [...CARTAS, ...CARTAS_SALA]) c.curto = CURTOS[c.id];

// Missão da sala (F6): uma por partida, igual para todos. Quem monta o conjunto de itens primeiro ganha pontos.
export const MISSOES = [
  { id: 'cozinha',  nome: 'Montar a cozinha',                    itens: ['panela', 'lona'] },
  { id: 'luz',      nome: 'Acender a luz do acampamento',        itens: ['lanterna', 'corda'] },
  { id: 'socorro',  nome: 'Montar o posto de primeiros socorros', itens: ['kitps', 'corda'] },
  { id: 'rota',     nome: 'Traçar a rota da trilha',             itens: ['mapa', 'bussola'] },
  { id: 'patrulha', nome: 'Equipar a patrulha de exploração',    itens: ['mapa', 'bussola', 'lanterna'] },
  { id: 'barraca',  nome: 'Armar a barraca',                     itens: ['lona', 'corda', 'panela'] },
];
export function missaoDaPartida(seed) {
  return { id: MISSOES[Math.floor(rngComSemente((seed ^ 0x1D2F) >>> 0)() * MISSOES.length)].id, vencedor: null };
}
export const missaoPorId = (id) => MISSOES.find((m) => m.id === id);
export function descreverMissao(m) {
  const d = missaoPorId(m.id), nomes = d.itens.map((i) => ITENS.find((x) => x.id === i).nome);
  return `${d.nome} (${nomes.join(', ').replace(/, ([^,]*)$/, ' e $1')})`;
}
// Confere se alguém cumpriu a missão. Chamado depois de cada ação que muda um kit.
export function conferirMissao(ctx) {
  const m = ctx.missao;
  if (!m || m.vencedor != null) return null;
  const d = missaoPorId(m.id);
  for (const [id, st] of ctx.estados) {
    if (st.fim || !d.itens.every((i) => st.kit.includes(i))) continue;
    m.vencedor = id;
    st.missaoPts = MISSAO_PTS;
    aviso(st, 'ok', `Missão cumprida primeiro: ${d.nome}! +${MISSAO_PTS} pts no fim.`);
    st.cena.push({ t: 'missao', nome: d.nome });
    for (const [oid, o] of ctx.estados) if (oid !== id) aviso(o, 'info', `${st.apelido} cumpriu a missão da sala primeiro: ${d.nome}.`);
    return id;
  }
  return null;
}

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

// C2 e F4: um evento a cada 3 rodadas, sorteado entre 8, igual para a sala toda (mesma semente).
// Os efeitos em BC valem no começo da rodada do evento, para cada jogador na sua vez.
export const EVENTOS = {
  feira:    { nome: 'Feira', loja: true, duracao: 2 },
  energia:  { nome: 'Queda de energia', loja: true, duracao: 2 },
  chuva:    { nome: 'Chuva', duracao: 1 },
  visita:   { nome: 'Visita dos pais', duracao: 1 },
  cantina:  { nome: 'Cantina aberta', duracao: 1 },
  jogo:     { nome: 'Jogo noturno', duracao: 1 },
  inspecao: { nome: 'Inspeção de barraca', duracao: 1 },
  mutirao:  { nome: 'Mutirão', duracao: 1 },
};

// Texto curto do que vai acontecer, para o anúncio de uma rodada antes (C1) e para a votação (A5).
export function descreverEvento(ev) {
  const loja = ev.loja ? CASAS[ev.loja].nome : '';
  return {
    feira: `Feira: ${loja} com ${DESCONTO_FEIRA} BC de desconto por item`,
    energia: `Queda de energia: ${loja} fechada`,
    chuva: 'Chuva: quem não tem Lona paga 5 BC',
    visita: 'Visita dos pais: recarga de 30 BC por Pix (recusada inteira se a conta passar de 300 BC)',
    cantina: 'Cantina aberta: o lanche custa 8 BC, e quem tem Panela leva marmita e não paga',
    jogo: 'Jogo noturno: quem não tem Lanterna paga 5 BC de aluguel',
    inspecao: 'Inspeção de barraca: quem não tem Kit primeiros socorros paga 8 BC',
    mutirao: 'Mutirão: todos ganham 10 BC',
  }[ev.tipo];
}

const rodadasDeEvento = (rodadas) => { const r = []; for (let n = 3; n <= rodadas; n += 3) r.push(n); return r; };
function montarEvento(seed, tipo, i) {
  const ev = { tipo };
  if (EVENTOS[tipo].loja) ev.loja = LOJAS[Math.floor(rngComSemente((seed * 131 + i) >>> 0)() * LOJAS.length)];
  return ev;
}
function tiposEmOrdem(seed) {
  const r = rngComSemente((seed ^ 0x51ED) >>> 0), t = Object.keys(EVENTOS);
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
// As duas opções que a sala vota antes do evento `i` (a primeira é a que sai se ninguém votar).
export function opcoesDoEvento(seed, i) {
  const t = tiposEmOrdem(seed);
  return [t[i % t.length], t[(i + 4) % t.length]].map((tp) => montarEvento(seed, tp, i));
}
export function agendaDaPartida(seed, rodadas) {
  return rodadasDeEvento(rodadas).map((rodada, i) => ({ rodada, ...opcoesDoEvento(seed, i)[0] }));
}
// A5: depois da votação, o evento escolhido entra na agenda do jogador.
export function definirEvento(st, rodada, ev) {
  const i = st.agenda.findIndex((e) => e.rodada === rodada);
  if (i >= 0) st.agenda[i] = { rodada, ...ev };
}
// C3: o leilão do Canivete é na metade da partida.
export const rodadaDoLeilao = (rodadas) => Math.round(rodadas / 2);

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

// F3: cada jogador tem o seu baralho por tipo de carta, embaralhado pela semente: nenhuma carta se repete
// até o baralho acabar. `vistas` (as cartas das últimas partidas, da mais antiga para a mais nova) vão para o
// fim, para quem joga várias partidas seguidas não ver sempre as mesmas.
function embaralhar(lista, rng) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}
export function montarBaralho(seed, sala, vistas = []) {
  const baralhos = {};
  for (const tipo of ['bussola', 'tempestade']) {
    const ids = [...CARTAS, ...(sala ? CARTAS_SALA : [])].filter((c) => c.tipo === tipo).map((c) => c.id);
    const ordem = embaralhar(ids, rngComSemente((seed ^ hashTexto(`baralho-${tipo}`)) >>> 0));
    const pos = (id) => vistas.lastIndexOf(id);
    baralhos[tipo] = [...ordem.filter((id) => pos(id) < 0), ...ordem.filter((id) => pos(id) >= 0).sort((a, b) => pos(a) - pos(b))];
  }
  return baralhos;
}
function sacarCarta(st, tipo, rng) {
  if (!st.baralho[tipo].length) st.baralho[tipo] = embaralhar(baralho(st, tipo).map((c) => c.id), rng);
  const id = st.baralho[tipo].shift();
  st.sacadas.push(id);
  return id;
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
export function novoJogador({ apelido, ficha, rodadas = RODADAS_PADRAO, seed = 1, ordem = 0, sala = false, vistas = [] }) {
  return {
    v: VERSAO_ESTADO, apelido, ficha, rodadas, seed, sala,
    pos: 0, rodada: 0, saldo: SALDO_INICIAL, kit: [], acertos: 0,
    skip: 0, desconto: 0, extra: 0,
    rolou: false, feito: false, dado: null, pend: null, resposta: null, ultimo: null,
    fim: false, fogo: 0,
    meta: metaDoJogador(seed, ordem),
    stats: { trocas: 0, cartas: 0, kitCompletoRodada: null, gratificacoes: 0, protecoes: 0, creditosRecusados: 0, minSaldo: SALDO_INICIAL, maxSaldo: SALDO_INICIAL, recusas: 0, perdidas: 0, ajudas: 0, duplos: 0, lojas: [], lanterna: null },
    agenda: agendaDaPartida(seed, rodadas),
    duploGratis: 0, canivete: false, acertosNoite: 0, acoesRodada: 0, missaoPts: 0, oferta: null,
    baralho: montarBaralho(seed, sala, vistas), sacadas: [],
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

// C4: nas últimas rodadas ("noite no acampamento") créditos e acertos valem em dobro.
export function noite(st) { return rodadaAtual(st) > st.rodadas - NOITE_RODADAS; }

export function creditar(st, valor, d, tipo = 'credito') {
  if (noite(st)) { valor *= 2; d += ' (em dobro: noite)'; }
  if (st.saldo + valor > SALDO_MAX) {
    aviso(st, 'alerta', `Crédito de ${valor} BC recusado: a conta passaria do saldo máximo de ${SALDO_MAX} BC.`);
    st.stats.creditosRecusados += 1;
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

const TIPO_DEBITO = { loja: 'compra', dado: 'dado_duplo', pedagio: 'pedagio', leilao: 'leilao' };

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

// B5: cada item do kit protege de um revés. Devolve true (e avisa) se o jogador tem o item.
function protegido(st, itemId, motivo) {
  if (!st.kit.includes(itemId)) return false;
  const item = ITENS.find((i) => i.id === itemId);
  st.stats.protecoes += 1;
  aviso(st, 'ok', `${item.nome} protegeu você: ${motivo}.`);
  st.cena.push({ t: 'protegeu', item: itemId });
  return true;
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

const eventoAtivo = (st, tipo, loja) => st.agenda.some((e) => {
  const n = rodadaAtual(st);
  return e.tipo === tipo && e.loja === loja && n >= e.rodada && n < e.rodada + EVENTOS[tipo].duracao;
});
export function lojaFechada(st, loja) { return eventoAtivo(st, 'energia', loja); }
export function descontoFeira(st, loja) { return eventoAtivo(st, 'feira', loja) ? DESCONTO_FEIRA : 0; }
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
    // B5: a Lanterna mostra o caminho, e o jogador segue sem pagar.
    if (!protegido(st, 'lanterna', 'você não se perdeu na trilha')) st.pend = { tipo: 'perdido', valor: PERDIDO_TAXA };
  } else if (casa === 'troca') {
    if (st.kit.length) st.pend = { tipo: 'troca' };
    else aviso(st, 'info', 'Feira de Trocas: você ainda não tem itens para trocar.');
  } else if (casa === 'bussola' || casa === 'tempestade') {
    st.pend = { tipo: 'carta', carta: sacarCarta(st, casa, rng) };
  }
  st.feito = !st.pend;
}

// ---------- Ações do jogador ----------
// Cada ação devolve { ok: true } ou { erro: 'mensagem' } e altera st no lugar.

// B1: o que o jogador pode escolher antes de rolar.
export function opcoesDaRodada(st) {
  if (st.fim || st.rolou) return { rolar: false, duplo: false, ajudar: false };
  if (st.skip > 0) return { rolar: true, duplo: false, ajudar: false };
  return { rolar: true, duplo: st.duploGratis > 0 || st.saldo >= DADO_DUPLO_CUSTO, ajudar: st.saldo + AJUDA_GANHO <= SALDO_MAX };
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
  if (st.duploGratis > 0) {
    st.duploGratis -= 1;
    aviso(st, 'ok', 'A Bússola deu um dado duplo de graça.');
  } else {
    if (st.saldo < DADO_DUPLO_CUSTO) return { erro: `O dado duplo custa ${DADO_DUPLO_CUSTO} BC e você tem ${st.saldo} BC.` };
    debitar(st, DADO_DUPLO_CUSTO, 'Dado duplo', 'dado');
  }
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
  if (itens.some((i) => i.id === 'bussola')) st.duploGratis += 1;
  if (!st.stats.lojas.includes(st.pend.loja)) st.stats.lojas.push(st.pend.loja);
  if (itens.some((i) => i.id === 'lanterna') && st.stats.lanterna == null) st.stats.lanterna = rodadaAtual(st);
  st.desconto = 0; st.extra = 0;
  if (st.kit.length === ITENS.length) {
    st.stats.kitCompletoRodada = rodadaAtual(st);
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

// ---------- Feira de Trocas (A7) ----------
// Troca de item por item: nenhum BC muda de conta, porque a carteira real não tem pagamento entre participantes.
const itemPorId = (id) => ITENS.find((i) => i.id === id);
function trocaInvalida(st, dar, querer) {
  if (!st.pend || st.pend.tipo !== 'troca') return 'Você não está na Feira de Trocas.';
  if (!itemPorId(dar) || !itemPorId(querer) || dar === querer) return 'Escolha um item seu e um item diferente para receber.';
  if (!st.kit.includes(dar)) return 'Você só pode trocar um item que está no seu kit.';
  if (st.kit.includes(querer)) return 'Você já tem esse item.';
  return null;
}
function passarItem(st, saiu, entrou) {
  st.kit = st.kit.map((i) => (i === saiu ? entrou : i));
  st.stats.trocas += 1;
  st.cena.push({ t: 'troca', dar: saiu, querer: entrou });
}
// O baú da Feira troca na hora, por um item que custa o mesmo ou menos.
export function trocarNoBau(st, dar, querer) {
  const erro = trocaInvalida(st, dar, querer);
  if (erro) return { erro };
  const a = itemPorId(dar), b = itemPorId(querer);
  if (b.preco > a.preco) return { erro: 'No baú da Feira só dá para trocar por um item que custa o mesmo ou menos.' };
  passarItem(st, dar, querer);
  aviso(st, 'ok', `Troca no baú: ${a.nome} por ${b.nome}. Nenhum BC mudou de conta.`);
  st.pend = null; st.feito = true; st.ultimo = `Trocou ${a.nome} por ${b.nome} no baú da Feira.`;
  return { ok: true };
}
// Numa sala, o jogador oferece o item aos outros: quem aceitar primeiro faz a troca.
export function oferecerTroca(st, dar, querer, ctx) {
  if (!ctx?.ofertas) return { erro: 'Só dá para oferecer a troca numa sala, com outros jogadores.' };
  const erro = trocaInvalida(st, dar, querer);
  if (erro) return { erro };
  st.oferta = { dar, querer, rodada: st.rodada };
  aviso(st, 'info', `Você ofereceu ${itemPorId(dar).nome} por ${itemPorId(querer).nome} na Feira de Trocas.`);
  st.cena.push({ t: 'oferta', dar, querer });
  st.pend = null; st.feito = true; st.ultimo = `Ofereceu ${itemPorId(dar).nome} por ${itemPorId(querer).nome}.`;
  return { ok: true };
}
export function sairDaTroca(st) {
  if (!st.pend || st.pend.tipo !== 'troca') return { erro: 'Você não está na Feira de Trocas.' };
  st.pend = null; st.feito = true; st.ultimo = 'Saiu da Feira de Trocas sem trocar.';
  return { ok: true };
}
// Uma oferta vale na rodada em que foi feita e na seguinte.
export const ofertaAtiva = (st) => !!st.oferta && !st.fim && st.rodada <= st.oferta.rodada + 1;
export function podeAceitar(aceita, ofertante) {
  if (!ofertaAtiva(ofertante) || aceita === ofertante || aceita.fim) return false;
  const { dar, querer } = ofertante.oferta;
  return aceita.kit.includes(querer) && !aceita.kit.includes(dar) && ofertante.kit.includes(dar) && !ofertante.kit.includes(querer);
}
export function aceitarTroca(st, msg, ctx) {
  const o = ctx.estados.get(msg.de);
  if (!o || !podeAceitar(st, o)) return { erro: 'Essa oferta não está mais disponível para você.' };
  const { dar, querer } = o.oferta, a = itemPorId(dar), b = itemPorId(querer);
  passarItem(o, dar, querer);
  passarItem(st, querer, dar);
  o.oferta = null;
  aviso(o, 'ok', `${st.apelido} aceitou a sua oferta: você trocou ${a.nome} por ${b.nome}.`);
  aviso(st, 'ok', `Troca com ${o.apelido}: você deu ${b.nome} e recebeu ${a.nome}. Nenhum BC mudou de conta.`);
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
  st.stats.cartas += 1;
  if (ok) { st.acertos += 1; if (noite(st)) st.acertosNoite += 1; }
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
      guardiao.stats.gratificacoes += 1;
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
    else if (st.pend.tipo === 'troca') sairDaTroca(st);
    else if (st.pend.tipo === 'carta') responder(st, -1, rng, ctx ? [...ctx.estados.values()] : null);
    else if (st.pend.tipo === 'pedagio') pagar(st, ctx?.estados.get(st.pend.guardiao) || null);
    else if (st.pend.tipo === 'perdido') { if (st.saldo >= st.pend.valor) pagar(st); else arriscar(st, rng); }
  }
  st.ultimo = (st.ultimo ? st.ultimo + ' ' : '') + '(Tempo esgotado: o sistema jogou por você.)';
}

// Efeitos de um evento para este jogador, no começo da rodada do evento.
function aplicarEvento(st, ev) {
  const nome = EVENTOS[ev.tipo].nome, ate = ev.rodada + EVENTOS[ev.tipo].duracao - 1;
  st.cena.push({ t: 'evento', tipo: ev.tipo, loja: ev.loja || null });
  const rodadas = ate > ev.rodada ? `nas rodadas ${ev.rodada} e ${ate}` : 'nesta rodada';
  switch (ev.tipo) {
    case 'feira': aviso(st, 'info', `Feira! ${CASAS[ev.loja].nome} com ${DESCONTO_FEIRA} BC de desconto por item ${rodadas}.`); break;
    case 'energia': aviso(st, 'alerta', `Queda de energia: a ${CASAS[ev.loja].nome} fica fechada ${rodadas}.`); break;
    case 'chuva':
      aviso(st, 'alerta', 'Chuva forte no acampamento!');
      if (!protegido(st, 'lona', 'a chuva não molhou o acampamento')) cobrarDaSala(st, 5, 'Reparos da chuva');
      break;
    case 'visita': aviso(st, 'info', 'Visita dos pais! Eles fizeram uma recarga por Pix de 30 BC.'); creditar(st, 30, 'Recarga dos pais por Pix'); break;
    case 'cantina':
      aviso(st, 'info', 'Cantina aberta!');
      if (!protegido(st, 'panela', 'você levou marmita e não pagou o lanche')) cobrarDaSala(st, 8, 'Lanche na cantina');
      break;
    case 'jogo':
      aviso(st, 'info', 'Jogo noturno!');
      if (!protegido(st, 'lanterna', 'você usou a sua lanterna e não pagou aluguel')) cobrarDaSala(st, 5, 'Aluguel de lanterna no jogo noturno');
      break;
    case 'inspecao':
      aviso(st, 'info', 'Inspeção de barraca!');
      if (!protegido(st, 'kitps', 'a inspeção passou sem multa')) cobrarDaSala(st, 8, 'Multa da inspeção de barraca');
      break;
    case 'mutirao': aviso(st, 'info', 'Mutirão no acampamento!'); creditar(st, 10, 'Mutirão no acampamento'); break;
    default: aviso(st, 'info', nome);
  }
}

// Anúncio (C1) uma rodada antes e efeito do evento (C2) na rodada dele.
function comecarRodada(st) {
  const n = rodadaAtual(st);
  for (const ev of st.agenda) {
    if (n === ev.rodada - 1) {
      aviso(st, 'info', `Na próxima rodada: ${descreverEvento(ev)}.`);
      st.cena.push({ t: 'anuncio', tipo: ev.tipo, loja: ev.loja || null });
    }
    if (n === ev.rodada) aplicarEvento(st, ev);
  }
  if (n === st.rodadas - NOITE_RODADAS + 1) {
    aviso(st, 'info', 'Noite no acampamento! Nas últimas rodadas, créditos e cartas certas valem em dobro.');
    st.cena.push({ t: 'noite' });
  }
}

// Fecha a rodada do jogador. Devolve false se ele ainda não terminou a jogada.
export function fecharRodada(st) {
  if (!st.feito || st.fim) return false;
  st.rodada += 1; st.rolou = false; st.feito = false; st.acoesRodada = 0;
  if (st.rodada >= st.rodadas) {
    st.fim = true;
    aviso(st, 'info', 'Fim do mercado! A conta foi congelada e o que sobrou vira pontos.');
    return true;
  }
  comecarRodada(st);
  return true;
}

// C6: rodada perdida passa sozinha, sem clique. Na sala de espera isso acontece quando a rodada abre
// para todos (`rodadaPerdida`); nos outros modos, logo depois de a rodada anterior fechar.
export function rodadaPerdida(st) {
  if (st.fim || st.rolou || st.skip <= 0) return false;
  rolar(st);
  return true;
}
export function passarRodadasPerdidas(st) {
  while (rodadaPerdida(st)) fecharRodada(st);
}

// C3: lance único e fechado; ganha o maior lance (mínimo 10 BC) e, no empate, quem tem menos saldo.
export function lanceValido(st, valor) { return LANCES.includes(valor) && valor <= st.saldo; }
export function resolverLeilao(lances) {
  const validos = lances.filter((l) => l.valor >= 10 && l.valor <= l.saldo);
  validos.sort((a, b) => (b.valor - a.valor) || (a.saldo - b.saldo) || (a.ordem - b.ordem));
  return validos[0] || null;
}
export function vencerLeilao(st, valor) {
  if (!debitar(st, valor, 'Canivete no leilão', 'leilao')) return false;
  st.canivete = true;
  aviso(st, 'ok', `Você levou o Canivete no leilão por ${valor} BC: +${CANIVETE_PTS} pts no fim.`);
  st.cena.push({ t: 'canivete' });
  return true;
}

export function pontuacao(st) {
  const itens = st.kit.length * 10;
  const kitCompleto = st.kit.length === ITENS.length ? 20 : 0;
  const cartas = (st.acertos + st.acertosNoite) * PTS_CARTA;
  const saldo = Math.floor(st.saldo / 10);
  // A meta secreta só conta quando a partida acaba, para não entregar a meta pelo placar.
  const meta = st.fim && metaCumprida(st) ? METAS.find((m) => m.id === st.meta).pts : 0;
  const canivete = st.canivete ? CANIVETE_PTS : 0, missao = st.missaoPts || 0;
  return { itens, kitCompleto, cartas, saldo, meta, canivete, missao, total: itens + kitCompleto + cartas + saldo + meta + canivete + missao };
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

// ---------- Insígnias (E1) ----------
// Conferidas quando a partida acaba. `pos` e `total` são a posição na mesa e o número de jogadores.
export const INSIGNIAS = [
  { id: 'contador',   nome: 'Contador esperto',    desc: 'Acertou todas as cartas da partida (3 ou mais).', ok: (st) => st.stats.cartas >= 3 && st.acertos === st.stats.cartas },
  { id: 'kit8',       nome: 'Kit em 8 rodadas',    desc: 'Completou o Kit de Acampamento até a rodada 8.', ok: (st) => st.stats.kitCompletoRodada != null && st.stats.kitCompletoRodada <= 8 },
  { id: 'poupador',   nome: 'Poupador',            desc: 'Terminou com 5 itens ou mais e 150 BC ou mais.', ok: (st) => st.kit.length >= 5 && st.saldo >= 150 },
  { id: 'guardiao',   nome: 'Guardião da ponte',   desc: 'Ganhou 3 gratificações de pedágio.', ok: (st) => st.stats.gratificacoes >= 3 },
  { id: 'semrecusa',  nome: 'Sem recusa',          desc: 'Nenhum pagamento recusado em 8 rodadas ou mais.', ok: (st) => st.stats.recusas === 0 && st.rodadas >= 8 },
  { id: 'fogueiro',   nome: 'Fogueiro',            desc: 'Passou duas vezes pelo Fogo de Conselho.', ok: (st) => st.fogo >= 2 },
  { id: 'cofre',      nome: 'Cofre cheio',         desc: 'Chegou a 250 BC ou mais.', ok: (st) => st.stats.maxSaldo >= 250 },
  { id: 'leiloeiro',  nome: 'Canivete no bolso',   desc: 'Levou o Canivete no leilão.', ok: (st) => st.canivete },
  { id: 'equipado',   nome: 'Bem equipado',        desc: 'Foi protegido por itens do kit 3 vezes.', ok: (st) => st.stats.protecoes >= 3 },
  { id: 'missao',     nome: 'Missão cumprida',     desc: 'Cumpriu a meta secreta.', ok: (st) => metaCumprida(st) },
  { id: 'dados',      nome: 'Mestre dos dados',    desc: 'Usou o dado duplo 4 vezes.', ok: (st) => st.stats.duplos >= 4 },
  { id: 'campeao',    nome: 'Campeão da mesa',     desc: 'Terminou em 1º lugar numa mesa de 2 jogadores ou mais.', ok: (st, c) => c.total >= 2 && c.pos === 1 },
];
export function insigniasDaPartida(st, { pos = 0, total = 1 } = {}) {
  return INSIGNIAS.filter((i) => i.ok(st, { pos, total })).map((i) => i.id);
}

// ---------- Mestre do mercado (C7) ----------
// O anfitrião dispara um evento para a sala toda na hora, na rodada em que cada jogador estiver.
export const MESTRE_EVENTOS = ['feira', 'chuva', 'visita'];
export function aplicarEventoAgora(st, tipo, loja) {
  if (st.fim || !MESTRE_EVENTOS.includes(tipo)) return false;
  const ev = { rodada: rodadaAtual(st), tipo };
  if (EVENTOS[tipo].loja) ev.loja = loja || LOJAS[0];
  st.agenda.push(ev);
  aplicarEvento(st, ev);
  return true;
}

// ---------- Desafio do dia (E2) ----------
// Todos jogam a mesma partida: mesma semente, mesmos eventos e cartas, e o dado de cada rodada sai da
// semente, da rodada e da ordem da ação, não de quem jogou antes. `rodarDesafio` repete uma partida
// ação por ação, e é assim que o servidor confere o resultado que o celular mandou.
export function sementeDoDia(dia) { return (hashTexto(`mercado-${dia}`) % 2147483646) + 1; }
export function rngDaAcao(st) {
  return rngComSemente((Math.imul(st.seed, 2654435761) ^ Math.imul(st.rodada + 1, 40503) ^ Math.imul(st.acoesRodada + 1, 9973)) >>> 0);
}
export function novoDesafio(dia, { apelido = 'Jogador', ficha = 'f01' } = {}) {
  const ctx = novoContexto(null);
  ctx.estados.set('eu', novoJogador({ apelido, ficha, rodadas: RODADAS_PADRAO, seed: sementeDoDia(dia) }));
  return ctx;
}
// Uma ação do desafio, já fechando a rodada quando o jogador termina.
export function passoDoDesafio(ctx, msg) {
  const st = ctx.estados.get('eu');
  const r = agirNaSala(ctx, 'eu', msg, rngDaAcao(st));
  if (r.erro) return r;
  st.acoesRodada += 1;
  if (st.feito) { fecharRodada(st); passarRodadasPerdidas(st); }
  return r;
}
export function rodarDesafio(dia, acoes) {
  if (!Array.isArray(acoes) || acoes.length > 400) return { erro: 'Lista de ações inválida.' };
  const ctx = novoDesafio(dia), st = ctx.estados.get('eu');
  for (const [i, m] of acoes.entries()) {
    if (st.fim) return { erro: 'Ações depois do fim da partida.' };
    if (!m || typeof m.t !== 'string' || !ACOES_DO_JOGO.includes(m.t)) return { erro: `Ação ${i + 1} inválida.` };
    const r = passoDoDesafio(ctx, m);
    if (r.erro) return { erro: `Ação ${i + 1}: ${r.erro}` };
  }
  if (!st.fim) return { erro: 'A partida não terminou.' };
  return { st, pontos: pontuacao(st) };
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
  trocar_bau: (st, m) => trocarNoBau(st, String(m.dar), String(m.querer)),
  oferecer_troca: (st, m, rng, ctx) => oferecerTroca(st, String(m.dar), String(m.querer), ctx),
  sair_troca: (st) => sairDaTroca(st),
  aceitar_troca: (st, m, rng, ctx) => aceitarTroca(st, m, ctx),
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
  conferirMissao(ctx);
  const afetados = [...ctx.estados].filter(([k, s]) => k === id || s.cena.length !== antes.get(k)).map(([k]) => k);
  return { ok: true, afetados };
}
