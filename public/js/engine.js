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
  { id: 'f06', nome: 'Escoteiro de cabelo castanho' },
  { id: 'f07', nome: 'Sênior de cabelo crespo' },
  { id: 'f08', nome: 'Sênior de cabelo liso' },
  { id: 'f09', nome: 'Pioneira de rabo de cavalo' },
  { id: 'f10', nome: 'Pioneiro de barba' },
  { id: 'f11', nome: 'Chefe de chapéu' },
  { id: 'f12', nome: 'Chefe de cabelos brancos e óculos' },
];

// Nível do perfil: define quais cartas saem no baralho do jogador. Cada carta tem `nivel: 'lobinho'` (só Lobinhos),
// `nivel: 'escoteiro'` (só Escoteiros em diante) ou nenhum (serve a todos). Sem nível (desafio do dia, partidas antigas e
// a simulação) o jogador recebe todas as cartas, o que mantém o desafio igual para todo mundo.
export const NIVEIS = { lobinho: 'Lobinho', escoteiro: 'Escoteiro em diante' };
export const NIVEL_PADRAO = 'escoteiro';
export const cartaServe = (c, nivel) => !nivel || !c.nivel || c.nivel === nivel;

// Cartas: cada uma tem uma situação, uma pergunta de 3 opções e um efeito.
// As perguntas são sobre a vivência do Escotismo (história, nós, ramos, Promessa e Lei, técnicas de acampamento),
// nunca sobre o funcionamento do jogo, de Pix, extrato ou de qualquer sistema. Confira o fato antes de propor uma carta.
// O efeito acontece; acertar dá +10 pts, evita o revés das cartas de Tempestade e, em "Mestre dos nós", dá o crédito.
export const CARTAS = [
  { id: 'vovo', tipo: 'bussola', nivel: 'escoteiro', titulo: 'Ilha de Brownsea',
    historia: 'Você contou a história do primeiro acampamento escoteiro e ganhou 30 BC.',
    pergunta: 'Em que ano Baden-Powell fez o primeiro acampamento escoteiro, na ilha de Brownsea?',
    opcoes: ['1907', '1924', '1950'],
    certa: 0, porque: 'Foi em 1907, na Inglaterra. Baden-Powell levou um grupo de meninos para acampar e testar as suas ideias.',
    efeito: (st) => creditar(st, 30, 'Prêmio da Ilha de Brownsea') },
  { id: 'contador', tipo: 'bussola', titulo: 'Mestre dos nós',
    historia: 'O chefe premia quem sabe dar nós. Acertando a pergunta, você ganha 10 BC.',
    pergunta: 'Qual nó une duas cordas da mesma grossura?',
    opcoes: ['Lais de guia', 'Nó direito', 'Volta do fiel'],
    certa: 1, porque: 'O nó direito une duas cordas da mesma grossura. Para cordas de grossuras diferentes, usamos o nó de escota.',
    efeito: (st, ok) => { if (ok) creditar(st, 10, 'Prêmio do Mestre dos nós'); } },
  { id: 'ajudante', tipo: 'bussola', nivel: 'lobinho', titulo: 'Boa ação do dia',
    historia: 'Você ajudou um colega a carregar a mochila e ganhou 20 BC.',
    pergunta: 'Com que frequência Lobinhos e escoteiros fazem uma boa ação?',
    opcoes: ['Só nos acampamentos', 'Só quando alguém pede', 'Todos os dias'],
    certa: 2, porque: 'Lobinhos e escoteiros prometem fazer uma boa ação todos os dias e estar sempre prontos para ajudar o próximo.',
    efeito: (st) => creditar(st, 20, 'Boa ação do dia') },
  { id: 'promo', tipo: 'bussola', titulo: 'Festa do grupo',
    historia: 'Na festa do grupo, a barraca de doces fez promoção: sua próxima compra sai 5 BC mais barata.',
    pergunta: 'Qual cerimônia marca a entrada oficial do jovem no Movimento Escoteiro?',
    opcoes: ['A Promessa', 'A Passagem', 'O Jamboree'],
    certa: 0, porque: 'Ao fazer a Promessa, o jovem se compromete a cumprir os seus deveres, ajudar o próximo e obedecer à Lei.',
    efeito: (st) => { st.desconto = 5; aviso(st, 'info', 'Promoção guardada: 5 BC de desconto na próxima compra.'); } },
  { id: 'achado', tipo: 'bussola', nivel: 'lobinho', titulo: 'Achado devolvido',
    historia: 'Você achou uma lanterna perdida no acampamento e devolveu ao dono, que agradeceu com 15 BC.',
    pergunta: 'Você achou um objeto que não é seu. O que fazer?',
    opcoes: ['Guardar até alguém perguntar', 'Entregar ao dono ou à chefia', 'Ficar com ele'],
    certa: 1, porque: 'O escoteiro respeita o bem alheio, e o Lobinho também: o que é dos outros volta para o dono.',
    efeito: (st) => creditar(st, 15, 'Agradecimento pelo achado') },
  { id: 'mutirao', tipo: 'bussola', nivel: 'escoteiro', titulo: 'Mutirão da patrulha',
    historia: 'A patrulha fez um mutirão para montar as barracas e você avança 3 casas.',
    pergunta: 'Quantos escoteiros formam uma patrulha?',
    opcoes: ['De 20 a 30', 'De 2 a 3', 'De 6 a 8'],
    certa: 2, porque: 'A patrulha é um pequeno grupo, de 6 a 8 escoteiros. Quem a lidera é o monitor.',
    efeito: (st) => andar(st, 3, false) },
  { id: 'celular', tipo: 'tempestade', nivel: 'lobinho', titulo: 'Perdido no mato',
    historia: 'Você se afastou do grupo e passa a próxima rodada tentando se achar.',
    pergunta: 'Se você se perde do grupo, o que deve fazer?',
    opcoes: ['Ficar parado e chamar ajuda', 'Andar sem parar até achar', 'Subir numa árvore'],
    certa: 0, porque: 'Parado, é mais fácil ser encontrado. Chamar ajuda e esperar é o mais seguro.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você vai passar a próxima rodada procurando o caminho.'); } },
  { id: 'lojista', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Livro esquecido',
    historia: 'Você esqueceu o seu livro de campo no ônibus: sua próxima compra vai custar 5 BC a mais.',
    pergunta: 'Em que ano Baden-Powell publicou o livro Escotismo para Rapazes?',
    opcoes: ['1920', '1908', '1935'],
    certa: 1, porque: 'O livro saiu em 1908 e espalhou o Escotismo pelo mundo.',
    efeito: (st) => { st.extra = 5; aviso(st, 'alerta', 'Atenção: a próxima compra vai custar 5 BC a mais.'); } },
  { id: 'ponte', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Ponte quebrada',
    historia: 'A ponte quebrou e você paga 8 BC de pedágio extra.',
    pergunta: 'Qual nó forma um laço que não corre e é usado em salvamentos?',
    opcoes: ['Nó direito', 'Nó de escota', 'Lais de guia'],
    certa: 2, porque: 'O lais de guia faz um laço firme que não corre. Por isso é o nó do salvamento.',
    efeito: (st) => { if (!protegido(st, 'corda', 'a ponte quebrada não te atrasou')) pagarOuParar(st, 8, 'Pedágio extra da ponte quebrada'); } },
  { id: 'chuva', tipo: 'tempestade', titulo: 'Chuva forte',
    historia: 'Chuva forte na trilha! Você volta 2 casas.',
    pergunta: 'Numa tempestade com raios, qual lugar é mais perigoso?',
    opcoes: ['Embaixo de uma árvore isolada', 'Dentro de um prédio fechado', 'Dentro de um carro'],
    certa: 0, porque: 'Os raios caem em pontos altos, como árvores isoladas. O melhor é procurar um abrigo fechado.',
    efeito: (st) => andar(st, -2, false) },
  { id: 'lona', tipo: 'tempestade', nivel: 'lobinho', titulo: 'Furou a lona da barraca',
    historia: 'A lona da barraca furou e o conserto custa 5 BC.',
    pergunta: 'Por que nunca se acende fogo dentro da barraca?',
    opcoes: ['O fogo atrai insetos', 'A lona pode pegar fogo', 'A lenha molha com o orvalho'],
    certa: 1, porque: 'A lona pega fogo rápido e a fumaça também faz mal. O fogo fica longe das barracas, em local seguro.',
    efeito: (st) => { if (!protegido(st, 'lona', 'a barraca não furou')) pagarOuParar(st, 5, 'Conserto da lona'); } },
  { id: 'machucado', tipo: 'tempestade', nivel: 'lobinho', titulo: 'Machucado na trilha',
    historia: 'Você se cortou de leve na trilha e o curativo custa 10 BC.',
    pergunta: 'Você se cortou de leve. O que faz primeiro?',
    opcoes: ['Cobre com um pano sujo', 'Espera fechar sozinho sem cuidar', 'Lava com água limpa e cobre com um curativo'],
    certa: 2, porque: 'Lavar com água limpa tira a sujeira, e o curativo protege o corte. É o primeiro cuidado.',
    efeito: (st) => { if (!protegido(st, 'kitps', 'o curativo estava no kit')) pagarOuParar(st, 10, 'Curativo'); } },
  // ---- F3: mais 6 cartas de Bússola e 6 de Tempestade, sobre o que a carteira de evento faz ----
  { id: 'pix', tipo: 'bussola', titulo: 'Dia de passagem',
    historia: 'Você ajudou na cerimônia de passagem de ramo e ganhou 25 BC pelo capricho.',
    pergunta: 'Como se chama a cerimônia em que o jovem sobe para o ramo seguinte?',
    opcoes: ['Passagem', 'Fogo de Conselho', 'Bivaque'],
    certa: 0, porque: 'A passagem acontece quando o jovem completa a idade do ramo e segue para o próximo, como de Lobinho para Escoteiro.',
    efeito: (st) => creditar(st, 25, 'Prêmio do Dia de passagem') },
  { id: 'whatsapp', tipo: 'bussola', nivel: 'escoteiro', titulo: 'Formatura em dia',
    historia: 'Você chegou na hora à formatura e ganhou 10 BC.',
    pergunta: 'Qual é o lema do ramo Escoteiro?',
    opcoes: ['Melhor Possível', 'Sempre Alerta', 'Servir'],
    certa: 1, porque: 'Sempre Alerta é o lema dos escoteiros. O dos Lobinhos é Melhor Possível, e o dos Pioneiros, Servir.',
    efeito: (st) => creditar(st, 10, 'Bônus de pontualidade') },
  { id: 'extratolink', tipo: 'bussola', nivel: 'lobinho', titulo: 'Saudação da Alcateia',
    historia: 'A Alcateia ensaiou a saudação e você ganhou 12 BC pela boa organização.',
    pergunta: 'Com quantos dedos o Lobinho faz a saudação?',
    opcoes: ['Três, como o escoteiro', 'Cinco, com a mão aberta', 'Dois, como orelhas de lobo'],
    certa: 2, porque: 'Os Lobinhos saúdam com dois dedos, lembrando as orelhas do lobo. Os escoteiros usam três dedos.',
    efeito: (st) => creditar(st, 12, 'Prêmio da Alcateia') },
  { id: 'pulseira', tipo: 'bussola', nivel: 'escoteiro', titulo: 'Corda nova',
    historia: 'A chefia deu uma corda nova para a patrulha e você ganhou 15 BC de boas-vindas.',
    pergunta: 'Qual nó une duas cordas de grossuras diferentes?',
    opcoes: ['Nó de escota', 'Nó direito', 'Lais de guia'],
    certa: 0, porque: 'O nó de escota une cordas de grossuras diferentes. O nó direito serve para cordas iguais.',
    efeito: (st) => creditar(st, 15, 'Prêmio da corda nova') },
  { id: 'teto', tipo: 'bussola', nivel: 'lobinho', titulo: 'Roda da Alcateia',
    historia: 'Os Lobinhos fizeram uma roda de histórias e você ganhou 20 BC.',
    pergunta: 'Como se chama o grupo dos Lobinhos?',
    opcoes: ['Patrulha', 'Alcateia', 'Clã'],
    certa: 1, porque: 'Os Lobinhos formam a Alcateia, chefiada por Akelá. Os escoteiros formam patrulhas, e os pioneiros, o Clã.',
    efeito: (st) => creditar(st, 20, 'Prêmio da roda da Alcateia') },
  { id: 'prepago', tipo: 'bussola', nivel: 'lobinho', titulo: 'Hora da história',
    historia: 'Na roda de histórias você contou a aventura de Mowgli e ganhou 10 BC.',
    pergunta: 'A história de Mowgli, o menino criado pelos lobos, vem de qual livro?',
    opcoes: ['Peter Pan', 'Robinson Crusoé', 'O Livro da Selva'],
    certa: 2, porque: 'Mowgli é o herói de O Livro da Selva, de Rudyard Kipling. Os Lobinhos se inspiram nessa história.',
    efeito: (st) => creditar(st, 10, 'Prêmio da hora da história') },
  { id: 'qrperdido', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Sinais apagados',
    historia: 'A chuva apagou os sinais de pista e você passa a próxima rodada procurando o caminho.',
    pergunta: 'Para que servem os sinais de pista deixados na trilha?',
    opcoes: ['Mostram o caminho a quem vem atrás', 'Marcam o lugar da fogueira', 'Avisam que o lanche chegou'],
    certa: 0, porque: 'Os sinais de pista, feitos com gravetos, pedras ou riscos, indicam a direção para o resto da patrulha.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você perdeu os sinais de pista e vai passar a próxima rodada procurando o caminho.'); } },
  { id: 'semsaldo', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Fila da cantina',
    historia: 'A fila da cantina estava enorme e você perde a próxima rodada.',
    pergunta: 'Em qual ramo ficam os jovens de 15 a 17 anos?',
    opcoes: ['Lobinho', 'Sênior', 'Escoteiro'],
    certa: 1, porque: 'Lobinhos têm de 6 anos e meio a 10; escoteiros, de 11 a 14; seniores, de 15 a 17; pioneiros, de 18 a 21.',
    efeito: (st) => { st.skip = Math.max(st.skip, 1); aviso(st, 'alerta', 'Você ficou na fila da cantina e vai perder a próxima rodada.'); } },
  { id: 'recargarec', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Trilha de lama',
    historia: 'A trilha virou um lamaçal e você volta 2 casas.',
    pergunta: 'Em que ano o Escotismo chegou ao Brasil?',
    opcoes: ['1950', '1890', '1910'],
    certa: 2, porque: 'O Escotismo chegou ao Brasil em 1910, três anos depois do primeiro acampamento de Baden-Powell.',
    efeito: (st) => andar(st, -2, false) },
  { id: 'gastoestranho', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Cantil esquecido',
    historia: 'Você esqueceu o cantil e precisou comprar água: 9 BC.',
    pergunta: 'Em que ano foi fundada a União dos Escoteiros do Brasil, a UEB?',
    opcoes: ['1924', '1907', '1960'],
    certa: 0, porque: 'A UEB foi fundada em 1924 e reúne os escoteiros de todo o país.',
    efeito: (st) => pagarOuParar(st, 9, 'Água comprada de última hora') },
  { id: 'extratotarde', tipo: 'tempestade', titulo: 'Lenço esquecido',
    historia: 'Você esqueceu o lenço no acampamento e o novo custa 10 BC.',
    pergunta: 'Quem fundou o Escotismo?',
    opcoes: ['Rudyard Kipling', 'Robert Baden-Powell', 'Akelá'],
    certa: 1, porque: 'Robert Baden-Powell, oficial inglês, criou o Escotismo a partir do acampamento de 1907.',
    efeito: (st) => pagarOuParar(st, 10, 'Lenço novo') },
  { id: 'avisoignorado', tipo: 'tempestade', nivel: 'escoteiro', titulo: 'Apito ignorado',
    historia: 'Você não ouviu o apito da chefia e perdeu a hora: 6 BC.',
    pergunta: 'O que é um Jamboree?',
    opcoes: ['Uma prova de nós entre patrulhas', 'Uma cerimônia de passagem', 'Um grande acampamento com escoteiros de vários países'],
    certa: 2, porque: 'Jamboree é um grande encontro de escoteiros de vários países. O primeiro foi em 1920, em Londres.',
    efeito: (st) => pagarOuParar(st, 6, 'Apito ignorado') },
];

