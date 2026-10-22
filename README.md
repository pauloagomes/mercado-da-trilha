# Mercado da Trilha

Jogo de treino da conta digital para escoteiros. Cada jogador monta o Kit de Acampamento gastando **BadenCoin (BC)** nas barracas, confere cada gasto e responde cartas sobre a vivência do Escotismo: história, nós, ramos, Promessa e Lei, técnicas de acampamento. O jogo não tem integração com o Trilha HUB.

- **Jogar sozinho:** roda no navegador, sem sala e sem conta.
- **Entrar com código:** alguém cria a sala e passa um código de 5 letras. Cada um joga no próprio ritmo, até 30 jogadores, e o placar é ao vivo.
- **Sala de espera:** junta quem estiver na fila (de 2 a 8 jogadores) numa partida de 12 rodadas sincronizadas de 45 s.

O plano completo (dinâmica, regras, tecnologia e divulgação) está no documento "Mercado da Trilha Online — Plano".

## Como funciona por dentro

```
navegador (HTML + CSS + JS puro)
  └─ public/js/engine.js   regras do jogo, usadas também pelo servidor
  └─ public/js/app.js      telas; no jogo solo chama o motor direto
        │ HTTPS + WebSocket
nginx (HTTPS, arquivos estáticos, proxy de /api, /ws e /r)
        │
server/ (Node.js 22 + Fastify)
  └─ index.js   API, WebSocket, identidade anônima por cookie, links UTM
  └─ salas.js   salas com código, fila da sala de espera, relógio da rodada
        │
PostgreSQL 16 (jogadores, salas, participações, jogadas, movimentos, cliques)
```

O servidor é a fonte da verdade nas salas: ele rola o dado, aplica as regras e fecha a rodada quando o tempo acaba. O celular só envia a jogada e desenha o estado recebido.

## Rodar no computador

Requisitos: Node.js 22 e PostgreSQL 16.

```bash
createuser mercado -P          # senha: mercado
createdb mercado -O mercado
npm install
EMAIL_MODO=log npm start       # http://localhost:3000 (o código da conta aparece no log)
```

Sem `EMAIL_MODO` nem `SMTP_URL`, ninguém consegue criar a conta do responsável e só o jogo sozinho funciona.

O servidor aplica as migrações de `server/migrations` sozinho ao iniciar. Para usar outro banco, defina `DATABASE_URL`.

Testes:

```bash
npm test                                                # regras do jogo e simulação de balanceamento
npm run simular                                         # métricas do RFC com o motor atual (4000 partidas por medida)
DATABASE_URL=postgres://... npm run test:integracao     # salas no PostgreSQL: guardião, leilão, votação, patrulhas, revanche, insígnias
EMAIL_MODO=teste LIMITE_CONTA_X=50 INTERVALO_MS=800 CONTAGEM_FILA_MS=1500 RODADA_MS=1500 npm start   # num terminal
npm run metricas                                        # métricas de uso do RFC, direto do banco
node test/e2e.mjs                                       # em outro: contas, salas, fila e rodadas sincronizadas
```

O e2e cria as contas pelo código de e-mail, então o servidor precisa de `EMAIL_MODO=teste`.

O e2e depende de `RODADA_MS=1500`: com o padrão de 45 s as 12 rodadas da sala de espera não cabem no tempo do teste.

## Regras da Etapa 1 (RFC "Mercado da Trilha mais divertido e interativo")

Todas valem no jogo sozinho e nas salas, exceto onde indicado. As regras ficam em `public/js/engine.js` e têm teste em `test/engine.test.js`.

