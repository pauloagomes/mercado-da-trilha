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

O README, o `CONTRIBUTING.md` e o `CODE_OF_CONDUCT.md` já tratam o projeto como open source, mas ainda faltam:

- [ ] **Escolher e adicionar uma licença** (`LICENSE` e o campo `license` do `package.json`). Sem licença, ninguém tem permissão legal de usar, copiar ou modificar o código, mesmo com o repositório público.
- [ ] Decidir a licença das artes (fichas e cenário), que pode ser diferente da do código, e conferir os termos de uso das imagens geradas por IA.
- [ ] Publicar o repositório: hoje ele não tem remoto (`git remote -v` vazio).
- [ ] Definir o canal oficial de contato dos mantenedores, que o Código de Conduta cita para reportar problemas.
- [ ] Antes de publicar, conferir que o histórico do git não tem segredos (o `.env` está no `.gitignore`; os testes usam só senhas de desenvolvimento).
- [ ] Opcional: modelos de Issue e de Pull Request em `.github/`, com os campos que o `CONTRIBUTING.md` pede.

## Política de uso (rascunho simples)

> Rascunho para revisão antes de publicar. Fica visível para jogadores e responsáveis.

**O que é o jogo.** O Mercado da Trilha é um jogo de treino do Trilha HUB. A moeda, o BadenCoin (BC), é de brincadeira: não existe dinheiro de verdade, compra ou pagamento no jogo.

**Quem joga.** Crianças e jovens a partir dos 7 anos, de preferência acompanhados por um responsável ou pela chefia. Os Lobinhos jogam acompanhados.

**Que dados usamos.**
- **Apelido e ficha.** O jogador escolhe. Não pedimos nome real, idade, foto, telefone nem localização. Apelidos com palavrões ou ofensas são recusados.
- **Partidas.** Pontos, saldo final, insígnias e histórico de cada partida, ligados ao apelido e ao cookie do aparelho.
- **E-mail do responsável (opcional).** Só se o jogador quiser aparecer no quadro de recordes. Serve apenas para confirmar que o responsável autorizou, com um código enviado por e-mail. Nunca aparece no quadro nem para outros jogadores.
- **Contadores anônimos.** Quantas partidas do jogo sozinho começaram e terminaram por dia, e quantas vezes cada link do Trilha HUB foi clicado por tela. Ninguém é identificado nessas contagens.

**O que não existe.** Não há chat livre (só seis reações prontas), propaganda, venda, caixa-surpresa nem compra com dinheiro de verdade. O Trilha HUB só aparece na entrada, depois de uma carta, no resultado e no painel do anfitrião, nunca durante a rodada.

**Cookies.** O jogo usa **um único cookie**, o `mt_token`:

| Cookie | Para que serve | Duração | Detalhes |
| --- | --- | --- | --- |
| `mt_token` | Reconhecer o mesmo jogador anônimo em salas e na recuperação de conta | 1 ano | Só do próprio site, `HttpOnly` (o JavaScript da página não lê), `SameSite=Lax` e `Secure` em produção. Guardamos só uma versão embaralhada (hash) dele |

Esse cookie é necessário para as salas funcionarem, não é usado para propaganda nem para acompanhar o jogador em outros sites, e não há cookies de terceiros nem ferramentas de análise externas. Por isso o jogo não mostra banner de cookies. Apagar os cookies faz o aparelho esquecer a conta; com o código de recuperação de 6 palavras dá para recuperá-la.

**Armazenamento no aparelho (não é cookie).** O navegador guarda, só no aparelho, as preferências (`mt-perfil`, `mt-rodadas`, `mt-leitura`, `mt-som`), a partida salva e a sala atual (`mt-solo`, `mt-sala`), recordes, histórico, insígnias e cartas já vistas (`mt-recorde`, `mt-recorde-desafio`, `mt-historico`, `mt-insignias`, `mt-vistas`), o desafio do dia já jogado (`mt-desafio-AAAA-MM-DD`) e o que está esperando conexão para ser enviado (`mt-envios`, `mt-contador`). Limpar os dados do site apaga tudo isso.

**Código de recuperação.** São 6 palavras que aparecem uma vez. Quem tiver essas palavras entra na conta, então devem ser guardadas com cuidado. No servidor fica apenas uma impressão digital (HMAC) delas, nunca as palavras. Gerar outro código invalida o anterior.

**Direitos do responsável.** O responsável pode sair do quadro de recordes e apagar o e-mail a qualquer momento, em Minha trilha. Para apagar o restante dos dados do jogador (apelido, partidas, insígnias), é só pedir pelo contato abaixo.

**Salas.** Salas com código fecham sozinhas depois de 2 horas sem jogadas. O anfitrião vê o apelido de quem está na sala, e todos veem o placar e o mural.

**Contato.** (pendente: informar o e-mail do responsável pelo jogo)