// Cartas de sala (A2): valem para todos os jogadores da sala e só saem em salas, nunca no jogo sozinho.
// Quem tirou a carta ganha 5 BC. Em carta de Tempestade, quem acerta a pergunta fica de fora do revés.
export const GANHO_CARTA_SALA = 5;
export const CARTAS_SALA = [
  { id: 'salamutirao', tipo: 'bussola', sala: true, nivel: 'escoteiro', titulo: 'Mutirão no acampamento',
    historia: 'Todo o acampamento fez um mutirão de pioneirias: cada jogador recebe 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Como se chamam as construções feitas com troncos e cordas, como torres e pontes?',
    opcoes: ['Pioneirias', 'Bivaques', 'Sinais de pista'],
    certa: 0, porque: 'Pioneirias são construções feitas com troncos, cordas e amarras. Pontes e torres são exemplos.',
    efeitoSala: (alvo) => creditar(alvo, 10, 'Mutirão no acampamento') },
  { id: 'salajanta', tipo: 'bussola', sala: true, nivel: 'lobinho', titulo: 'Janta da patrulha',
    historia: 'A janta rendeu bem: quem tem Panela ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'No fim do acampamento, o que fazer com o lixo?',
    opcoes: ['Enterrar perto da barraca', 'Levar de volta e dar o destino certo', 'Deixar para o vento levar'],
    certa: 1, porque: 'Deixamos o local mais limpo do que encontramos. O lixo volta com o grupo.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('panela')) creditar(alvo, 10, 'Janta da patrulha'); } },
  { id: 'salachuva', tipo: 'tempestade', sala: true, titulo: 'Chuva no acampamento',
    historia: 'Choveu em todo o acampamento: quem não tem Lona paga 5 BC de reparo. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Onde é melhor montar a barraca para a chuva não alagar?',
    opcoes: ['Em terreno plano e um pouco mais alto', 'No ponto mais baixo, perto do rio', 'Embaixo de galhos secos'],
    certa: 0, porque: 'A água escorre para os pontos baixos. Também evitamos montar a barraca sob árvores com galhos secos.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('lona')) cobrarDaSala(alvo, 5, 'Reparo da chuva no acampamento'); } },
  { id: 'salaventania', tipo: 'tempestade', sala: true, nivel: 'escoteiro', titulo: 'Ventania',
    historia: 'Uma ventania derrubou as barracas: quem não tem Corda paga 5 BC. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Qual nó prende uma corda num poste ou tronco?',
    opcoes: ['Nó direito', 'Volta do fiel', 'Nó de escota'],
    certa: 1, porque: 'A volta do fiel prende uma corda a um poste ou tronco e começa a maioria das amarras.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('corda')) cobrarDaSala(alvo, 5, 'Estragos da ventania'); } },
  { id: 'salapix', tipo: 'bussola', sala: true, titulo: 'Roda de canto',
    historia: 'Todos cantaram juntos no Fogo de Conselho: cada jogador recebe 8 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'O que acontece num Fogo de Conselho?',
    opcoes: ['Uma prova escrita sobre nós', 'Uma corrida entre patrulhas', 'Cantos, esquetes e histórias ao redor da fogueira'],
    certa: 2, porque: 'No Fogo de Conselho, a turma se reúne em volta da fogueira para cantar, encenar e contar histórias.',
    efeitoSala: (alvo) => creditar(alvo, 8, 'Roda de canto no Fogo de Conselho') },
  { id: 'salaextrato', tipo: 'bussola', sala: true, nivel: 'escoteiro', titulo: 'Dia de mapa',
    historia: 'Quem tem Mapa organizou o acampamento e ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Para que serve a legenda de um mapa?',
    opcoes: ['Explicar o que cada símbolo significa', 'Dizer que horas são', 'Medir a distância na trilha'],
    certa: 0, porque: 'A legenda explica o significado dos símbolos do mapa, como trilha, rio e acampamento.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('mapa')) creditar(alvo, 10, 'Organização do acampamento'); } },
  { id: 'salaaviso', tipo: 'bussola', sala: true, nivel: 'escoteiro', titulo: 'Brinde da chefia',
    historia: 'A chefia deu um brinde a todos: cada jogador ganha 6 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'Quantos artigos tem a Lei Escoteira?',
    opcoes: ['5', '10', '20'],
    certa: 1, porque: 'A Lei Escoteira tem 10 artigos. Dois deles dizem que o escoteiro é leal e que o escoteiro é cortês.',
    efeitoSala: (alvo) => creditar(alvo, 6, 'Brinde da chefia') },
  { id: 'salapulseira', tipo: 'bussola', sala: true, titulo: 'Caminho certo',
    historia: 'Quem tem Bússola não se perdeu e ganha 10 BC. Quem tirou a carta ganha mais 5 BC.',
    pergunta: 'A flor-de-lis, símbolo do Escotismo, vem da seta que marca qual direção?',
    opcoes: ['O Sul', 'O Oeste', 'O Norte'],
    certa: 2, porque: 'A flor-de-lis vem da seta que indica o Norte nos mapas e nas bússolas. Ela aponta o caminho certo.',
    efeitoSala: (alvo) => { if (alvo.kit.includes('bussola')) creditar(alvo, 10, 'Caminho certo com a Bússola'); } },
  { id: 'salaqr', tipo: 'tempestade', sala: true, nivel: 'lobinho', titulo: 'Blecaute no acampamento',
    historia: 'Faltou luz no acampamento: quem não tem Lanterna paga 5 BC. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Como iluminar a barraca à noite com segurança?',
    opcoes: ['Com uma vela dentro da barraca', 'Com uma fogueira junto da lona', 'Com uma lanterna'],
    certa: 2, porque: 'Fogo perto da lona pode causar um incêndio. A lanterna ilumina sem risco.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('lanterna')) cobrarDaSala(alvo, 5, 'Blecaute no acampamento'); } },
  { id: 'salarecusa', tipo: 'tempestade', sala: true, nivel: 'lobinho', titulo: 'Fila na cantina',
    historia: 'A cantina lotou: quem não tem Panela paga 6 BC pelo lanche. Quem tirou a carta ganha 5 BC.',
    pergunta: 'O que fazemos antes de cozinhar ou comer?',
    opcoes: ['Lava as mãos', 'Acende a fogueira mais alta', 'Guarda a comida ao sol'],
    certa: 0, porque: 'Lavar as mãos tira os germes e evita doenças. Quem acampa cuida sempre da higiene.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('panela')) cobrarDaSala(alvo, 6, 'Lanche na fila da cantina'); } },
  { id: 'salaconferencia', tipo: 'tempestade', sala: true, titulo: 'Roteiro errado',
    historia: 'A patrulha errou o roteiro: quem não tem Mapa paga 4 BC. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Quais são os quatro pontos cardeais?',
    opcoes: ['Norte, Sul, Nordeste e Sudeste', 'Norte, Sul, Leste e Oeste', 'Norte, Leste, Noroeste e Sudoeste'],
    certa: 1, porque: 'Os pontos cardeais são Norte, Sul, Leste e Oeste. Os outros ficam entre eles.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('mapa')) cobrarDaSala(alvo, 4, 'Roteiro errado'); } },
  { id: 'salatombo', tipo: 'tempestade', sala: true, nivel: 'lobinho', titulo: 'Tombo coletivo',
    historia: 'Uma corrida na trilha deu vários tombos: quem não tem Kit primeiros socorros paga 6 BC de curativo. Quem tirou a carta ganha 5 BC.',
    pergunta: 'Ao ver alguém machucado, o que fazer primeiro?',
    opcoes: ['Mexer logo na pessoa', 'Sair correndo sem avisar ninguém', 'Ver se o local é seguro e chamar um adulto'],
    certa: 2, porque: 'Primeiro garantimos a segurança de todos e chamamos um adulto. Não se mexe em quem se machucou sem necessidade.',
    efeitoSala: (alvo) => { if (!alvo.kit.includes('kitps')) cobrarDaSala(alvo, 6, 'Curativo do tombo coletivo'); } },
];

// F5: texto curto para os Lobinhos (até 15 palavras, já com a pergunta), lido junto com o chefe ou o
// responsável. As Escoteiras e os Escoteiros em diante leem a história e a pergunta completas.
const CURTOS = {
  vovo: 'Você ganhou 30 BC! Em que ano foi o primeiro acampamento escoteiro?',
  contador: 'Acertando, você ganha 10 BC. Qual nó une duas cordas iguais?',
  ajudante: 'Você ganhou 20 BC! Com que frequência Lobinhos fazem uma boa ação?',
  promo: 'Próxima compra 5 BC mais barata. Qual cerimônia é a entrada oficial no Escotismo?',
  achado: 'Você devolveu um achado e ganhou 15 BC. O que fazer com objeto perdido?',
  mutirao: 'Você avança 3 casas! Quantos escoteiros formam uma patrulha?',
  pix: 'Você ganhou 25 BC! Como se chama a subida para o ramo seguinte?',
  whatsapp: 'Você ganhou 10 BC! Qual é o lema dos escoteiros?',
  extratolink: 'Você ganhou 12 BC! Com quantos dedos o Lobinho faz a saudação?',
  pulseira: 'Você ganhou 15 BC! Qual nó une cordas de grossuras diferentes?',
  teto: 'Você ganhou 20 BC! Como se chama o grupo dos Lobinhos?',
  prepago: 'Você ganhou 10 BC! Mowgli, criado pelos lobos, vem de que livro?',
  celular: 'Você se perdeu e perde uma rodada. O que fazer ao se perder?',
  lojista: 'Próxima compra 5 BC mais cara. Em que ano saiu Escotismo para Rapazes?',
  ponte: 'A ponte quebrou e custa 8 BC. Qual nó faz um laço que não corre?',
  chuva: 'Chuva forte: volta 2 casas. Onde é mais perigoso ficar num temporal com raios?',
  lona: 'A lona furou e custa 5 BC. Por que não acendemos fogo na barraca?',
  machucado: 'O curativo custa 10 BC. Cortou de leve: o que fazer primeiro?',
  qrperdido: 'Você perde uma rodada. Para que servem os sinais de pista?',
  semsaldo: 'Você perde uma rodada na fila. Qual ramo reúne jovens de 15 a 17 anos?',
  recargarec: 'Você volta 2 casas. Em que ano o Escotismo chegou ao Brasil?',
  gastoestranho: 'A água custou 9 BC. Em que ano foi fundada a UEB?',
  extratotarde: 'O lenço novo custa 10 BC. Quem fundou o Escotismo?',
  avisoignorado: 'Você perde 6 BC. O que é um Jamboree?',
  salamutirao: 'Todos ganham 10 BC. Como se chamam as construções com troncos e cordas?',
  salajanta: 'Quem tem Panela ganha 10 BC. O que fazer com o lixo do acampamento?',
  salapix: 'Todos ganham 8 BC. O que acontece no Fogo de Conselho?',
  salaextrato: 'Quem tem Mapa ganha 10 BC. Para que serve a legenda de um mapa?',
  salaaviso: 'Todos ganham 6 BC. Quantos artigos tem a Lei Escoteira?',
  salapulseira: 'Quem tem Bússola ganha 10 BC. A flor-de-lis aponta que direção?',
  salachuva: 'Quem não tem Lona paga 5 BC. Onde montar a barraca para não alagar?',
  salaventania: 'Quem não tem Corda paga 5 BC. Qual nó prende a corda num poste?',
  salaqr: 'Quem não tem Lanterna paga 5 BC. Como iluminar a barraca com segurança?',
  salarecusa: 'Quem não tem Panela paga 6 BC. O que fazer antes de cozinhar?',
  salaconferencia: 'Quem não tem Mapa paga 4 BC. Quais são os quatro pontos cardeais?',
  salatombo: 'Quem não tem Kit paga 6 BC. O que fazer ao ver alguém machucado?',
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
// O efeito de cada carta em uma frase, para o rodapé da carta na tela. Quem mudar o efeito no motor
// muda também a frase (um teste confere que toda carta tem a sua).
export const RESUMO_CARTA = {
  vovo: "+30 BC",
  contador: "+10 BC se acertar a pergunta",
  ajudante: "+20 BC",
  promo: "Guarda 5 BC de desconto para a próxima compra",
  achado: "+15 BC",
  mutirao: "Avança 3 casas",
  celular: "Perde a próxima rodada",
  lojista: "A próxima compra custa 5 BC a mais",
  ponte: "Paga 8 BC (quem tem Corda no kit escapa). Sem saldo, perde a próxima rodada",
  chuva: "Volta 2 casas",
  lona: "Paga 5 BC (quem tem Lona no kit escapa). Sem saldo, perde a próxima rodada",
  machucado: "Paga 10 BC (quem tem Kit primeiros socorros no kit escapa). Sem saldo, perde a próxima rodada",
  pix: "+25 BC",
  whatsapp: "+10 BC",
  extratolink: "+12 BC",
  pulseira: "+15 BC",
  teto: "+20 BC",
  prepago: "+10 BC",
  qrperdido: "Perde a próxima rodada",
  semsaldo: "Perde a próxima rodada",
  recargarec: "Volta 2 casas",
  gastoestranho: "Paga 9 BC. Sem saldo, perde a próxima rodada",
  extratotarde: "Paga 10 BC. Sem saldo, perde a próxima rodada",
  avisoignorado: "Paga 6 BC. Sem saldo, perde a próxima rodada",
  salamutirao: "Todos ganham +10 BC",
  salajanta: "Quem tem Panela no kit ganha +10 BC",
  salachuva: "Quem não tem Lona no kit paga 5 BC",
  salaventania: "Quem não tem Corda no kit paga 5 BC",
  salapix: "Todos ganham +8 BC",
  salaextrato: "Quem tem Mapa no kit ganha +10 BC",
  salaaviso: "Todos ganham +6 BC",
  salapulseira: "Quem tem Bússola no kit ganha +10 BC",
  salaqr: "Quem não tem Lanterna no kit paga 5 BC",
  salarecusa: "Quem não tem Panela no kit paga 6 BC",
  salaconferencia: "Quem não tem Mapa no kit paga 4 BC",
  salatombo: "Quem não tem Kit primeiros socorros no kit paga 6 BC",
};

export function cartaMostrada(st, id) {
  const c = cartaPorId(id), ordem = ordemOpcoes(st.seed, id);
  return { ...c, opcoes: ordem.map((k) => c.opcoes[k]), certa: ordem.indexOf(c.certa), resumo: RESUMO_CARTA[id] || '' };
}

// F3: cada jogador tem o seu baralho por tipo de carta, embaralhado pela semente: nenhuma carta se repete
// até o baralho acabar. `vistas` (as cartas das últimas partidas, da mais antiga para a mais nova) vão para o
// fim, para quem joga várias partidas seguidas não ver sempre as mesmas.
function embaralhar(lista, rng) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}
export function montarBaralho(seed, sala, vistas = [], nivel) {
  const baralhos = {};
  for (const tipo of ['bussola', 'tempestade']) {
    const ids = [...CARTAS, ...(sala ? CARTAS_SALA : [])].filter((c) => c.tipo === tipo && cartaServe(c, nivel)).map((c) => c.id);
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
export function novoJogador({ apelido, ficha, rodadas = RODADAS_PADRAO, seed = 1, ordem = 0, sala = false, vistas = [], nivel }) {
  if (!NIVEIS[nivel]) nivel = undefined;   // nível desconhecido ou ausente: todas as cartas
  return {
    v: VERSAO_ESTADO, apelido, ficha, rodadas, seed, sala, nivel,
    pos: 0, rodada: 0, saldo: SALDO_INICIAL, kit: [], acertos: 0,
    skip: 0, desconto: 0, extra: 0,
    rolou: false, feito: false, dado: null, pend: null, resposta: null, ultimo: null,
    fim: false, fogo: 0,
    meta: metaDoJogador(seed, ordem),
    stats: { trocas: 0, cartas: 0, kitCompletoRodada: null, gratificacoes: 0, protecoes: 0, creditosRecusados: 0, minSaldo: SALDO_INICIAL, maxSaldo: SALDO_INICIAL, recusas: 0, perdidas: 0, ajudas: 0, duplos: 0, lojas: [], lanterna: null },
    agenda: agendaDaPartida(seed, rodadas),
    duploGratis: 0, canivete: false, acertosNoite: 0, acoesRodada: 0, missaoPts: 0, oferta: null,
    baralho: montarBaralho(seed, sala, vistas, nivel), sacadas: [],
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

// Cenário do tabuleiro: chuva na rodada do evento Chuva (que dura uma rodada), noite na reta final, dia no resto.
export function climaDaRodada(st) {
  const n = rodadaAtual(st);
  if (!st.fim && st.agenda.some((e) => e.tipo === 'chuva' && e.rodada === n)) return 'chuva';
  return noite(st) ? 'noite' : 'dia';
}

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
  return [...CARTAS, ...(st.sala ? CARTAS_SALA : [])].filter((c) => c.tipo === tipo && cartaServe(c, st.nivel));
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
  st.rolou = true; st.resposta = null; st.feito = false; st.dado = null;
  st.stats.duplos += 1;
  // O segundo dado nunca repete o primeiro: sorteia entre as 5 faces que sobram,
  // com a mesma chance para cada uma e um só número do gerador (sem laço).
  const a = 1 + Math.floor(rng() * 6);
  let b = 1 + Math.floor(rng() * 5);
  if (b >= a) b += 1;
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