- **Escolha antes do dado (B1).** Rolar (grátis), Dado duplo (5 BC: rola dois dados e escolhe um) ou Ajudar no acampamento (não anda e ganha 15 BC; fica indisponível se a conta passaria de 300 BC). Parado, só dá para rolar.
- **Perdido (B2).** Pagar 10 BC ou arriscar o dado: de 4 a 6 acha a trilha de graça, de 1 a 3 perde a próxima rodada.
- **Metas secretas (B3).** 12 metas; cada jogador da sala recebe uma diferente. O jogador vê a própria meta desde o início, os outros só a veem no fim, e o bônus entra na pontuação só quando a partida acaba.
- **Acerto muda o efeito (B4).** Cada carta certa vale 10 pts, e acertar uma carta de Tempestade evita o revés.
- **Opções embaralhadas (F1).** A ordem das 3 opções de cada carta muda por partida, pela semente, igual para a sala toda.
- **Guardião da ponte (A1, salas).** Quem para primeiro num Pedágio vira guardião até outro jogador parar ali. O pedágio vai para o caixa do evento (nenhum BC passa de jogador para jogador) e o guardião ganha 3 BC de gratificação por pedágio pago; crédito acima de 300 BC é recusado.
- **Cartas de sala (A2, salas).** Quatro cartas valem para todos (Mutirão, Janta da patrulha, Chuva, Ventania); quem tirou ganha 5 BC. Quem acerta a pergunta de uma carta de sala de Tempestade fica de fora do revés. Pagamento recusado por carta de sala não tira a vez de quem não tirou a carta.
- **Reações rápidas (A3, salas).** Seis reações fixas, sem alvo, uma a cada 3 s por jogador.
- **Tela do jogo, sem rolagem.** O jogo cabe numa tela só, do celular em pé ao computador: o tabuleiro ocupa o maior quadrado que couber no meio. No topo ficam a ficha, o placar (saldo em BC e pontos), a **meta secreta** (um ícone que pisca até o jogador abrir a carta) e o grupo de fichas dos **amigos**, que abre o placar e os acontecimentos. Embaixo do tabuleiro, três ícones: um dado (grátis), dado duplo (5 BC, ou grátis com a Bússola) e ajudar no acampamento (+15 BC). O kit do acampamento fica no rodapé. A conta (extrato e avisos), os ajustes de som e música, a sala e o anfitrião, o "como jogar" e a saída (sempre com confirmação) abrem em folhas por cima. Decisões (dado duplo, troca, pedágio, perdido, votação, leilão e ofertas) abrem numa janela; carta e loja têm a animação delas. O espaço que sobra vira informação, por prioridade: acontecimentos, reações e missão da sala; em tela curta nada disso aparece, e no celular deitado uma coluna ao lado do tabuleiro faz esse papel. A primeira jogada de cada aparelho abre uma explicação dos três ícones (`mt-tutorial-visto`).
- **Sensação de jogo (D0 a D3, D5).** Tabuleiro e peões ficam na tela e só as faixas ao redor são redesenhadas; o peão anda casa a casa, o dado rola no centro, moedas voam para o saldo e o número conta. Sons curtos gerados no navegador (Web Audio, sem arquivo) e vibração curta no Android; o botão do topo liga e desliga, e a escolha fica no aparelho. Com "reduzir movimento" as animações viram troca direta.

## Regras da Etapa 2 (rodada viva)

