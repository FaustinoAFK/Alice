# Checklist de entendimento

## Antes de alterar arquitetura

- [ ] Entendi se a mudanca toca frontend, Tauri, guest agent, extensao, memoria ou Runner.
- [ ] Li `src/App.jsx` se houver impacto em Live/tools/memoria/HUD/Runner.
- [ ] Verifiquei se ja existe modulo oficial para o dominio.
- [ ] Identifiquei tests existentes e lacunas.

## Memoria

- [ ] Usei helpers de `aliceMemory.js`.
- [ ] Preservei schema/version/defaults/prune.
- [ ] Considerei limite de tamanho e dados antigos.

## Tool calls

- [ ] Atualizei declaracao em `alice.js`, executor e testes juntos.
- [ ] Nao confundi task iniciada com task concluida.
- [ ] Mantive validacao deterministica fora do modelo.

## Runner

- [ ] Task tem action, completion criteria e expected evidence.
- [ ] `running` exige lease.
- [ ] `done` exige execucao, validacao e evidencia persistida.
- [ ] Runtime/VM indisponivel nao vira sucesso.

## VM/evidencias

- [ ] Fallback local nao e chamado de VM real.
- [ ] Comandos/paths/timeouts continuam validados.
- [ ] Evidencia fisica e verificada antes de concluir.

## HUD/mind map

- [ ] HUD continua snapshot + callbacks.
- [ ] State derivado e atualizado apos memoria mudar.
- [ ] Mind map preserva ids, nodes, edges, status e history.

## Validacao recomendada

- [ ] `npm test`.
- [ ] `npm run lint`.
- [ ] `npm run build`.
- [ ] `cd src-tauri; cargo test`.
- [ ] Python unittest quando sidecar/guest mudar.
- [ ] Teste manual Tauri/VM apenas se necessario e em ambiente controlado.
