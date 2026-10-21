# Mercado da Trilha

Jogo de treino da conta digital para escoteiros. Cada jogador monta o Kit de Acampamento gastando **BadenCoin (BC)** nas barracas, confere cada gasto e responde cartas sobre as regras da carteira de evento do Trilha HUB. O jogo não tem integração com o Trilha HUB.

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
npm start                      # http://localhost:3000
```

O servidor aplica as migrações de `server/migrations` sozinho ao iniciar. Para usar outro banco, defina `DATABASE_URL`.

Testes:

```bash
npm test                                                # regras do jogo e simulação de balanceamento
npm run simular                                         # métricas do RFC com o motor atual (4000 partidas por medida)
DATABASE_URL=postgres://... npm run test:integracao     # salas no PostgreSQL: guardião, leilão, votação, patrulhas, revanche, insígnias
EMAIL_MODO=teste LIMITE_CONTA_X=50 INTERVALO_MS=800 CONTAGEM_FILA_MS=1500 RODADA_MS=1500 npm start   # num terminal
npm run metricas                                        # métricas de uso do RFC, direto do banco
node test/e2e.mjs                                       # em outro: salas, fila e rodadas sincronizadas
```

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
- **Sensação de jogo (D0 a D3, D5).** Tabuleiro e peões ficam na tela e só os painéis são redesenhados; o peão anda casa a casa, o dado gira no centro, moedas voam para o saldo e o número conta. Sons curtos gerados no navegador (Web Audio, sem arquivo) e vibração curta no Android; o botão do topo liga e desliga, e a escolha fica no aparelho. Com "reduzir movimento" as animações viram troca direta.

## Regras da Etapa 4 (trocas, missão e conta)

- **Feira de Trocas (A7).** Casa nova do tabuleiro, no lugar de uma Agência (a casa sem pergunta, para não tirar cartas). O jogador troca um item do kit por outro e **nenhum BC muda de conta**. O baú da Feira troca na hora por um item que custa o mesmo ou menos. Nas salas também dá para oferecer a troca aos outros: quem aceitar primeiro (e tiver o item pedido e não tiver o oferecido) troca. Na sala de espera a oferta vale só na rodada; na sala com código vale na rodada e na seguinte. Sem itens no kit a casa não faz nada.
- **Missão da sala (F6).** Uma por partida, igual para todos, sorteada pela semente (6 missões, como "Armar a barraca: Lona, Corda e Panela"). Quem monta o conjunto primeiro ganha +15 pts. Vale nas salas e no jogo sozinho (contra os rivais); não existe no desafio do dia.
- **Leitura curta (F5).** Todas as 36 cartas têm um texto de até 15 palavras, já com a pergunta, para os Lobinhos lerem com o chefe ou um responsável. A escolha (completa ou curta) fica na entrada e é guardada no aparelho; em sala, cada jogador lê do seu jeito.
- **Código de recuperação.** Seis palavras de uma lista de 256 (48 bits). Aparece uma vez, na tela de Minha trilha; no banco fica só o HMAC. Quem digitar as palavras na entrada recupera a conta, as insígnias e o histórico em outro aparelho (o aparelho antigo sai, porque cada jogador tem um só cookie). Gerar outro código invalida o anterior.
- **E-mail do responsável e quadro de recordes.** Para aparecer no quadro, o responsável informa o e-mail e confirma com um código de 6 números, que vale 15 minutos e 5 tentativas (1 envio por minuto, no máximo 5 por e-mail por dia). O quadro mostra só apelido, ficha e pontos, nunca o e-mail. O responsável sai do quadro e apaga o e-mail quando quiser. **O envio fica desligado enquanto não houver `SMTP_URL`**: sem isso a API responde 503 e a tela avisa.
- **Medição de uso.** O aparelho conta, sem identificar ninguém, quantas partidas do jogo sozinho começaram e terminaram (`contador_solo`). `npm run metricas` mostra as quatro métricas do RFC (partidas terminadas, nova partida em 10 min, retorno em 7 dias e duração da rodada na sala de espera).

O banco ganhou `config`, `recuperacao`, `responsaveis`, `codigos_email`, `contador_solo` e `salas.missao` (migração 005). O estado do jogador passou para `v: 5`.

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
| `SMTP_URL` | — | Liga o envio do código ao e-mail do responsável (`smtps://usuario:senha@servidor`). Sem isso o recurso fica desligado |
| `EMAIL_DE` | `Mercado da Trilha <nao-responda@mercado.local>` | Remetente do e-mail |
| `SEGREDO_RECUPERACAO` | gerado e guardado no banco | Segredo do HMAC do código de recuperação. Defina em produção para ele não depender do banco |
| `EMAIL_MODO` | — | `teste` (guarda o código na memória e abre `/api/_teste/codigo`) ou `log` (escreve o código no log). **Só para desenvolvimento e testes** |
| `LIMITE_CONTA_X` | `1` | Multiplica os limites por minuto das rotas de conta; os testes de ponta a ponta usam 50 |

