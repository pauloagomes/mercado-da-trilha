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
npm test                                                # regras do jogo
CONTAGEM_FILA_MS=1500 RODADA_MS=1500 npm start          # num terminal
node test/e2e.mjs                                       # em outro: salas, fila e rodadas sincronizadas
```

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

## Divulgação do Trilha HUB

Os links passam por `/r/<tela>`, que conta o clique por tela e por dia (tabela `cliques`, sem identificar o jogador) e redireciona para `TRILHAHUB_URL` com UTM. Hoje os links aparecem nas telas `entrada`, `carta`, `resultado` e `anfitriao`. O convite comercial aparece só nos espaços para adultos: cartão "Para chefes e responsáveis" no resultado e painel do anfitrião. Nada aparece durante a rodada.

Para ver os cliques:

```sql
SELECT slot, sum(total) FROM cliques GROUP BY slot ORDER BY 2 DESC;
```

## Fichas

As 12 fichas em `public/img/fichas/` são **provisórias**, desenhadas em SVG simples. Substitua pelas artes geradas por IA e revisadas, mantendo os mesmos nomes de arquivo (`f01.svg` a `f12.svg`, ou troque a extensão em `fichaSrc` no `app.js`) e os nomes em `FICHAS` no `engine.js`. Formato: redondo, 256 px, fundo transparente, uniforme genérico sem a flor-de-lis oficial nem logotipos dos Escoteiros do Brasil.

## Próximos passos

- Trocar as fichas provisórias pelas artes finais.
- Confirmar o destino de `TRILHAHUB_URL`.
- Quadro de recordes, com e-mail do responsável confirmado por código (está desenhado no plano, ainda não foi implementado).
