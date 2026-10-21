# Privacy Policy

## Objetivo

Esta política explica, em termos gerais, como dados relacionados ao jogo são
tratados.

## Dados dos jogadores

O projeto deve coletar somente os dados necessários para oferecer suas
funcionalidades, quando aplicável.

Os dados dos usuários não serão vendidos, cedidos ou disponibilizados a
terceiros para fins comerciais, salvo quando houver necessidade legítima de
prestação de serviço, obrigação legal ou consentimento aplicável.

## Uso por contribuidores

Contribuidores do projeto não estão autorizados a utilizar dados reais de
usuários para desenvolvimento, testes, demonstrações, exemplos, Issues ou
Pull Requests.

Quando dados forem necessários para testes, devem ser utilizados dados
fictícios, anonimizados ou ambientes apropriados de desenvolvimento.

## Trilha Hub

O jogo pode fazer referências ao aplicativo e à plataforma Trilha Hub. Essas
referências podem aparecer na interface, documentação ou experiência do jogo
como parte da integração ou identidade do projeto.

Essas referências não devem ser interpretadas como publicidade forçada ou
obrigatória.

Marcas, logos e identidade visual do Trilha Hub são tratados separadamente da
licença MIT do código e permanecem protegidos pelos direitos aplicáveis.

## Como o Mercado da Trilha trata os dados hoje

> Resumo do funcionamento atual, para jogadores e responsáveis. Revisar com o jurídico antes de publicar, principalmente por envolver crianças.

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

**Contato.** Pelos canais oficiais do projeto (ainda a definir; ver `SECURITY.md` para assuntos de segurança).

## Terceiros

Serviços de terceiros utilizados pelo jogo podem possuir suas próprias
políticas de privacidade e termos de uso.

## Traduções

A versão oficial desta política é a definida pelos mantenedores. Traduções
comunitárias podem ser disponibilizadas para facilitar o acesso internacional.
Em caso de conflito, a versão oficial prevalece.

## Legislação

O projeto deve observar as obrigações legais aplicáveis ao tratamento de dados,
incluindo, quando aplicável, a legislação brasileira de proteção de dados.

Esta documentação não substitui aconselhamento jurídico.

## Atualizações

Esta política pode ser atualizada conforme o projeto evoluir.
