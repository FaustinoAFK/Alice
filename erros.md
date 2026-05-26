# Relatorio Explicado de Problemas - Alice Virtual

Data da revisao: 2026-05-25

Este documento explica, em linguagem simples, os problemas encontrados no projeto `alice-virtual`. A ideia nao e apenas dizer "tem erro", mas mostrar por que aquilo importa, qual risco cria e qual seria o caminho pratico para corrigir.

## Como ler a severidade

- **Alta:** pode afetar seguranca, privacidade, execucao de comandos, perda de dados ou confianca do app.
- **Media:** nao e necessariamente perigoso agora, mas aumenta risco de bug, manutencao dificil ou comportamento inesperado.
- **Baixa:** organizacao, limpeza, qualidade de relatorio ou poluicao do projeto.

## Resumo rapido

- O projeto tem bons testes: `npm run lint` passou e `npm test` passou com 49 arquivos e 521 testes.
- Os maiores riscos estao no Guest Agent, na bridge local web, no CSP desligado e na execucao de comandos.
- Tambem existem arquivos gerados/logs que nao deveriam estar versionados ou espalhados no projeto.

## 1. Guest Agent residente pode rodar sem autenticacao

**Severidade:** Alta  
**Arquivos:** `src-tauri/vm/guest_agent/server.py`, `src-tauri/src/vm_visual.rs`

**Em palavras simples:**  
O Guest Agent e um pequeno servidor que roda dentro da VM para receber comandos da Alice. O problema e que, se nenhum token for configurado, ele aceita qualquer requisicao como autorizada.

**O que acontece no codigo:**  
Em `server.py`, a funcao `_authorized()` faz isto: se nao existe token, ela retorna `True`. Ou seja, "sem senha" vira "todo mundo pode".

**Exemplo de risco:**  
Imagine que a Alice inicia o agente residente na VM sem `ALICE_VM_GUEST_AGENT_TOKEN`. Um processo local que consiga chamar a porta do agente pode pedir acoes como digitar texto, clicar, capturar tela ou executar comando.

**Por que isso importa:**  
Como o agente tem permissoes fortes, autenticacao deveria ser obrigatoria. Esse tipo de servidor nunca deve confiar em "se nao tem token, libera".

**Como corrigir:**  
Tornar o token obrigatorio. Se `ALICE_VM_GUEST_AGENT_TOKEN` estiver vazio, o servidor deve recusar iniciar ou deve bloquear as acoes perigosas, principalmente `run_command` e `start_background_command`.

## 2. Guest Agent escuta em `0.0.0.0`

**Severidade:** Alta  
**Arquivos:** `src-tauri/vm/guest_agent/server.py`, `src-tauri/src/vm_visual.rs`

**Em palavras simples:**  
`0.0.0.0` significa "escutar em todas as interfaces de rede". Isso deixa o servidor mais exposto dentro da VM.

**O que acontece no codigo:**  
O servidor tem `--host 0.0.0.0` como padrao ou como argumento usado ao iniciar o residente.

**Exemplo de risco:**  
Se a VM tiver alguma rede compartilhada, adaptador bridge ou outro servico com acesso, o Guest Agent pode ficar acessivel alem do necessario.

**Por que isso importa:**  
Um agente que executa comandos deve ficar o mais fechado possivel. Se ele so precisa falar com a Alice via localhost/port-forward, nao precisa escutar em todas as interfaces.

**Como corrigir:**  
Usar `127.0.0.1` como padrao. Se algum modo realmente precisar de `0.0.0.0`, exigir token forte, registrar aviso claro e tratar como modo avancado/perigoso.

## 3. Execucao livre de comandos dentro da VM

**Severidade:** Alta  
**Arquivo:** `src-tauri/vm/guest_agent/action_executor.py`

**Em palavras simples:**  
O agente aceita pedidos para rodar comandos dentro da VM. Isso e poderoso, mas tambem perigoso.

**O que acontece no codigo:**  
As acoes `run_command` e `start_background_command` pegam `command` e `args` da requisicao e executam com `subprocess`.