## Divulgação do Trilha HUB

Os links passam por `/r/<tela>`, que conta o clique por tela e por dia (tabela `cliques`, sem identificar o jogador) e redireciona para `TRILHAHUB_URL` com UTM. Hoje os links aparecem nas telas `entrada`, `carta`, `resultado` e `anfitriao`. O convite comercial aparece só nos espaços para adultos: cartão "Para chefes e responsáveis" no resultado e painel do anfitrião. Nada aparece durante a rodada.

Para ver os cliques:

```sql
SELECT slot, sum(total) FROM cliques GROUP BY slot ORDER BY 2 DESC;
```

## Apelidos

O apelido aparece no placar e no mural para outros jogadores, então o servidor recusa palavrões, ofensas e temas impróprios, inclusive com acento, números no lugar de letras ("m3rd4") e letras separadas ("m.e.r.d.a"). As listas ficam em `server/apelido.js`: `INTEIRAS` para palavras curtas, bloqueadas só como palavra inteira, e `RAIZES` para as que são bloqueadas mesmo dentro de outra palavra. Ao incluir uma raiz, confira se ela não aparece em palavras comuns (por exemplo, "puta" está em "disputa") e acrescente um caso em `test/apelido.test.js`. No jogo sozinho o apelido não é conferido, porque só o próprio jogador o vê.

## Fichas

As 12 fichas em `public/img/fichas/` são **provisórias**, desenhadas em SVG simples. Substitua pelas artes geradas por IA e revisadas, mantendo os mesmos nomes de arquivo (`f01.svg` a `f12.svg`, ou troque a extensão em `fichaSrc` no `app.js`) e os nomes em `FICHAS` no `engine.js`. Formato: redondo, 256 px, fundo transparente, uniforme genérico sem a flor-de-lis oficial nem logotipos dos Escoteiros do Brasil.

## Simulação de balanceamento

`test/sim.js` joga partidas com o motor e `test/balanceamento.test.js` confere faixas-alvo no `npm test`. O jogador de referência é o do RFC: compra tudo o que cabe, usa o dado duplo com 25 BC ou mais quando falta item e acerta 80% das cartas (50% para os rivais da mesa de 4). Contra o motor antigo (commit 0fc650a) a simulação reproduz o diagnóstico do RFC: 5,8 rodadas sem escolha (RFC: 5,9), 36% de vitória de quem sabe as regras, 95 BC de saldo final.

Cada etapa tem uma faixa mínima (`FAIXAS.etapa`) e o RFC define a meta de lançamento (`FAIXAS.lancamento`); `npm run simular` mostra as duas. Na Etapa 4 o jogo chega a 49% de vitória de quem sabe as regras (meta de lançamento: 44%, atingida), 0% de cartas repetidas em 3 partidas seguidas (meta: 15%, atingida), 0,2% de partidas sem comemoração (meta: 0%; a tela de resultado ainda comemora toda partida) e 18% de partidas com pagamento recusado (meta: 30% a 50%, ainda não). Os eventos de custo ajudaram (11% para 15%), mas não bastam: a recusa só sobe com mais pressão sobre o saldo (valor do dado duplo, pedágios ou o jogador de referência), uma decisão de design que o RFC não fecha.

## Próximos passos

- Trocar as fichas provisórias pelas artes finais.
- Confirmar o destino de `TRILHAHUB_URL`.
- Quadro de recordes, com e-mail do responsável confirmado por código (está desenhado no plano, ainda não foi implementado).
- Etapa 5 do RFC: fichas finais, revisão das 36 cartas contra a carteira real, teste com uma tropa e ajuste do balanceamento. A lista completa de pendências está em `todo.md`.
