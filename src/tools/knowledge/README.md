# Knowledge Tools

Executor e pipeline das tools de conhecimento web.

## Entrada Live permitida

- `get_navigation_context`
- `inspect_current_page`

## Capacidades internas

O fluxo de `inspect_current_page` pode chamar internamente comandos Tauri para:

- atualizar snapshot da pagina atual;
- buscar no mesmo dominio;
- buscar na web;
- fazer fetch de uma pagina especifica.

Essas capacidades internas existem para melhorar a resposta quando a pagina
atual nao basta. Elas nao devem ser aceitas como chamada direta do Gemini Live.