**Exemplo de risco:**  
Uma requisicao pode tentar rodar `powershell`, `cmd`, instaladores, scripts longos ou comandos que alteram arquivos da VM.

**Por que isso importa:**  
Mesmo sendo "so dentro da VM", a VM pode conter dados, credenciais, sessoes abertas ou acesso a pastas compartilhadas. Tambem pode ser usada para atacar o proprio host se houver integracoes mal configuradas.

**Como corrigir:**  
Criar uma allowlist de comandos permitidos. Separar comandos seguros de comandos sensiveis. Bloquear shells genericos por padrao. Exigir aprovacao humana para comandos que instalam, removem, alteram configuracao ou rodam por muito tempo.

## 4. Bridge local web aceita escrita cross-origin

**Severidade:** Alta  
**Arquivos:** `src-tauri/src/web_knowledge.rs`, `edge-extension/background.js`

**Em palavras simples:**  
A bridge local recebe informacoes do navegador para a Alice entender a pagina atual. O problema e que ela aceita escrita com CORS aberto, sem segredo compartilhado.

**O que acontece no codigo:**  
`web_knowledge.rs` define `Access-Control-Allow-Origin: *` e aceita `POST /v1/page-state`.

**Exemplo de risco:**  
Uma pagina maliciosa aberta no navegador poderia tentar enviar um contexto falso para a Alice, dizendo por exemplo que a pagina atual contem informacoes que nao existem.

**Por que isso importa:**  
A Alice usa esse contexto para responder e tomar decisoes. Se o contexto pode ser falsificado, a IA pode ser induzida a agir com base em informacao falsa.

**Como corrigir:**  
Gerar um token local por sessao. A extensao envia esse token em um cabecalho. A bridge rejeita qualquer escrita sem token valido. Tambem vale validar origem e tipo de payload.

## 5. Bridge local le payload inteiro em memoria

**Severidade:** Alta  
**Arquivo:** `src-tauri/src/web_knowledge.rs`

**Em palavras simples:**  
O endpoint le o corpo inteiro da requisicao antes de limitar o tamanho.

**O que acontece no codigo:**  
O codigo usa `read_to_string(&mut body)` no endpoint `/v1/page-state`.

**Exemplo de risco:**  
Um processo local pode enviar um payload enorme. O app tenta carregar tudo na memoria e pode travar ou consumir recursos demais.

**Por que isso importa:**  
Mesmo em localhost, endpoints precisam ter limite de tamanho. Localhost nao significa automaticamente seguro.

**Como corrigir:**  
Antes de ler o corpo, verificar `Content-Length`. Se passar do limite, rejeitar. Tambem limitar a leitura com um reader/take para impedir abuso mesmo quando o cabecalho estiver ausente ou incorreto.

## 6. CSP do Tauri esta desativado

**Severidade:** Alta  
**Arquivo:** `src-tauri/tauri.conf.json`

**Em palavras simples:**  
CSP e uma camada de seguranca que limita quais scripts, conexoes e recursos uma pagina pode usar. No app ela esta desligada.

**O que acontece no codigo:**  
`tauri.conf.json` tem `"csp": null`.

**Exemplo de risco:**  
Se algum XSS ou conteudo inesperado entrar na interface, a falta de CSP facilita executar script ou conectar em destinos indesejados.

**Por que isso importa:**  
Aplicativo desktop com ponte local e comandos nativos precisa ser mais restrito que uma pagina comum. Um bug pequeno de frontend pode virar problema maior.

**Como corrigir:**  
Configurar CSP restritiva para producao. Liberar apenas `self`, endpoints locais necessarios e conexoes realmente usadas pelo app.

## 7. Shell local sem allowlist de executavel

**Severidade:** Alta  
**Arquivo:** `src-tauri/src/lib.rs`

**Em palavras simples:**  
Existe uma acao de shell local que valida o diretorio e o timeout, mas nao restringe bem qual programa pode ser executado.

