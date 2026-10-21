# Contributing

Contribuições são bem-vindas! O projeto é desenvolvido de forma contínua e as
contribuições são analisadas conforme a disponibilidade dos mantenedores.

## Formas de contribuir

- Reportar bugs e comportamentos inesperados.
- Sugerir funcionalidades e melhorias.
- Melhorar documentação.
- Contribuir com código.
- Criar traduções e localização.
- Enviar Pull Requests.

## Issues e Pull Requests

Antes de abrir uma Issue, verifique se já existe uma solicitação semelhante.
Pull Requests devem descrever claramente as alterações e, quando possível,
estar relacionados a uma Issue.

O envio de uma contribuição não garante aprovação, incorporação ou prazo de
resposta. Os mantenedores poderão solicitar alterações ou rejeitar uma
contribuição por razões técnicas, de segurança, manutenção, escopo ou
prioridade.

## Antes de enviar um Pull Request neste projeto

O README explica como rodar o jogo, as regras de cada etapa e os testes. Em resumo:

- `npm test` precisa passar. Ele inclui a simulação de balanceamento (`test/balanceamento.test.js`): uma mudança de regra que tire uma métrica da faixa da etapa não entra. Se você mexer em regras, rode `npm run simular` e cole o resultado na descrição do Pull Request.
- Regra nova vai no motor (`public/js/engine.js`), com teste em `test/engine.test.js`. O servidor, o jogo sozinho e a simulação usam o mesmo motor; não duplique regra no servidor nem na tela.
- Se a mudança mexe em salas, no banco ou nas rotas, rode também `npm run test:integracao` e o `test/e2e.mjs` (as variáveis estão no README). Mudança de banco é sempre uma migração nova em `server/migrations`; nunca edite uma migração que já existe.
- O jogo é para crianças a partir de 7 anos. Não entram chat livre, dado pessoal novo, propaganda durante a rodada, caixa-surpresa ou compra com dinheiro de verdade. Toda carta precisa ensinar o que a carteira de evento faz de verdade.
- Textos em português do Brasil, com frases curtas: uma regra nova precisa caber numa frase que um Lobinho entenda.
- Siga o estilo do código ao redor: nomes em português, JavaScript sem framework e animações só com `transform` e `opacity`.

## Traduções e localização

Traduções da interface e da documentação podem ser propostas por Pull Request.
Alterações são revisadas antes de entrarem oficialmente no projeto.

Contribuições relacionadas a legislação ou privacidade de outros países são
bem-vindas como sugestões, mas não autorizam o contribuidor a definir sozinho
a política jurídica do projeto.

Em caso de conflito entre uma tradução e a versão oficial de uma política, a
versão oficial prevalece.

## Dados de usuários

Contribuidores não devem utilizar dados reais de usuários em desenvolvimento,
testes, exemplos, Issues ou Pull Requests.

Código de contribuição não recebe, por esse motivo, autorização para acessar,
copiar, exportar, compartilhar ou utilizar dados de produção.

## Direitos sobre contribuições

As contribuições de código são submetidas ao projeto sob termos compatíveis
com a licença do projeto, salvo acordo escrito diferente.

A licença MIT não transfere automaticamente marcas, logos, identidade visual,
conteúdos proprietários ou outros direitos de propriedade intelectual.

## Ritmo do projeto

Este é um projeto mantido de forma gradual. Não existe garantia de prazo para
análise, resposta, revisão ou implementação de uma contribuição.

Obrigado por contribuir!