- **Eventos (C2, F4).** A cada 3 rodadas (3, 6, 9...) há um evento sorteado entre 8, igual para a sala toda, sem repetir na partida. **Feira** (5 BC de desconto numa loja, 2 rodadas), **Queda de energia** (loja fechada, 2 rodadas), **Chuva** (sem Lona paga 5 BC), **Visita dos pais** (recarga de 30 BC por Pix, recusada inteira se a conta passar de 300 BC), **Cantina aberta** (lanche de 8 BC; quem tem Panela não paga), **Jogo noturno** (aluguel de 5 BC; quem tem Lanterna não paga), **Inspeção de barraca** (multa de 8 BC para quem não tem Kit primeiros socorros) e **Mutirão** (+10 BC). Pagamento recusado por evento não tira a vez do jogador.
- **Anúncio (C1).** Uma rodada antes, um aviso diz o que vem na próxima. A feira do exemplo do RFC tem 10 BC de desconto; o jogo mantém os 5 BC que já tinha.
- **Itens com poder (B5).** Lona contra Chuva e "Furou a lona", Corda contra "Ponte quebrada", Lanterna contra o Perdido (nem chega a se perder), Kit primeiros socorros contra o curativo (carta "Machucado") e a multa da inspeção, Panela na cantina. A Bússola dá um dado duplo de graça, uma vez.
- **Noite no acampamento (C4).** Nas 3 últimas rodadas todo crédito e toda carta certa valem em dobro (o teto de 300 BC continua valendo); o tabuleiro mostra o cenário da noite.
- **Leilão do Canivete (C3).** +15 pts. Lance único e fechado de 0, 10, 20, 30 ou 40 BC, sem passar do saldo; ganha o maior e, no empate, quem tem menos saldo. Lance máximo abaixo de 10 BC não vence. Na sala de espera abre sozinho entre as rodadas 5 e 6; na sala com código o anfitrião abre quando quiser, uma vez. Não existe no jogo sozinho.
- **Votação de evento (A5, sala de espera).** Antes de a rodada que anuncia um evento começar, a sala tem 10 s para escolher entre 2 eventos; empate sorteia, e sem votos vale o sorteado. A janela fecha antes se todos já votaram.
- **Relógio da jogada (C6).** Sala de espera: 20 s para jogar e mais 20 s se cair numa loja, carta ou dado duplo; nos últimos 10 s o relógio fica laranja e aparece quem ainda decide. Rodada perdida passa sozinha em todos os modos. `RODADA_MS` é a base de 20 s.
- **Placar que sobe (C5).** Setas de subida e descida, "+N pts" da última jogada e aviso de "Virada!" quando o líder muda.
- **Tela (D4, D6, D7).** O aviso de gasto desce do topo no formato da mensagem do Trilha HUB; confete no kit completo e no Canivete, brilho na carta certa; loja fechada de luz apagada e feira com bandeirinhas.
- **Cartas (F2).** As alternativas absurdas ("Em lugar nenhum", "Não faz diferença") deram lugar aos erros que as pessoas cometem de verdade.

O banco ganhou `eventos_sala` e `lances` (migração 003).

## Regras da Etapa 3 (motivos para voltar)

- **Baralho de 36 cartas (F3).** 12 de Bússola, 12 de Tempestade e 12 de sala, sobre a vivência do Escotismo, sem nenhuma pergunta sobre o funcionamento do jogo, do Pix, de extratos ou de qualquer sistema. Os assuntos são a história (1907 na ilha de Brownsea, o livro de 1908, o Brasil em 1910, a UEB em 1924, o Jamboree), os nós (direito, de escota, lais de guia, volta do fiel), os ramos e as suas idades, a Alcateia e a patrulha, a Promessa, a Lei e os lemas, as passagens de ramo, a saudação, a flor-de-lis, o Fogo de Conselho, as pioneirias, a orientação (mapa, bússola, pontos cardeais) e os cuidados de acampamento e de primeiros socorros. O efeito de cada carta no jogo (créditos, gastos, casas e perdas de rodada) não mudou. Nenhuma carta liga ao Trilha HUB. Cada jogador tem o seu baralho, embaralhado pela semente: nenhuma carta se repete até o baralho acabar. No aparelho, as cartas das últimas partidas (até 24) vão para o fim do baralho da próxima. As 36 cartas ainda precisam da revisão da chefia contra os documentos da UEB (Etapa 5).
- **Nível do perfil.** Ao criar o perfil (e na tela inicial), o responsável escolhe o nível: **Lobinho** ou **Escoteiro em diante**. É só uma escolha de dificuldade, sem idade nem data de nascimento. Cada carta serve a um nível ou a todos (`nivel` em `engine.js`): 12 cartas são só dos Lobinhos, 15 só dos Escoteiros em diante e 9 são de todos. O baralho de cada jogador só leva as cartas do nível dele, e cada nível tem pelo menos 10 cartas de cada tipo, então nenhuma repete numa partida (um teste confere). Nas salas e na fila o nível vem do perfil. No jogo sozinho a mesa toda, rivais inclusos, joga no nível do perfil. **O desafio do dia usa todas as cartas, sem nível**, para a partida ser a mesma para todos e o placar do dia ser comparável. Sem nível (partidas antigas e a simulação) vale o baralho inteiro. Perfis que já existiam ficam em Escoteiro em diante (migração 009, `jogadores.nivel`).
- **Rivais virtuais (A6).** O jogo sozinho tem 3 rivais (Lobo Veloz, Coruja Atenta e Raposa Esperta) que jogam pelo mesmo motor da sala, com as estratégias de `public/js/rivais.js` (apressado, poupador e comprador). Com eles, guardião da ponte, cartas de sala, missão e placar funcionam sem internet. A mesma lógica de jogada é usada pela simulação.
- **Insígnias (E1).** 12 insígnias conferidas quando a partida acaba (`INSIGNIAS` no `engine.js`). "Campeão da mesa" só sai quando todos da sala terminaram. Aparecem na entrada, no resultado, no placar e em Minha trilha.
- **Desafio do dia (E2).** Todos jogam a mesma partida no dia (semente do dia civil de São Paulo): mesmos eventos, cartas e meta, e o dado de cada rodada vem da semente, da rodada e da ordem da ação. Roda no aparelho, sem rivais e sem internet. A primeira tentativa vale para o placar do dia; as outras são treino. O aparelho envia a **lista de ações** e o servidor repete a partida (`rodarDesafio`), só aceitando o resultado que ele mesmo calcular. Dá para enviar até 2 dias depois.
- **Minha trilha (E3).** Últimas 20 partidas, recorde de cada modo e as 12 insígnias. O resultado do jogo sozinho sobe quando houver conexão, de uma fila guardada no aparelho; o id da partida vem do aparelho, então reenviar não duplica.
- **Revanche (E4).** Sala de espera: quem aceitar em 20 s joga de novo com os mesmos jogadores. Sala com código: o anfitrião reabre (encerrando a sala atual, se estiver aberta) e todos que estavam no resultado são levados para a sala nova. Jogo sozinho: "Jogar de novo".
- **Patrulhas (A4, sala com código).** O anfitrião escolhe de 2 a 6 patrulhas e o sistema sorteia quem fica em cada uma. O placar mostra a média de pontos por patrulha. Quem entra depois cai na patrulha com menos gente.
- **Mestre do mercado (C7, sala com código).** O anfitrião chama Feira, Chuva ou Visita dos pais para a sala toda na hora, na rodada em que cada jogador estiver (no máximo um a cada 15 s).