**O que acontece no codigo:**  
`validate_shell_action` verifica se o comando nao esta vazio, valida `working_directory` e limita `timeout_ms`. Depois `perform_shell_action` executa `Command::new(command)`.

**Exemplo de risco:**  
Se uma chamada conseguir chegar com `command = powershell.exe` ou outro executavel sensivel, ela pode rodar algo perigoso dentro de uma pasta permitida.

**Por que isso importa:**  
Validar so o diretorio nao basta. Um comando perigoso continua perigoso mesmo dentro de `C:\projetos`.

**Como corrigir:**  
Permitir apenas executaveis esperados, por exemplo `npm`, `node` ou comandos internos muito especificos. Bloquear shells genericos por padrao e registrar cada execucao.

## 8. Validacao de caminho sem canonicalizacao forte

**Severidade:** Media  
**Arquivo:** `src-tauri/src/lib.rs`

**Em palavras simples:**  
O app tenta validar se um caminho esta dentro de uma pasta permitida olhando para a string do caminho. Isso ajuda, mas nao cobre todos os casos.

**O que acontece no codigo:**  
A validacao normaliza barras e letras, depois compara se o caminho comeca com um escopo permitido.

**Exemplo de risco:**  
No Windows, links, junctions, atalhos e `..` podem tornar um caminho visualmente seguro, mas resolver para outro lugar.

**Por que isso importa:**  
Operacoes de arquivo incluem criar, mover, copiar e apagar. Se a validacao errar, o app pode mexer fora do escopo permitido.

**Como corrigir:**  
Quando o caminho existir, usar `canonicalize`. Para caminhos novos, canonicalizar a pasta pai e validar o nome final separadamente. Depois comparar o caminho resolvido com escopos permitidos.

## 9. Escrita atomica da memoria remove arquivo antigo antes do rename

**Severidade:** Alta  
**Arquivo:** `src-tauri/src/lib.rs`

**Em palavras simples:**  
O app tenta salvar a memoria local de forma segura, mas apaga o arquivo antigo antes de colocar o novo no lugar.

**O que acontece no codigo:**  
`write_memory_json_atomic` escreve um `.tmp`, faz `remove_file(path)` se o arquivo antigo existe, e depois faz `rename(&temp_path, path)`.

**Exemplo de risco:**  
Se o app travar, faltar energia, o antivirus bloquear ou o `rename` falhar depois do remove, a Alice fica sem o arquivo antigo e sem o novo.

**Por que isso importa:**  
Memoria local e estado do app sao dados importantes. Perder esse arquivo pode fazer a Alice "esquecer" configuracoes e contexto.

**Como corrigir:**  
Usar substituicao atomica adequada para a plataforma ou manter backup. Uma estrategia simples: gravar `.tmp`, validar, renomear o arquivo atual para `.bak`, promover `.tmp`, e so depois limpar `.bak`.

## 10. Extensao com permissoes amplas demais

**Severidade:** Media  
**Arquivo:** `edge-extension/manifest.json`

**Em palavras simples:**  
A extensao pede permissao para acessar todos os sites.

**O que acontece no codigo:**  
`host_permissions` contem `"<all_urls>"`.

**Exemplo de risco:**  
A extensao pode coletar contexto de paginas que nao precisam ser analisadas pela Alice, incluindo paginas sensiveis.

**Por que isso importa:**  
Extensoes devem pedir o minimo de permissao possivel. Isso protege o usuario e reduz impacto se houver bug.

**Como corrigir:**  
Usar captura sob demanda, limitar dominios quando possivel ou pedir permissao ativa apenas quando o usuario clicar na extensao.

## 11. Captura passiva frequente demais

**Severidade:** Media  
**Arquivo:** `edge-extension/background.js`

**Em palavras simples:**  
A extensao captura contexto da pagina com muita frequencia.

**O que acontece no codigo:**  
`CAPTURE_PERIOD_MINUTES = 0.05`, equivalente a cerca de 3 segundos. Alem disso, tambem captura em eventos de aba, foco e atualizacao.

