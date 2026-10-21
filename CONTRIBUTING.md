# Contributing

Obrigado pelo interesse em contribuir com este projeto!

Este jogo é um projeto open source e contribuições são bem-vindas. Você pode participar reportando problemas, sugerindo melhorias, propondo novas funcionalidades ou enviando alterações no código.

## Como contribuir

Existem várias formas de contribuir:

- Reportar bugs ou comportamentos inesperados.
- Sugerir novas funcionalidades ou melhorias.
- Enviar ideias relacionadas ao jogo.
- Melhorar a documentação.
- Corrigir problemas no código.
- Criar Pull Requests com melhorias.

## Issues e sugestões

Antes de abrir uma nova solicitação, verifique se já existe uma Issue relacionada ao assunto.

Ao criar uma Issue, procure fornecer o máximo de informações possível, incluindo:

- Descrição clara da solicitação ou problema.
- Passos para reproduzir um problema, quando aplicável.
- Comportamento esperado.
- Comportamento observado.
- Informações relevantes sobre o ambiente ou versão do jogo.

## Revisão das contribuições

Todas as contribuições serão analisadas pelos mantenedores do projeto.

O envio de uma Issue, sugestão ou Pull Request não significa que ela será necessariamente aceita ou implementada.

As contribuições serão avaliadas considerando, entre outros fatores:

- Impacto no jogo.
- Compatibilidade com os objetivos do projeto.
- Qualidade e manutenção do código.
- Segurança e estabilidade.
- Complexidade da implementação.
- Prioridades atuais do projeto.

## Tempo de resposta

Este é um projeto desenvolvido de forma gradual e colaborativa.

Não há garantia de prazo para análise, resposta ou implementação de Issues e Pull Requests.

Algumas solicitações poderão ser analisadas rapidamente, enquanto outras poderão permanecer aguardando revisão por períodos maiores.

A ausência de uma resposta imediata não significa que a contribuição foi ignorada.

## Pull Requests

Pull Requests devem:

- Ter uma descrição clara das alterações realizadas.
- Estar relacionados a uma Issue quando apropriado.
- Evitar alterações não relacionadas ao objetivo da contribuição.
- Manter o padrão de código utilizado pelo projeto.
- Ser testados antes do envio, sempre que possível.

Os mantenedores poderão solicitar alterações antes da aprovação.

## Antes de enviar um Pull Request neste projeto

O README explica como rodar o jogo, as regras de cada etapa e os testes. Em resumo:

- `npm test` precisa passar. Ele inclui a simulação de balanceamento (`test/balanceamento.test.js`): uma mudança de regra que tire uma métrica da faixa da etapa não entra. Se você mexer em regras, rode `npm run simular` e cole o resultado na descrição do Pull Request.
- Regra nova vai no motor (`public/js/engine.js`), com teste em `test/engine.test.js`. O servidor, o jogo sozinho e a simulação usam o mesmo motor; não duplique regra no servidor nem na tela.
- Se a mudança mexe em salas, no banco ou nas rotas, rode também `npm run test:integracao` e o `test/e2e.mjs` (as variáveis estão no README). Mudança de banco é sempre uma migração nova em `server/migrations`; nunca edite uma migração que já existe.
- O jogo é para crianças a partir de 7 anos. Não entram chat livre, dado pessoal novo, propaganda durante a rodada, caixa-surpresa ou compra com dinheiro de verdade. Toda carta precisa ensinar o que a carteira de evento faz de verdade.
- Textos em português do Brasil, com frases curtas: uma regra nova precisa caber numa frase que um Lobinho entenda.
- Siga o estilo do código ao redor: nomes em português, JavaScript sem framework e animações só com `transform` e `opacity`.

## Decisões do projeto

A manutenção do projeto é realizada pelos seus responsáveis, que possuem a palavra final sobre a direção, funcionalidades e alterações incorporadas ao projeto.

Sugestões e opiniões da comunidade são importantes e serão consideradas sempre que possível.

## Código de Conduta

Esperamos que todos os participantes mantenham uma postura respeitosa e colaborativa.

Contribuições, críticas e opiniões diferentes são bem-vindas, desde que apresentadas de forma construtiva.

## Importante

O projeto é desenvolvido de forma contínua e pode evoluir ao longo do tempo.

A melhor forma de contribuir é apresentar ideias, problemas e melhorias de maneira clara e permitir que os mantenedores tenham o tempo necessário para analisar cada contribuição.

Obrigado por contribuir!