O banco ganhou `insignias`, `partidas_solo`, `desafios_dia`, `participacoes.patrulha` e o índice do histórico (migração 004).

## Regras da Etapa 4 (trocas, missão e conta)

- **Feira de Trocas (A7).** Casa nova do tabuleiro, no lugar de uma Agência (a casa sem pergunta, para não tirar cartas). O jogador troca um item do kit por outro e **nenhum BC muda de conta**. O baú da Feira troca na hora por um item que custa o mesmo ou menos. Nas salas também dá para oferecer a troca aos outros: quem aceitar primeiro (e tiver o item pedido e não tiver o oferecido) troca. Na sala de espera a oferta vale só na rodada; na sala com código vale na rodada e na seguinte. Sem itens no kit a casa não faz nada.
- **Missão da sala (F6).** Uma por partida, igual para todos, sorteada pela semente (6 missões, como "Armar a barraca: Lona, Corda e Panela"). Quem monta o conjunto primeiro ganha +15 pts. Vale nas salas e no jogo sozinho (contra os rivais); não existe no desafio do dia.
- **Leitura curta (F5).** Todas as 36 cartas têm um texto de até 15 palavras, já com a pergunta, para os Lobinhos lerem com o chefe ou um responsável. A escolha (completa ou curta) fica na entrada e é guardada no aparelho; em sala, cada jogador lê do seu jeito.
- **Conta do responsável.** A conta é sempre de um adulto. Ele informa o e-mail, declara ter 18 anos ou mais e ser responsável pela criança, e confirma com um código de 6 números, que vale 15 minutos e 5 tentativas (1 envio por minuto e no máximo 5 por e-mail por dia). O mesmo caminho cria a conta ou entra numa que já existe: o e-mail é o login. **Sem conta, só o jogo sozinho no aparelho**: salas, fila, desafio do dia, quadro de recordes, Minha trilha no servidor, `/api/solo` e o placar do dia respondem 401. Um jogador criado antes da conta do responsável (só apelido e ficha) vira um perfil quando um responsável entra com o e-mail no mesmo aparelho, e o histórico continua.
- **Perfis, como num serviço de streaming.** Cada conta tem até 6 perfis, um para cada criança, cada um com apelido, ficha, nível, partidas, insígnias, código de recuperação e escolha do quadro de recordes próprios. Conta nova nasce com o primeiro perfil; com mais de um, o aparelho pergunta "Quem vai jogar?". **Cada aparelho tem a sua sessão** (`sessoes`): entrar num aparelho não desconecta os outros, e cada aparelho fica com o perfil que escolheu. **O mesmo perfil joga em um aparelho por vez**: se ele abre as salas em outro aparelho, o anterior recebe `outro_aparelho`, sai da sala ou da fila sem sair da conta, e a partida continua no aparelho novo. Perfis diferentes jogam ao mesmo tempo. No aparelho, o desafio do dia já jogado, a partida salva e os resultados esperando conexão ficam marcados com o perfil. **O envio fica desligado enquanto não houver `SMTP_URL`**: sem isso não dá para criar conta, a API responde 503 e a tela avisa.
- **Minha trilha (conta).** O responsável troca o e-mail (o novo só vale depois de confirmar o código que chegar nele), escolhe se cada perfil aparece no quadro de recordes, gera o código de recuperação do perfil, cria, troca e apaga perfis, tira o aparelho da conta (só esta sessão acaba) e apaga a conta. Apagar a conta leva o e-mail, os perfis, as partidas, as insígnias, os códigos de recuperação e as sessões de todos os aparelhos. Nem o perfil nem a conta podem ser apagados com uma partida em andamento numa sala aberta, porque a sala ainda grava as jogadas dela. **Apagar pontuação pede o código enviado ao e-mail da conta**: um perfil com alguma partida ou insígnia, ou a conta quando algum perfil tem, só sai com o código (`/api/conta/codigo-apagar`, tabela `codigos_acao` da migração 008). Perfil sem nenhuma partida sai com a confirmação na tela. Assim uma criança com o aparelho na mão não apaga o progresso de ninguém sem o responsável.
- **Quadro de recordes.** Escolha do responsável, que pode tirar a conta do quadro quando quiser. Mostra só apelido, ficha e pontos, nunca o e-mail, e só para quem tem conta.
- **Código de recuperação.** Seis palavras de uma lista de 256 (48 bits), outra forma de entrar na conta sem o e-mail, já com o perfil escolhido. Aparece uma vez, na tela de Minha trilha; no banco fica só o HMAC. Quem digitar as palavras na entrada abre uma sessão no aparelho, com as insígnias e o histórico do perfil; os outros aparelhos continuam conectados. Gerar outro código invalida o anterior.
- **Medição de uso.** O aparelho conta, sem identificar ninguém, quantas partidas do jogo sozinho começaram e terminaram (`contador_solo`). `npm run metricas` mostra as quatro métricas do RFC (partidas terminadas, nova partida em 10 min, retorno em 7 dias e duração da rodada na sala de espera).