**Exemplo de risco:**  
O usuario navega rapidamente por paginas diferentes e a extensao envia muitos snapshots que talvez nem sejam usados.

**Por que isso importa:**  
Isso pode consumir recursos, gerar ruido no contexto e criar sensacao de coleta excessiva.

**Como corrigir:**  
Aumentar o intervalo, capturar apenas quando a Alice precisar, pausar quando nao houver sessao ativa e evitar captura em paginas sensiveis.

## 12. Arquivos de harness grandes versionados

**Severidade:** Media  
**Pasta:** `.harness-smoke`

**Em palavras simples:**  
Arquivos grandes gerados por teste foram parar no Git.

**O que acontece no projeto:**  
Ha tres arquivos JSON/backups com cerca de 7.9 MB cada em `.harness-smoke`.

**Exemplo de problema:**  
Cada clone do repositorio baixa esses arquivos. Cada diff fica mais pesado. O historico do Git cresce sem necessidade.

**Por que isso importa:**  
Repositorio saudavel deve versionar codigo, configuracao e fixtures pequenas. Resultado de teste normalmente deve ficar fora do Git.

**Como corrigir:**  
Remover esses arquivos do versionamento e adicionar `.harness-smoke/` ao `.gitignore`.

## 13. Saidas de dev versionadas

**Severidade:** Media  
**Arquivos:** `alice-dev.err`, `alice-dev.out`

**Em palavras simples:**  
Arquivos de saida de execucao local estao no Git.

**O que acontece no projeto:**  
`alice-dev.err` e `alice-dev.out` parecem ter sido criados por execucao local do app.

**Exemplo de problema:**  
Esses arquivos mudam quando alguem roda o app. Isso gera alteracoes falsas no Git e pode vazar mensagens locais.

**Por que isso importa:**  
Logs e saidas locais raramente devem ser versionados. Eles atrapalham revisao e nao ajudam a construir o app.

**Como corrigir:**  
Remover do Git e adicionar padroes como `*.err`, `*.out`, `*.log` e `*.stderr` ao `.gitignore`.

## 14. Muitos logs locais no diretorio raiz

**Severidade:** Baixa  
**Arquivos:** `alice-code-auditor.watch.log`, `alice-dev.log`, `tauri-*.log`, `*.stderr`

**Em palavras simples:**  
A raiz do projeto esta cheia de logs.

**O que acontece no projeto:**  
Existem varios arquivos `tauri-...log`, `alice-dev.log`, logs do auditor e stderr.

**Exemplo de problema:**  
Fica mais dificil enxergar os arquivos importantes do projeto. Um iniciante pode achar que esses logs fazem parte do codigo.

**Por que isso importa:**  
Organizacao ajuda manutencao. Projeto limpo reduz erro humano.

**Como corrigir:**  
Apagar logs locais e concentrar logs futuros em uma pasta `logs/` ignorada pelo Git.

## 15. Logs em `data/harness/logs`

**Severidade:** Baixa  
**Pasta:** `data/harness/logs`

**Em palavras simples:**  
Existe uma pasta de logs de harness dentro de `data`.

**O que acontece no projeto:**  
`data/harness/logs` contem logs de smoke/restart.

**Exemplo de problema:**  
A pasta `data` pode parecer conter dados importantes do app, mas esses logs sao artefatos temporarios.

**Por que isso importa:**  
Misturar dado real, fixture e log temporario deixa o projeto confuso.

**Como corrigir:**  
Manter logs fora do versionamento. Se forem uteis para debug, documentar como gerar novamente.

## 16. Caminhos especificos da maquina no backend

**Severidade:** Media  
**Arquivo:** `src-tauri/src/lib.rs`

**Em palavras simples:**  
O backend tem caminhos fixos que so fazem sentido nesta maquina ou neste ambiente.

**O que acontece no codigo:**  
Escopos como `C:\projetos` e `C:\Atlas` estao hardcoded.

