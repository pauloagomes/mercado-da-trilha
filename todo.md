# Mercado da Trilha — pendências

Estado: as etapas 1 a 4 do RFC "Mercado da Trilha mais divertido e interativo" estão implementadas na branch `feat/etapa-1-escolha-e-sensacao`, ainda sem PR e sem deploy.

## Etapa 5: pronto para lançar

- [ ] Trocar as 12 fichas provisórias pelas artes finais (mesmos nomes de arquivo, 256 px, sem flor-de-lis oficial nem logotipos).
- [ ] Cenário do tabuleiro: regenerar o Dia com araucárias e fogueira apagada num modelo melhor e refazer Noite e Chuva por edição dele (prompts e passo a passo em `docs/arte/cenario.md`). A versão atual não tem araucárias e uma palmeira invade a clareira.
- [ ] Conferir a licença de uso comercial das imagens geradas pelo Higgsfield no plano usado.
- [ ] Revisar as 36 cartas contra a carteira de evento real do Trilha HUB (recarga por Pix, saldo máximo, aviso no WhatsApp, extrato por link, pulseira com apelido, QR bloqueado pela chefia).
- [ ] Teste com uma tropa real e ajuste do balanceamento a partir dele.
- [ ] Conferir as metas de lançamento com `npm run simular` (hoje só o pagamento recusado fica fora: 18% contra 30% a 50%).
- [ ] Publicar: confirmar o `TRILHAHUB_URL`, subir com `docker compose`, aplicar as migrações 002 a 005 (rodam sozinhas ao iniciar).

## Decisões em aberto

- [ ] Pagamento recusado abaixo da meta: decidir se mexe no valor do dado duplo, nos pedágios ou no jogador de referência da simulação.
- [ ] Ligar o e-mail do responsável em produção (`SMTP_URL`, `EMAIL_DE`) ou deixar o quadro de recordes fechado até lá. Nunca usar `EMAIL_MODO=log` ou `teste` em produção.
- [ ] Definir `SEGREDO_RECUPERACAO` em produção.
- [ ] Prazo de retenção dos dados (hoje não há limpeza automática de partidas, insígnias e histórico).
- [ ] Contato para dúvidas e pedidos de remoção, que a política abaixo cita.
- [ ] Revisão jurídica da política de uso abaixo, principalmente por envolver crianças (LGPD).
- [ ] Reduzir o cache dos arquivos estáticos (`maxAge: 1h`) ou versionar os arquivos: um cliente antigo com servidor novo pode falhar até o cache vencer.

## Abertura como projeto open source

Já existem `LICENSE` (MIT, Trilha HUB), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`, `SECURITY.md`, `TRADEMARKS.md` e `THIRD_PARTY_LICENSES.md`. Ainda faltam:

- [ ] Definir o **canal privado de segurança** que o `SECURITY.md` pede (por exemplo, o reporte privado de vulnerabilidades do GitHub ou um e-mail) e o canal de contato que o Código de Conduta e o `PRIVACY.md` citam.
- [ ] Decidir a licença das artes (fichas e cenário): pelo `TRADEMARKS.md` e pelo `THIRD_PARTY_LICENSES.md` elas não entram na MIT, mas também não têm licença própria ainda. Conferir os termos de uso das imagens geradas por IA no plano usado.
- [ ] Publicar o repositório: hoje ele não tem remoto (`git remote -v` vazio). O histórico não tem `.env` nem segredos versionados.
- [ ] Traduções: o `CONTRIBUTING.md` aceita traduções, mas os textos da interface estão escritos direto no código, sem um sistema de tradução.
- [ ] Opcional: modelos de Issue e de Pull Request em `.github/`, com os campos que o `CONTRIBUTING.md` pede.

## Política de uso

Foi para o `PRIVACY.md`, seção "Como o Mercado da Trilha trata os dados hoje" (cookie `mt_token`, armazenamento no aparelho, e-mail do responsável e contadores anônimos). Revisar com o jurídico antes de publicar.