O banco ganhou `config`, `recuperacao`, `responsaveis`, `codigos_email`, `contador_solo` e `salas.missao` (migração 005). O estado do jogador passou para `v: 5`. A migração 006 fez da conta a do responsável: `responsaveis.no_quadro` e `declarou_maior_em`, e-mail único, `codigos_entrada` para entrar ou criar a conta, e `salas.anfitriao_id` com `ON DELETE SET NULL`, para apagar a conta de quem criou uma sala. A migração 007 trouxe os perfis: `contas` (o e-mail), `jogadores.conta_id` e `jogadores.no_quadro` (cada jogador é um perfil) e `sessoes` (um cookie por aparelho, com o perfil escolhido nele); `responsaveis` saiu e `codigos_email` passou a ser da conta.

### Como o servidor e a tela falam

Cada jogada do motor devolve uma `cena` (dado, andou, crédito, gasto, recusa, fogo, ponte...). O servidor guarda as últimas 16 e manda junto com o estado, para os outros celulares animarem; a tela segura cada estado até a animação anterior terminar e pula as animações se a fila atrasar. A partida do jogo sozinho salva no aparelho (`mt-solo`) mudou de formato (`v: 2`): a antiga é descartada com um aviso.

## Instalar no servidor (Docker Compose)

1. Aponte um domínio (por exemplo `mercado.seudominio.com.br`) para o servidor e libere as portas 80 e 443.
2. Copie o projeto e crie o `.env`:
   ```bash
   cp .env.example .env    # preencha DOMINIO, POSTGRES_PASSWORD e TRILHAHUB_URL
   ```
