# Mercado da Trilha — pendências

Estado: as etapas 1 a 4 do RFC "Mercado da Trilha mais divertido e interativo" estão implementadas na branch `feat/etapa-1-escolha-e-sensacao`, ainda sem PR e sem deploy.

## Etapa 5: pronto para lançar

- [ ] Trocar as 12 fichas provisórias pelas artes finais (mesmos nomes de arquivo, 256 px, sem flor-de-lis oficial nem logotipos).
- [ ] Cenário do tabuleiro: regenerar o Dia com araucárias e fogueira apagada num modelo melhor e refazer Noite e Chuva por edição dele (prompts e passo a passo em `docs/arte/cenario.md`). A versão atual não tem araucárias e uma palmeira invade a clareira.
- [x] Conferir a licença de uso comercial das imagens geradas pelo Higgsfield no plano usado: permitido em qualquer plano (seção 4.4 dos termos de 26/07/2026). Avaliação em `docs/arte/cenario.md`, seção "Direitos de uso".
- [ ] Revisar as 36 cartas com a chefia, contra os documentos da UEB: conferir cada fato (anos de 1907, 1908, 1910, 1924 e 1920, idades dos ramos, lemas, os 10 artigos da Lei, saudações, nomes dos nós e das técnicas) e avaliar se a dificuldade serve a cada ramo. Conferir também o nível de cada carta (12 de Lobinho, 15 de Escoteiro em diante e 9 de todos) e decidir se as cartas devem ganhar a arte de um personagem ou objeto (ver `ARTES_CARTAS` em `public/js/app.js`).
- [ ] Decidir se o Trilha HUB volta a aparecer depois das cartas. Sem perguntas sobre o sistema, a linha "No Trilha HUB..." saiu das cartas e o link da tela da carta não aparece mais.
- [ ] Teste com uma tropa real e ajuste do balanceamento a partir dele.
- [ ] Conferir as metas de lançamento com `npm run simular`. Em 22/10/2026, duas ficam fora: pagamento recusado (17,8% contra 30% a 50%) e partidas sem nenhuma comemoração (0,2% contra 0%).
- [x] **Conta criada pelo responsável.** O adulto entra ou cria a conta com o e-mail confirmado por código e a declaração de ter 18 anos ou mais (migração 006, `/api/conta/*`). Sem conta, só o jogo sozinho no aparelho. Entrar de novo pelo e-mail ou pelas 6 palavras; o quadro de recordes é escolha do responsável. README atualizado.
- [x] **Apagar a conta e trocar o e-mail em Minha trilha**, e sair do aparelho.
- [x] **Registros de acesso por 6 meses:** o nginx grava um arquivo por dia no volume `registros` e o serviço `registros` do docker-compose apaga os de mais de 6 meses. Confirmar no servidor depois de publicar.
- [x] **Perfis, como num serviço de streaming:** até 6 por e-mail, um para cada criança (migração 007).
- [x] **Apagar pontuação pede o código do e-mail:** perfil com partidas ou insígnias, ou a conta quando algum perfil tem (migração 008).
- [x] **Vários aparelhos conectados:** cada aparelho tem a sua sessão. O mesmo perfil joga em um aparelho por vez: ao abrir as salas em outro, o anterior sai da sala sem sair da conta.
- [ ] Publicar: confirmar o `TRILHAHUB_URL`, subir com `docker compose`, aplicar as migrações 002 a 009 (rodam sozinhas ao iniciar).

## Decisões em aberto

- [ ] Pagamento recusado abaixo da meta: decidir se mexe no valor do dado duplo, nos pedágios ou no jogador de referência da simulação.
- [ ] Ligar o e-mail do responsável em produção (`SMTP_URL`, `EMAIL_DE`). Com a conta criada pelo responsável, o e-mail deixa de ser opcional: sem ele só o jogo sozinho funciona. Nunca usar `EMAIL_MODO=log` ou `teste` em produção.
- [ ] Definir `SEGREDO_RECUPERACAO` em produção.
- [ ] Prazo de retenção dos dados: a política diz "enquanto a conta existir". Decidir se contas paradas há muito tempo são apagadas sozinhas (hoje não há limpeza automática de partidas, insígnias e histórico).
- [x] Contato para dúvidas e pedidos de remoção: GitHub do projeto (Issue sem dado pessoal; pedido sobre uma conta passa para um canal privado).
- [ ] Revisão jurídica da política de uso abaixo, principalmente por envolver crianças (LGPD).
- [x] Cache dos arquivos estáticos: HTML, JS e CSS saem com `no-cache` (o navegador confere a versão a cada carga), no nginx e no Node; imagens ficam um dia.

## Abertura como projeto open source

