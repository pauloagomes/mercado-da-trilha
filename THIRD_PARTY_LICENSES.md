# Third-Party Licenses

O projeto pode utilizar bibliotecas, fontes, imagens, sons, frameworks,
sprites, ferramentas e outros componentes de terceiros.

Cada componente de terceiros permanece sujeito à sua própria licença e aos
respectivos termos.

## Regras

Antes de incorporar um componente de terceiros, verifique:

- Sua licença.
- Permissão para uso comercial, quando aplicável.
- Requisitos de atribuição.
- Obrigações de distribuição do código ou dos arquivos.
- Restrições sobre marcas e conteúdo.
- Compatibilidade com a licença do projeto.

## Registro

Sempre que aplicável, mantenha neste arquivo ou em uma documentação
relacionada:

- Nome do componente.
- Versão.
- Autor ou projeto de origem.
- Licença.
- Link para a licença ou projeto.
- Requisitos de atribuição.

Componentes de terceiros não passam automaticamente a ser licenciados sob MIT.

## Registro atual

Levantado em 22/10/2026 a partir do `package-lock.json`, do `Dockerfile`, do `docker-compose.yml` e da pasta `public/`.

### Bibliotecas (dependências de produção)

| Componente | Versão | Licença | Origem |
| --- | --- | --- | --- |
| fastify | 5.12.7 | MIT | https://github.com/fastify/fastify |
| @fastify/cookie | 11.1.3 | MIT | https://github.com/fastify/fastify-cookie |
| @fastify/rate-limit | 10.3.0 | MIT | https://github.com/fastify/fastify-rate-limit |
| @fastify/static | 10.1.6 | MIT | https://github.com/fastify/fastify-static |
| @fastify/websocket | 11.3.4 | MIT | https://github.com/fastify/fastify-websocket |
| pg | 8.23.1 | MIT | https://github.com/brianc/node-postgres |
| nodemailer | 10.2.0 | MIT-0 | https://github.com/nodemailer/nodemailer |

Com as dependências indiretas são 97 pacotes: 79 MIT, 8 ISC, 5 BlueOak-1.0.0 (glob, lru-cache, minimatch, minipass, path-scurry), 4 BSD-3-Clause (fast-uri, light-my-request, secure-json-parse) e 1 MIT-0. Todas são permissivas e compatíveis com a MIT. Para listar de novo: `npm ls --omit=dev --all --parseable` e o campo `license` de cada `package.json`.

Só para desenvolvimento e testes: `ws` 8.22.0 (MIT), https://github.com/websockets/ws.

### Imagens Docker (não fazem parte do código distribuído)

| Imagem | Uso | Licença do software principal |
| --- | --- | --- |
| `node:22-alpine` | Servidor do jogo | Node.js: MIT (a imagem inclui pacotes do Alpine com licenças próprias) |
| `postgres:16-alpine` | Banco e backup | PostgreSQL License |
| `nginx:1.27-alpine` | HTTPS e arquivos estáticos | BSD-2-Clause |
| `alpine:3.20` | Limpeza dos registros de acesso com mais de 6 meses | Pacotes do Alpine com licenças próprias (BusyBox: GPL-2.0) |

### Imagens, sons, ícones e fontes

| Componente | Origem | Situação |
| --- | --- | --- |
| Fichas (`public/img/fichas/f01.svg` a `f12.svg`) | Desenhadas para o projeto, provisórias | Serão trocadas pelas artes finais; licença das artes a definir |
| Cenário (`public/img/cenario/*.webp`) | Gerado por IA no Higgsfield (Z Image e Seedream 5.0 Flash), em 21/10/2026 | Uso comercial permitido pelos Termos de Uso do Higgsfield (versão de 26/07/2026, seção 4.4), em qualquer plano. Distribuídas junto com o código, sob a MIT. Avaliação completa em `docs/arte/cenario.md`, seção "Direitos de uso" |
| Ícones do jogo (SVG dentro do `index.html`) | Desenhados para o projeto | Mesma licença do código |
| Sons | Gerados no navegador pela Web Audio API, sem arquivos | Mesma licença do código |
| Fontes | Só as fontes do sistema (nenhuma fonte é baixada) | Não se aplica |