3. Gere o certificado HTTPS (só na primeira vez, com a porta 80 livre):
   ```bash
   docker run --rm -p 80:80 -v "$PWD/certbot/conf:/etc/letsencrypt" certbot/certbot \
     certonly --standalone -d "$DOMINIO" --agree-tos -m seu-email@exemplo.com --no-eff-email
   ```
4. Suba tudo:
   ```bash
   docker compose up -d --build
   ```
5. Renovação do certificado: agende no cron, uma vez por semana:
   ```bash
   docker run --rm -v "$PWD/certbot/conf:/etc/letsencrypt" -v "$PWD/certbot/www:/var/www/certbot" certbot/certbot renew --webroot -w /var/www/certbot \
     && docker compose exec nginx nginx -s reload
   ```

O serviço `backup` faz um `pg_dump` por dia em `backups/` e guarda os últimos 14. Copie essa pasta para fora do servidor.

Os registros de acesso (IP, data e hora, como pede o art. 15 do Marco Civil da Internet) ficam no volume `registros`, um arquivo por dia (`acesso-AAAA-MM-DD.log`), e o serviço `registros` apaga os de mais de 6 meses. Os logs do Docker de `app` e `nginx` têm tamanho limitado (5 arquivos de 10 MB).

O HTML, o JavaScript e o CSS saem com `Cache-Control: no-cache`: o navegador confere a versão a cada carga e nunca mistura tela velha com servidor novo. As imagens ficam um dia no cache.

Para atualizar o jogo: `git pull && docker compose up -d --build`.

### Variáveis de ambiente

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `DOMINIO` | — | Domínio do jogo (Nginx e certificado) |
| `POSTGRES_PASSWORD` | — | Senha do banco |
| `TRILHAHUB_URL` | `https://trilhahub.cloud` | Destino dos links "Conheça o Trilha HUB" (o jogo acrescenta `utm_source`, `utm_medium` e `utm_content`) |
| `COOKIE_SECURE` | `1` | Cookie só por HTTPS |
| `CONTAGEM_FILA_MS` | `80000` | Contagem da sala de espera |
| `RODADA_MS` | `45000` | Tempo de cada rodada na sala de espera |
| `INATIVIDADE_MS` | `7200000` | Sala com código fecha depois de 2 h sem jogadas |
| `INTERVALO_MS` | `10000` | Janela de votação do evento e do leilão entre rodadas |
| `SMTP_URL` | — | Liga o envio do código ao e-mail do responsável (`smtps://usuario:senha@servidor`). Sem isso não dá para criar a conta e só o jogo sozinho funciona |
| `EMAIL_DE` | `Mercado da Trilha <nao-responda@mercado.local>` | Remetente do e-mail |
| `SEGREDO_RECUPERACAO` | gerado e guardado no banco | Segredo do HMAC do código de recuperação. Defina em produção para ele não depender do banco |
| `EMAIL_MODO` | — | `teste` (guarda o código na memória e abre `/api/_teste/codigo`) ou `log` (escreve o código no log). **Só para desenvolvimento e testes** |
| `LIMITE_CONTA_X` | `1` | Multiplica os limites por minuto das rotas de conta e encurta na mesma proporção a espera de 1 minuto entre códigos; os testes de ponta a ponta usam 50 |

## Divulgação do Trilha HUB

Os links passam por `/r/<tela>`, que conta o clique por tela e por dia (tabela `cliques`, sem identificar o jogador) e redireciona para `TRILHAHUB_URL` com UTM. Hoje os links aparecem nas telas `entrada`, `carta`, `resultado` e `anfitriao`. O convite comercial aparece só nos espaços para adultos: cartão "Para chefes e responsáveis" no resultado e painel do anfitrião. Nada aparece durante a rodada.

Para ver os cliques:

```sql
SELECT slot, sum(total) FROM cliques GROUP BY slot ORDER BY 2 DESC;
```

## Apelidos