**Exemplo de problema:**  
Em outro computador, esses caminhos podem nao existir. Ou pior: podem existir com conteudo diferente e ainda assim serem permitidos.

**Por que isso importa:**  
Politica de seguranca nao deve depender de uma pasta especifica do computador do desenvolvedor.

**Como corrigir:**  
Mover os escopos permitidos para configuracao local. Usar defaults restritos, como pasta de dados do app ou workspace escolhido pelo usuario.

## 17. Texto corrompido no auditor

**Severidade:** Baixa  
**Arquivo:** `scripts/alice-code-auditor.mjs`

**Em palavras simples:**  
Alguns textos do auditor estao com acentos quebrados.

**O que acontece no codigo:**  
Aparecem textos como `autenticaÃ§Ã£o` e `memÃ³ria`.

**Exemplo de problema:**  
O relatorio gerado fica menos profissional e mais dificil de ler.

**Por que isso importa:**  
Ferramenta de auditoria precisa gerar texto claro. Se o proprio relatorio parece quebrado, passa menos confianca.

**Como corrigir:**  
Salvar o arquivo em UTF-8 e corrigir os textos. Tambem vale adicionar uma verificacao simples para evitar mojibake em relatorios.

## 18. `App.jsx` grande demais

**Severidade:** Media  
**Arquivo:** `src/App.jsx`

**Em palavras simples:**  
O componente principal cresceu demais e concentra muitas responsabilidades.

**O que acontece no codigo:**  
`App.jsx` tem cerca de 1932 linhas e mistura sessao Live, memoria, Runner, HUD, ferramentas, persistencia e observacoes.

**Exemplo de problema:**  
Uma alteracao pequena no Runner pode quebrar algo da memoria ou da interface, porque tudo esta muito proximo no mesmo arquivo.

**Por que isso importa:**  
Arquivos grandes aumentam o custo de entender, testar e alterar. Isso e especialmente importante em app com automacao e comandos nativos.

**Como corrigir:**  
Extrair aos poucos: `useLiveSession`, `useAliceMemory`, `useAutonomousRunner`, `useHudState`, `useToolCalls` e servicos separados para persistencia.

## 19. Executor autonomo grande demais

**Severidade:** Media  
**Arquivo:** `src/autonomousLearningToolExecutor.js`

**Em palavras simples:**  
O executor de ferramentas autonomas virou um ponto central grande demais.

**O que acontece no codigo:**  
O arquivo tem cerca de 1604 linhas e muitos `case`, misturando VM, runner, auditoria, snapshots, rollback e aprendizado.

**Exemplo de problema:**  
Ao adicionar uma nova ferramenta, fica facil mexer sem querer em fluxo de outra area.

**Por que isso importa:**  
Executores grandes acumulam regras implicitas. Isso dificulta testar permissoes, rollback e efeitos colaterais.

**Como corrigir:**  
Separar por dominio: executor de VM, executor de runner, executor de snapshots, executor de propostas e executor de aprendizado. O arquivo atual pode virar apenas um roteador pequeno.

## Ordem recomendada de correcao

1. Corrigir Guest Agent sem token.
2. Trocar `0.0.0.0` por `127.0.0.1` quando possivel.
3. Restringir `run_command` e `start_background_command`.
4. Proteger a bridge web com token local.
5. Adicionar limite de payload na bridge web.
6. Ativar CSP no Tauri.
7. Criar allowlist para shell local.
8. Corrigir escrita atomica da memoria.
9. Fortalecer validacao de caminhos.
10. Remover arquivos gerados/logs do Git.
11. Reduzir permissoes e frequencia da extensao.
12. Refatorar `App.jsx` e `autonomousLearningToolExecutor.js` em etapas pequenas.

## Observacao final

Nem todos esses itens significam que o app esta quebrado hoje. Muitos sao riscos de projeto: coisas que funcionam durante desenvolvimento, mas que nao deveriam ir para uma versao mais segura e organizada. Os itens de severidade alta devem vir primeiro porque envolvem autenticacao, comando nativo, ponte local, CSP e perda de dados.
