# Relatório de Erros e Riscos — Projeto Alice

Este arquivo é mantido pelo agente auditor de código.
Ele lista problemas encontrados no projeto `alice-virtual`, com evidências, impacto, forma de confirmação e sugestão de correção futura.

## Resumo atual

- Total de problemas encontrados: 4
- Críticos: 0
- Altos: 3
- Médios: 1
- Baixos: 0
- Melhorias recomendadas: 4
- Última análise: 2026-05-03 00:36:09 -04:00

## Índice de problemas

- [ERRO-0001 — Bridge local de conhecimento aceita escrita cross-origin sem autenticação nem limite de corpo](#erro-0001--bridge-local-de-conhecimento-aceita-escrita-cross-origin-sem-autenticacao-nem-limite-de-corpo)
- [ERRO-0002 — Guest Agent residente pode iniciar sem autenticação enquanto expõe execução de comandos](#erro-0002--guest-agent-residente-pode-iniciar-sem-autenticacao-enquanto-expoe-execucao-de-comandos)
- [ERRO-0003 — Gravação atômica da memória remove o arquivo antigo antes de concluir o rename](#erro-0003--gravacao-atomica-da-memoria-remove-o-arquivo-antigo-antes-de-concluir-o-rename)
- [ERRO-0004 — Reordenação manual do Runner pode não alterar a ordem efetiva da fila](#erro-0004--reordenacao-manual-do-runner-pode-nao-alterar-a-ordem-efetiva-da-fila)

## Índice de melhorias

- [MELHORIA-0001 — Criar manifesto transacional para evidências físicas do Runner](#melhoria-0001--criar-manifesto-transacional-para-evidencias-fisicas-do-runner)
- [MELHORIA-0002 — Separar App.jsx em hooks e serviços testáveis](#melhoria-0002--separar-app-jsx-em-hooks-e-servicos-testaveis)
- [MELHORIA-0003 — Dividir executor de ferramentas autônomas por domínio](#melhoria-0003--dividir-executor-de-ferramentas-autonomas-por-dominio)
- [MELHORIA-0004 — Criar comando único de validação completa do projeto](#melhoria-0004--criar-comando-unico-de-validacao-completa-do-projeto)

## ERRO-0001 — Bridge local de conhecimento aceita escrita cross-origin sem autenticação nem limite de corpo

**Severidade:** Alta  
**Status:** Aberto  
**Módulo:** Ponte local de conhecimento web / extensão Edge  
**Arquivos envolvidos:**
- `src-tauri/src/web_knowledge.rs`
- `edge-extension/background.js`
- `edge-extension/manifest.json`

**Resumo:**  
A ponte HTTP local de conhecimento aceita snapshots de página em endpoint loopback com CORS amplo, sem segredo compartilhado e lendo o corpo completo em memória.

**Evidência no código:**  
`web_knowledge.rs` define `Access-Control-Allow-Origin: *`, expõe `POST /v1/page-state` e usa `read_to_string(&mut body)` para carregar o payload completo antes de qualquer limite explícito.

**Por que isso é um problema:**  
Uma página ou processo local pode tentar injetar contexto falso na Alice ou enviar payload grande para DoS local, contaminando respostas e decisões baseadas em contexto web.

**Cenário provável de falha:**  
Com a Alice aberta, uma página maliciosa chama `http://127.0.0.1:38947/v1/page-state` com JSON fabricado ou grande; a Alice passa a usar snapshot falso ou consome memória desnecessariamente.

**Como confirmar:**  
Inspecionar `src-tauri/src/web_knowledge.rs` e a chamada oficial em `edge-extension/background.js`; testar manualmente um `POST` local para o endpoint enquanto o app está ativo.

**Sugestão de correção futura:**  
Adicionar token local por sessão, validar origem/cabeçalhos, limitar `Content-Length` antes da leitura e rejeitar payloads acima do teto.

**Prioridade recomendada:**  
P1
## ERRO-0002 — Guest Agent residente pode iniciar sem autenticação enquanto expõe execução de comandos

**Severidade:** Alta  
**Status:** Aberto  
**Módulo:** VM / Guest Interaction Agent residente  
**Arquivos envolvidos:**
- `src-tauri/src/vm_visual.rs`
- `src-tauri/vm/guest_agent/server.py`
- `src-tauri/vm/guest_agent/action_executor.py`

**Resumo:**  
O servidor residente do Guest Agent permite modo sem token e expõe ações capazes de executar comandos dentro da VM.

**Evidência no código:**  
`vm_visual.rs` lê `ALICE_VM_GUEST_AGENT_TOKEN` e pode iniciar o servidor em `0.0.0.0`; `server.py` autoriza quando não há token; `action_executor.py` implementa `run_command` e `start_background_command`.

**Por que isso é um problema:**  
Qualquer processo que alcance a porta encaminhada pode acionar comandos na VM fora do fluxo governado da Alice.

**Cenário provável de falha:**  
O usuário inicia o residente sem token; um processo local chama a porta do agente e dispara `run_command` sem passar por HUD, policy, auditoria ou validação.

**Como confirmar:**  
Inspecionar os três arquivos citados e iniciar o agente residente sem `ALICE_VM_GUEST_AGENT_TOKEN` em ambiente controlado para verificar se requisições sem token são aceitas.

**Sugestão de correção futura:**  
Tornar token obrigatório, gerar segredo efêmero por sessão ou bloquear ações de comando quando o residente estiver sem autenticação.

**Prioridade recomendada:**  
P1
## ERRO-0003 — Gravação atômica da memória remove o arquivo antigo antes de concluir o rename

**Severidade:** Alta  
**Status:** Aberto  
**Módulo:** Persistência de memória local  
**Arquivos envolvidos:**
- `src-tauri/src/lib.rs`
- `src/aliceMemory.js`

**Resumo:**  
A escrita da memória usa arquivo temporário, mas remove o arquivo antigo antes do rename, criando uma janela de perda de dados.

**Evidência no código:**  
`write_memory_json_atomic` valida e escreve o `.tmp`, remove `path` quando existe e só depois faz `rename(&tmp_path, path)`.

**Por que isso é um problema:**  
Falha entre remoção e rename pode deixar a Alice sem memória persistida, forçando recuperação vazia ou perda de estado operacional.

**Cenário provável de falha:**  
Durante o fechamento do app ou flush de memória, antivírus, permissão ou queda de energia interrompe o rename depois do `remove_file`; o próximo boot não encontra memória válida.

**Como confirmar:**  
Inspecionar `write_memory_json_atomic` em `src-tauri/src/lib.rs` e simular falha de rename em teste unitário com arquivo existente.

**Sugestão de correção futura:**  
Usar rename/substituição atômica apropriada por plataforma sem remover antes, mantendo backup temporário e recovery de último arquivo válido.

**Prioridade recomendada:**  
P1
## ERRO-0004 — Reordenação manual do Runner pode não alterar a ordem efetiva da fila

**Severidade:** Média  
**Status:** Aberto  
**Módulo:** Autonomous Task Runner / fila  
**Arquivos envolvidos:**
- `src/autonomousRunnerState.js`
- `src/autonomousRunnerScheduler.js`
- `src/hud/pages/AutonomousRunnerHudPage.jsx`

**Resumo:**  
A reordenação atual altera `queueRank` da task, mas não reescreve a lista `queue`, que é a origem usada para montar candidatos antes da ordenação.

**Evidência no código:**  
`reorderAutonomousRunnerTask` chama `updateAutonomousRunnerTask` com novo `queueRank`, mas não atualiza `runner.queue`; o scheduler parte da ordem de `queue` para resolver tasks antes de ordenar por prioridade/rank.

**Por que isso é um problema:**  
O HUD pode sugerir que uma task foi reordenada, mas o comportamento real pode continuar dependente da fila antiga em cenários de empate ou normalização.

**Cenário provável de falha:**  
Usuário move task para o topo pelo HUD, mas outra task com prioridade equivalente continua sendo selecionada primeiro porque a fila persistida não foi regravada de forma explícita.

**Como confirmar:**  
Criar teste com duas tasks de mesma prioridade, chamar `reorderAutonomousRunnerTask` e verificar `runner.queue` e ordem selecionada por `getEligibleRunnerTasks`.

**Sugestão de correção futura:**  
Atualizar `queue` junto com `queueRank` ou definir um único contrato de ordenação persistida e cobri-lo por teste.

**Prioridade recomendada:**  
P2

# Melhorias Recomendadas

## MELHORIA-0001 — Criar manifesto transacional para evidências físicas do Runner

**Severidade:** Média  
**Status:** Aberto  
**Módulo:** Runner / evidências  
**Arquivos envolvidos:**
- `src-tauri/src/lib.rs`
- `src/autonomousRunnerEvidence.js`
- `src/autonomousTaskRunner.js`

**Resumo:**  
Um manifesto verificável reduz risco de evidência parcial ser interpretada como completa e melhora auditoria de execuções críticas.

**Evidência no código:**  
`save_runner_evidence` grava arquivos separados, mas não há manifesto final com hashes/tamanhos nem marcador de commit atômico do conjunto.

**Por que vale fazer:**  
Um manifesto verificável reduz risco de evidência parcial ser interpretada como completa e melhora auditoria de execuções críticas.

**Risco de não fazer:**  
Sem manifesto, falhas intermediárias podem deixar diretórios parcialmente escritos e dificultar distinguir execução incompleta de evidência íntegra.

**Como confirmar:**  
Inspecionar `save_runner_evidence` e `verify_runner_evidence`; verificar ausência de arquivo de manifesto ou hash por arquivo.

**Sugestão de implementação futura:**  
Gravar arquivos em diretório temporário, calcular hash/tamanho, criar `manifest.json` e só então promover o diretório para execução confirmada.

**Prioridade recomendada:**  
P1
## MELHORIA-0002 — Separar App.jsx em hooks e serviços testáveis

**Severidade:** Baixa  
**Status:** Aberto  
**Módulo:** React / orquestração principal  
**Arquivos envolvidos:**
- `src/App.jsx`

**Resumo:**  
Separar responsabilidades reduz acoplamento, facilita testes unitários e diminui risco de regressão em efeitos React longos.

**Evidência no código:**  
App.jsx possui aproximadamente 1757 linhas e concentra Live API, memória, Runner, HUD, tool calls, persistência e observações.

**Por que vale fazer:**  
Separar responsabilidades reduz acoplamento, facilita testes unitários e diminui risco de regressão em efeitos React longos.

**Risco de não fazer:**  
Manter tudo no componente principal aumenta custo de revisão e torna mais fácil introduzir bugs em timers, refs e persistência.

**Como confirmar:**  
Contar linhas e mapear responsabilidades de `App.jsx`; observar múltiplos `useEffect`, refs globais e handlers de domínios distintos.

**Sugestão de implementação futura:**  
Extrair hooks/serviços para sessão Live, persistência de memória, Runner loop, debug interactions e aprendizado observado, preservando contratos atuais.

**Prioridade recomendada:**  
P2
## MELHORIA-0003 — Dividir executor de ferramentas autônomas por domínio

**Severidade:** Baixa  
**Status:** Aberto  
**Módulo:** Tools autônomas / integração  
**Arquivos envolvidos:**
- `src/autonomousLearningToolExecutor.js`

**Resumo:**  
Adapters por domínio tornam o fluxo mais testável, reduzem efeitos colaterais cruzados e deixam claro qual ferramenta altera qual parte da memória.

**Evidência no código:**  
`autonomousLearningToolExecutor.js` concentra diversas operações em um único executor/switch, misturando VM, propostas, auditoria, snapshots, rollback e aprendizado.

**Por que vale fazer:**  
Adapters por domínio tornam o fluxo mais testável, reduzem efeitos colaterais cruzados e deixam claro qual ferramenta altera qual parte da memória.

**Risco de não fazer:**  
Um executor grande tende a acumular contratos implícitos e dificulta validar permissões, rollback e persistência por operação.

**Como confirmar:**  
Inspecionar o executor e contar operações/cases; comparar com testes existentes por domínio.

**Sugestão de implementação futura:**  
Criar módulos pequenos para VM, runner, host snapshots, propostas e aprendizado, mantendo um roteador fino compatível com a API atual.

**Prioridade recomendada:**  
P2
## MELHORIA-0004 — Criar comando único de validação completa do projeto

**Severidade:** Baixa  
**Status:** Aberto  
**Módulo:** Scripts / validação  
**Arquivos envolvidos:**
- `package.json`
- `scripts/`

**Resumo:**  
Um comando único reduz falhas por validação parcial e facilita handoff entre contas/sessões.

**Evidência no código:**  
`package.json` tem comandos separados para JS, build e harness; validações Rust e Python estão documentadas no README, mas não há comando único versionado.

**Por que vale fazer:**  
Um comando único reduz falhas por validação parcial e facilita handoff entre contas/sessões.

**Risco de não fazer:**  
Mudanças podem passar com `npm test` mas quebrar Rust, Python ou harness, especialmente em áreas Tauri/VM/Runner.

**Como confirmar:**  
Inspecionar `package.json` e `README.md`; verificar ausência de `validate:all` ou script equivalente.

**Sugestão de implementação futura:**  
Adicionar script orquestrador que rode `npm test`, `npm run lint`, `npm run build`, `cargo test`, testes Python e `runner:harness -- verify-safe-state` com relatório consolidado.

**Prioridade recomendada:**  
P2