O apelido aparece no placar e no mural para outros jogadores, então o servidor recusa palavrões, ofensas e temas impróprios, inclusive com acento, números no lugar de letras ("m3rd4") e letras separadas ("m.e.r.d.a"). As listas ficam em `server/apelido.js`: `INTEIRAS` para palavras curtas, bloqueadas só como palavra inteira, e `RAIZES` para as que são bloqueadas mesmo dentro de outra palavra. Ao incluir uma raiz, confira se ela não aparece em palavras comuns (por exemplo, "puta" está em "disputa") e acrescente um caso em `test/apelido.test.js`. No jogo sozinho o apelido não é conferido, porque só o próprio jogador o vê.

## Cenário do tabuleiro

Três imagens com o mesmo enquadramento em `public/img/cenario/` (dia, noite e chuva), trocadas por fade conforme `climaDaRodada`: chuva na rodada do evento Chuva, noite na reta final, dia no resto. Os prompts, o processo de geração e os desvios desta versão estão em `docs/arte/cenario.md`.

## Fichas

As 12 fichas em `public/img/fichas/` são **provisórias**, desenhadas em SVG simples. Substitua pelas artes geradas por IA e revisadas, mantendo os mesmos nomes de arquivo (`f01.svg` a `f12.svg`, ou troque a extensão em `fichaSrc` no `app.js`) e os nomes em `FICHAS` no `engine.js`. Formato: redondo, 256 px, fundo transparente, uniforme genérico sem a flor-de-lis oficial nem logotipos dos Escoteiros do Brasil.

## Simulação de balanceamento

`test/sim.js` joga partidas com o motor e `test/balanceamento.test.js` confere faixas-alvo no `npm test`. O jogador de referência é o do RFC: compra tudo o que cabe, usa o dado duplo com 25 BC ou mais quando falta item e acerta 80% das cartas (50% para os rivais da mesa de 4). Contra o motor antigo (commit 0fc650a) a simulação reproduz o diagnóstico do RFC: 5,8 rodadas sem escolha (RFC: 5,9), 36% de vitória de quem sabe as regras, 95 BC de saldo final.

Cada etapa tem uma faixa mínima (`FAIXAS.etapa`) e o RFC define a meta de lançamento (`FAIXAS.lancamento`); `npm run simular` mostra as duas. Na Etapa 4 o jogo chega a 49% de vitória de quem sabe as regras (meta de lançamento: 44%, atingida), 0% de cartas repetidas em 3 partidas seguidas (meta: 15%, atingida), 0,2% de partidas sem comemoração (meta: 0%; a tela de resultado ainda comemora toda partida) e 18% de partidas com pagamento recusado (meta: 30% a 50%, ainda não). Os eventos de custo ajudaram (11% para 15%), mas não bastam: a recusa só sobe com mais pressão sobre o saldo (valor do dado duplo, pedágios ou o jogador de referência), uma decisão de design que o RFC não fecha.

## Próximos passos

- Trocar as fichas provisórias pelas artes finais.
- Confirmar o destino de `TRILHAHUB_URL`.
- Quadro de recordes, com e-mail do responsável confirmado por código (está desenhado no plano, ainda não foi implementado).
- Etapa 5 do RFC: fichas finais, revisão das 36 cartas pela chefia, teste com uma tropa e ajuste do balanceamento. A lista completa de pendências está em `todo.md`.

## 🤝 Contribuindo

Este projeto é open source e contribuições da comunidade são muito bem-vindas.

Você pode reportar bugs, sugerir funcionalidades, melhorar a documentação,
contribuir com código e criar traduções.

Leia o [CONTRIBUTING.md](CONTRIBUTING.md) antes de contribuir e consulte o
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

### Privacidade

Consulte o [PRIVACY.md](PRIVACY.md). Contribuidores não devem utilizar dados
reais de usuários em desenvolvimento ou testes.

### Segurança

Vulnerabilidades não devem ser publicadas com detalhes sensíveis em Issues.
Consulte o [SECURITY.md](SECURITY.md).

### Marcas

O código é MIT, mas marcas, logos e identidade visual do Trilha HUB não fazem
parte automaticamente da licença. Consulte o [TRADEMARKS.md](TRADEMARKS.md).

### Terceiros

Bibliotecas, imagens, sons e outros componentes podem possuir licenças
próprias. Consulte o [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
