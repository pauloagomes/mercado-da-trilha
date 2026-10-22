# Mercado da Trilha — pendências

Estado: as etapas 1 a 4 do RFC "Mercado da Trilha mais divertido e interativo" estão implementadas na branch `feat/etapa-1-escolha-e-sensacao`, ainda sem PR e sem deploy.

## Etapa 5: pronto para lançar

- [ ] Trocar as 12 fichas provisórias pelas artes finais (mesmos nomes de arquivo, 256 px, sem flor-de-lis oficial nem logotipos).
- [ ] Cenário do tabuleiro: regenerar o Dia com araucárias e fogueira apagada num modelo melhor e refazer Noite e Chuva por edição dele (prompts e passo a passo em `docs/arte/cenario.md`). A versão atual não tem araucárias e uma palmeira invade a clareira.
- [x] Conferir a licença de uso comercial das imagens geradas pelo Higgsfield no plano usado: permitido em qualquer plano (seção 4.4 dos termos de 26/07/2026). Avaliação em `docs/arte/cenario.md`, seção "Direitos de uso".
- [ ] Revisar as 36 cartas contra a carteira de evento real do Trilha HUB (recarga por Pix, saldo máximo, aviso no WhatsApp, extrato por link, pulseira com apelido, QR bloqueado pela chefia).
- [ ] Teste com uma tropa real e ajuste do balanceamento a partir dele.
- [ ] Conferir as metas de lançamento com `npm run simular` (hoje só o pagamento recusado fica fora: 18% contra 30% a 50%).
- [ ] **Conta criada pelo responsável (bloqueia o lançamento).** A política (`PRIVACY.md`) diz que não guardamos dados de menores e que a conta é de um adulto, criada com o e-mail dele. Hoje `POST /api/eu` cria o jogador no servidor só com apelido e ficha, sem adulto nenhum. Falta:
  - criar a conta a partir do e-mail confirmado por código (o fluxo de `server/conta.js` já existe, mas hoje é opcional e vem depois do apelido), com a declaração de que quem cria é maior de 18 anos e responsável pela criança;
  - sem conta, só o jogo sozinho no aparelho: salas, desafio do dia, `/api/solo`, recordes e Minha trilha passam a exigir a conta;
  - entrar de novo com o e-mail (código), além do código de 6 palavras;
  - o quadro de recordes vira uma escolha do responsável, e não mais o motivo de informar o e-mail;
  - atualizar a seção "E-mail do responsável e quadro de recordes" do README.
- [ ] **Apagar a conta em Minha trilha** (o `ON DELETE CASCADE` de `jogadores` já leva partidas, insígnias, recuperação e e-mail) e trocar o e-mail. A política promete as duas coisas.
- [ ] **Guardar os registros de acesso por 6 meses** (Marco Civil, art. 15), como a política diz: hoje o log do Fastify e do nginx vai para o log do Docker, sem prazo definido.
- [ ] Publicar: confirmar o `TRILHAHUB_URL`, subir com `docker compose`, aplicar as migrações 002 a 005 (rodam sozinhas ao iniciar).

## Decisões em aberto

- [ ] Pagamento recusado abaixo da meta: decidir se mexe no valor do dado duplo, nos pedágios ou no jogador de referência da simulação.
- [ ] Ligar o e-mail do responsável em produção (`SMTP_URL`, `EMAIL_DE`). Com a conta criada pelo responsável, o e-mail deixa de ser opcional: sem ele só o jogo sozinho funciona. Nunca usar `EMAIL_MODO=log` ou `teste` em produção.
- [ ] Definir `SEGREDO_RECUPERACAO` em produção.
- [ ] Prazo de retenção dos dados: a política diz "enquanto a conta existir". Decidir se contas paradas há muito tempo são apagadas sozinhas (hoje não há limpeza automática de partidas, insígnias e histórico).
- [x] Contato para dúvidas e pedidos de remoção: GitHub do projeto (Issue sem dado pessoal; pedido sobre uma conta passa para um canal privado).
- [ ] Revisão jurídica da política de uso abaixo, principalmente por envolver crianças (LGPD).
- [ ] Reduzir o cache dos arquivos estáticos (`maxAge: 1h`) ou versionar os arquivos: um cliente antigo com servidor novo pode falhar até o cache vencer.

## Abertura como projeto open source

Já existem `LICENSE` (MIT, Paulo Afonso Gomes Fernandes Consultoria em Tecnologia da Informação LTDA, CNPJ 68.286.058/0001-87), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`, `SECURITY.md`, `TRADEMARKS.md` e `THIRD_PARTY_LICENSES.md`. Ainda faltam:

- [ ] Ao criar o repositório no GitHub, **ligar o reporte privado de vulnerabilidades** (Settings → Code security → Private vulnerability reporting). O `SECURITY.md`, o Código de Conduta e o `PRIVACY.md` já apontam para o GitHub.
- [ ] Decidir a licença das fichas finais. O cenário, gerado por IA, foi para a MIT junto com o código (`docs/arte/cenario.md`, "Direitos de uso").
- [ ] Publicar o repositório: hoje ele não tem remoto (`git remote -v` vazio). O histórico não tem `.env` nem segredos versionados.
- [ ] Traduções: o `CONTRIBUTING.md` aceita traduções, mas os textos da interface estão escritos direto no código, sem um sistema de tradução.
- [ ] Opcional: modelos de Issue e de Pull Request em `.github/`, com os campos que o `CONTRIBUTING.md` pede.

## Política de uso

Foi para o `PRIVACY.md`, seção "Como o Mercado da Trilha trata os dados" (conta do responsável, cookie `mt_token`, armazenamento no aparelho, registros de acesso e contadores anônimos). Revisar com o jurídico antes de publicar.
