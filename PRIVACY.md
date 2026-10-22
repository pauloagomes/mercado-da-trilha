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

## Trilha HUB

O jogo pode fazer referências ao aplicativo e à plataforma Trilha HUB. Essas
referências podem aparecer na interface, documentação ou experiência do jogo
como parte da integração ou identidade do projeto.

Essas referências não devem ser interpretadas como publicidade forçada ou
obrigatória.

Marcas, logos e identidade visual do Trilha HUB são tratados separadamente da
licença MIT do código e permanecem protegidos pelos direitos aplicáveis.

## Quem é o controlador

O Mercado da Trilha é mantido pela **Paulo Afonso Gomes Fernandes Consultoria
em Tecnologia da Informação LTDA** (CNPJ 68.286.058/0001-87), que decide como
os dados do jogo publicado são tratados (controladora, na LGPD). Quem rodar uma
cópia do código no próprio servidor é o controlador dessa cópia.

## Como o Mercado da Trilha trata os dados

> Este é o modelo de lançamento: a conta é criada pelo responsável. Enquanto o
> jogo ainda deixar uma criança criar conta sozinha só com um apelido (ver
> `todo.md`), ele não deve ser publicado. Revisar com o jurídico antes de
> publicar.

**O que é o jogo.** O Mercado da Trilha é um jogo de treino do Trilha HUB. A moeda, o BadenCoin (BC), é de brincadeira: não existe dinheiro de verdade, compra ou pagamento no jogo.

**Quem joga e de quem é a conta.** Jogam crianças e jovens a partir dos 7 anos, de preferência acompanhados por um responsável ou pela chefia. Os Lobinhos jogam acompanhados. **A conta é sempre de um adulto**: o pai, a mãe ou o responsável legal, com 18 anos ou mais, cria a conta com o próprio e-mail e a confirma com um código. A criança joga dentro da conta do responsável.

**Não guardamos dados da criança.** O jogo não pede nome, idade, data de nascimento, foto, voz, escola, grupo escoteiro, telefone nem localização da criança. O apelido usado no jogo não deve ser o nome real nem algo que identifique a criança, e apelidos com palavrões ou ofensas são recusados.

**Sem conta.** O jogo sozinho funciona sem conta e fica só no aparelho. Nada sobre a partida vai para o servidor além dos contadores anônimos abaixo. Salas, desafio do dia, quadro de recordes e Minha trilha exigem a conta do responsável.

**Que dados usamos.**
- **E-mail do responsável.** É o único dado pessoal do jogo. Serve para criar e recuperar a conta e para confirmar, com um código, que é o responsável quem está no comando. Nunca aparece para outros jogadores nem no quadro de recordes, e não é usado para propaganda.
- **Apelido e ficha** escolhidos para jogar.
- **Partidas.** Pontos, saldo final, insígnias e histórico de cada partida, ligados à conta do responsável.
- **Quadro de recordes (opcional).** Mostra apelido, ficha e pontos. Só entra quem o responsável inscrever, e ele pode tirar a conta do quadro quando quiser.
- **Contadores anônimos.** Quantas partidas do jogo sozinho começaram e terminaram por dia, e quantas vezes cada link do Trilha HUB foi clicado por tela. Ninguém é identificado nessas contagens.
- **Registros de acesso.** Endereço IP, data e hora de cada acesso ao servidor, usados para segurança e guardados por 6 meses, como o Marco Civil da Internet (Lei 12.965/2014, art. 15) exige de quem oferece um serviço na internet.

**O que não existe.** Não há chat livre (só seis reações prontas), propaganda, venda, caixa-surpresa nem compra com dinheiro de verdade. O Trilha HUB só aparece na entrada, depois de uma carta, no resultado e no painel do anfitrião, nunca durante a rodada.

**Cookies.** O jogo usa **um único cookie**, o `mt_token`:

| Cookie | Para que serve | Duração | Detalhes |
| --- | --- | --- | --- |
| `mt_token` | Manter a conta conectada no aparelho, nas salas e na recuperação de conta | 1 ano | Só do próprio site, `HttpOnly` (o JavaScript da página não lê), `SameSite=Lax` e `Secure` em produção. Guardamos só uma versão embaralhada (hash) dele |

Esse cookie é necessário para as salas funcionarem, não é usado para propaganda nem para acompanhar ninguém em outros sites, e não há cookies de terceiros nem ferramentas de análise externas. Por isso o jogo não mostra banner de cookies. Apagar os cookies desconecta o aparelho da conta; o responsável entra de novo com o e-mail ou com o código de recuperação.

**Armazenamento no aparelho (não é cookie).** O navegador guarda, só no aparelho, as preferências (`mt-perfil`, `mt-rodadas`, `mt-leitura`, `mt-som`), a partida salva e a sala atual (`mt-solo`, `mt-sala`), recordes, histórico, insígnias e cartas já vistas (`mt-recorde`, `mt-recorde-desafio`, `mt-historico`, `mt-insignias`, `mt-vistas`), o desafio do dia já jogado (`mt-desafio-AAAA-MM-DD`) e o que está esperando conexão para ser enviado (`mt-envios`, `mt-contador`). Limpar os dados do site apaga tudo isso.

**Código de recuperação.** São 6 palavras que aparecem uma vez. Quem tiver essas palavras entra na conta, então o responsável deve guardá-las com cuidado. No servidor fica apenas uma impressão digital (HMAC) delas, nunca as palavras. Gerar outro código invalida o anterior.

**Por quanto tempo.** Os dados da conta ficam guardados enquanto a conta existir. Apagar a conta apaga o e-mail, o apelido, as partidas, as insígnias e o código de recuperação. Os registros de acesso seguem o prazo de 6 meses.

**Direitos do responsável.** Em Minha trilha, o responsável vê os dados da conta, troca o e-mail, tira a conta do quadro de recordes e apaga a conta inteira quando quiser. Para qualquer outro pedido previsto na LGPD (art. 18), use o contato abaixo.

**Salas.** Salas com código fecham sozinhas depois de 2 horas sem jogadas. O anfitrião vê o apelido de quem está na sala, e todos veem o placar e o mural.

**Contato.** Pelo GitHub do projeto. Para dúvidas, abra uma Issue sem colocar e-mail, apelido ou qualquer outro dado pessoal; se o pedido for sobre uma conta, diga só isso na Issue e combinamos um canal privado. Assuntos de segurança seguem o `SECURITY.md`.

## Terceiros

Serviços de terceiros utilizados pelo jogo podem possuir suas próprias
políticas de privacidade e termos de uso.

Para funcionar, o jogo publicado usa dois serviços contratados: a hospedagem
do servidor e o provedor que envia o e-mail com o código. Eles tratam os dados
só para prestar esse serviço, e nenhum dado é vendido ou cedido a terceiros.

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
