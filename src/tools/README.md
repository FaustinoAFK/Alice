# Tools Boundary

Esta pasta e a fronteira oficial das tools da Alice.

## Estrutura

- `aliceLiveTools.js`: monta o array final enviado ao Gemini Live.
- `aliceLiveToolDomains.js`: define ordem e dominio das tools Live.
- `webLiveTools.js`: declara as duas tools Live de conhecimento web.
- `knowledge/`: executor e pipeline das tools de conhecimento.
- `registry/`: perfis contextuais de tools.

## Regra atual

O Gemini Live deve receber somente:

- `get_navigation_context`
- `inspect_current_page`

As capacidades amplas de busca/fetch web (`search_same_domain`, `search_web`,
`fetch_web_page`) sao internas do pipeline em `knowledge/`. Elas nao devem ser
aceitas como tool call direta do modelo.

Nao colocar aqui declaracoes de VM, runner, aprendizado autonomo, host safety,
desktop commands ou mapa mental automatico sem pedido explicito.