Já existem `LICENSE` (MIT, Paulo Afonso Gomes Fernandes Consultoria em Tecnologia da Informação LTDA, CNPJ 68.286.058/0001-87), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`, `SECURITY.md`, `TRADEMARKS.md` e `THIRD_PARTY_LICENSES.md`. Ainda faltam:

- [x] Reporte privado de vulnerabilidades do GitHub ligado em 21/10/2026. O `SECURITY.md`, o Código de Conduta e o `PRIVACY.md` apontam para o GitHub.
- [ ] Decidir a licença das fichas finais. O cenário, gerado por IA, foi para a MIT junto com o código (`docs/arte/cenario.md`, "Direitos de uso").
- [x] Repositório público em https://github.com/pauloagomes/mercado-da-trilha desde 21/10/2026 (`main` e esta branch, PR #1). Antes de publicar, o histórico foi conferido: sem `.env`, segredos, IPs ou e-mails reais.
- [ ] Traduções: o `CONTRIBUTING.md` aceita traduções, mas os textos da interface estão escritos direto no código, sem um sistema de tradução.
- [x] Modelos de Issue (erro e sugestão, com segurança e pedidos de conta fora das Issues públicas) e de Pull Request em `.github/`.
- [x] **Regra contra rastreamento.** Escrito no `CONTRIBUTING.md` e no `PRIVACY.md` que o jogo não aceita nenhum meio de monitorar ou rastrear quem joga: ferramentas de análise de terceiros, pixels de anúncio, impressão digital do aparelho, gravação de sessão, localização ou envio de dados para fora do servidor do projeto. Pull Request que traga algo assim é recusado. Os contadores anônimos de `server/metricas.js` continuam permitidos, desde que não identifiquem ninguém.

## Política de uso

Foi para o `PRIVACY.md`, seção "Como o Mercado da Trilha trata os dados" (conta do responsável, cookie `mt_token`, armazenamento no aparelho, registros de acesso e contadores anônimos). Revisar com o jurídico antes de publicar.



## ajustes visuais
- [x] Ajustes visuais
Cada quadrado, trazer um visual de pedra, como se fosse um caminho.
Crie uma animação para a fogueira quando estiver acessa.

Compactação do Topo: As informações e botões de controle foram unificados em uma linha sutil e elegante.

Tabuleiro Otimizado: Ele foi adaptado para o formato mobile, usando o centro com a clareira em 3D e focando as casas em ícones coloridos para preservar o espaço, tirando textos longos e tornando o tabuleiro ideal para toques rápidos.

Balão Temporário: A mensagem "Tirou 5 e caiu em Partida" agora aparece como um balão de fala leve, dinâmico e focado no peão do jogador, sem criar um grande bloco estático extra.

Objetivo Expansível: A "Missão da Sala" foi recolhida em uma aba moderna e discreta, que pode ser tocada para ler detalhes e não fica obstruindo a jogabilidade principal.

Ações Próximas ao Polegar: Toda a mecânica de jogo ("Rolar o Dado", "Dado Duplo") agora fica na área mais acessível do celular (o terço inferior), com botões grandes, de alta visibilidade e visual tátil.

Inventário Ilustrado: O "Kit de Acampamento" agora usa ícones ao invés de textos, com cada item acendendo à medida que é conquistado, sendo uma solução muito mais rápida de ler em uma tela menor.

O formato de pedra utilizado no tabuleiro assemelha-se a lajes espessas ou blocos de pavimentação rústica, esculpidos em formatos retangulares e quadrados. Os rebordos destas pedras são irregulares, arredondados e ligeiramente lascados, o que transmite uma sensação de desgaste natural pelo tempo, fugindo a linhas perfeitamente retas e artificiais.   A textura da superfície é visivelmente porosa e fosca, com pequenos relevos e fissuras que lembram materiais como a ardósia natural ou rochas graníticas. Embora a base dos blocos apresente um tom cinzento-escuro rochoso, o topo de cada pedra reflete suavemente a cor específica da sua respetiva casa no jogo (como verde, amarelo, roxo ou azul), integrando também os reflexos quentes e alaranjados projetados pela fogueira e pelas tochas próximas.   No centro do cenário, o anel da fogueira utiliza um formato de pedra distinto: trata-se de pedregulhos menores, totalmente brutos, assimétricos e não lapidados, dispostos de forma muito mais orgânica e sobreposta para conter o fogo no solo de terra. 

- [x] ao jogar dado duplo e cair dois iguais, jogar o segundo automaticamente até cair um número diferente.

- [x] ao clicar ou selecionar alguma ficha trazer ao centro e mostrar as informações da imagem, apelido e pontuação.

- [x] colocar uma animação na fogueira quando o cenário estiver exibindo.

- [x] colocar sons nas ações, acertos e erros, e colocar uma trila de fundo.

